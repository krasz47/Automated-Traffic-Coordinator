mod config;
mod models;
mod adsblol; // Changed from opensky
mod logic;

use axum::{
    extract::State,
    routing::get,
    Router,
    Json,
};
use std::sync::{Arc, Mutex};
use std::collections::HashMap;
use std::time::Duration;
use tokio::time;
use tower_http::cors::CorsLayer;

use crate::config::Config;
use crate::models::{Aircraft, AircraftState};
use crate::adsblol::AdsbLolClient;
use crate::logic::geofence::{AirportZones, haversine_distance};
use crate::logic::phases::determine_phase;
use crate::logic::airport::{load_airport_data, AirportData};
use crate::logic::sequencing::{process_ground_traffic, RunwayContext};

#[derive(serde::Deserialize)]
struct SetAirportRequest {
    code: String,
}

struct AppState {
    aircraft: Mutex<HashMap<String, Aircraft>>,
    history: Mutex<HashMap<String, AircraftState>>,
    config: Config,
    airport_data: Option<Arc<AirportData>>,
    runway_context: Mutex<RunwayContext>,
    active_airport: Mutex<Option<String>>,
}

#[tokio::main]
async fn main() {
    // Load config
    let config = Config::from_env();
    
    // Load Airport Data
    let airport_data = load_airport_data().map(Arc::new);

    // Shared state
    let state = Arc::new(AppState {
        aircraft: Mutex::new(HashMap::new()),
        history: Mutex::new(HashMap::new()),
        config: config.clone(),
        airport_data: airport_data.clone(),
        runway_context: Mutex::new(RunwayContext::default()),
        active_airport: Mutex::new(None),
    });

    // Start Poller
    let poller_state = state.clone();
    tokio::spawn(async move {
        let client = AdsbLolClient::new();
        let zones = AirportZones::new(); 
        
        let mut interval = time::interval(Duration::from_secs(2)); 

        loop {
            interval.tick().await;
            
            // 1. Determine Active Airport
            let active_code = {
                let lock = poller_state.active_airport.lock().unwrap();
                lock.clone()
            };

            if let Some(target_code) = active_code {
                // Find config
                if let Some(airport) = poller_state.config.airports.iter().find(|a| a.code == target_code) {
                     match client.fetch_aircraft(airport.lat, airport.lon, airport.radius).await {
                        Ok(planes) => {
                             let planes_with_context: Vec<Aircraft> = planes.into_iter().filter_map(|mut p| {
                                 if p.origin_country == "Unknown" {
                                     p.origin_country = airport.code.clone();
                                 }
                                 
                                 // Spurious Ground Filter
                                 if p.on_ground {
                                     if let (Some(lat), Some(lon)) = (p.latitude, p.longitude) {
                                         let dist_km = haversine_distance(lat, lon, airport.lat, airport.lon);
                                         if dist_km > 5.5 {
                                             return None;
                                         }
                                     }
                                 }
                                 Some(p)
                             }).collect();
                            
                            // UPDATE STATE
                            let mut ac_lock = poller_state.aircraft.lock().unwrap();
                            let mut hist_lock = poller_state.history.lock().unwrap();
                            
                            // Prune aircraft NOT in the new list (Full Sync) to handle switching cleanly
                            // Or just standard update. 
                            // Better: prune anything not updated in this cycle if we want strict sync, 
                            // but standard logic prune stale (>60s) is defined below. 
                            // However, if we switched airport, we want to clear old ones. 
                            // The handler does the clear, so here we just update.
                            
                            let now_ts = chrono::Utc::now().timestamp();
                            
                            for mut plane in planes_with_context {
                                // Get history
                                let prev = hist_lock.get(&plane.icao24);
                                
                                // Determine Phase
                                let phase = determine_phase(&plane, prev, &zones);
                                plane.phase = phase; 
                                
                                // Maintain Ground State
                                if let Some(existing) = ac_lock.get(&plane.icao24) {
                                    plane.ground_state = existing.ground_state.clone();
                                    plane.atc_message = existing.atc_message.clone();
                                }

                                // Calculate ETA / DME
                                if phase == crate::models::Phase::Approach || phase == crate::models::Phase::Final {
                                    if let (Some(lat), Some(lon), Some(spd)) = (plane.latitude, plane.longitude, plane.velocity) {
                                        if spd > 10.0 {
                                            let dist_km = haversine_distance(lat, lon, airport.lat, airport.lon);
                                            let dist_nm = dist_km * 0.539957;
                                            plane.distance = Some(dist_nm);
                                            
                                            let time_hours = dist_nm / spd;
                                            let time_seconds = time_hours * 3600.0;
                                            plane.eta = Some(now_ts + time_seconds as i64);
                                        }
                                    }
                                }
                                
                                // Update History
                                let state_entry = AircraftState {
                                    icao24: plane.icao24.clone(),
                                    phase,
                                    last_update: now_ts,
                                };
                                hist_lock.insert(plane.icao24.clone(), state_entry);
                                
                                // Update Current View
                                ac_lock.insert(plane.icao24.clone(), plane);
                            }

                            // Prune stale aircraft (> 60s)
                            ac_lock.retain(|_, ac| {
                                (now_ts - ac.last_contact) < 60
                            });
                            
                            // Ground Logic
                            if let Some(ad) = &poller_state.airport_data {
                                let mut ctx_lock = poller_state.runway_context.lock().unwrap();
                                process_ground_traffic(&mut ac_lock, ad, &mut ctx_lock);
                            }

                        },
                        Err(e) => {
                            eprintln!("Error fetching for {}: {}", target_code, e);
                        }
                    }
                }
            } else {
                // No airport selected, do nothing or sleep longer
            }
        }
    });

    // Start Server
    let app = Router::new()
        .route("/api/states", get(get_states))
        .route("/api/airport", axum::routing::post(set_active_airport))
        .layer(CorsLayer::permissive())
        .with_state(state.clone());

    let addr = format!("0.0.0.0:{}", config.server_port);
    println!("Listening on {}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

async fn get_states(State(state): State<Arc<AppState>>) -> Json<Vec<Aircraft>> {
    let lock = state.aircraft.lock().unwrap();
    Json(lock.values().cloned().collect())
}

async fn set_active_airport(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<SetAirportRequest>,
) -> Json<String> {
    println!("Switching active airport to: {}", payload.code);
    
    // 1. Set Active Code
    {
        let mut lock = state.active_airport.lock().unwrap();
        *lock = Some(payload.code.clone());
    }

    // 2. Clear existing state to prevent ghost planes
    {
        let mut history_lock = state.history.lock().unwrap();
        history_lock.clear();
        
        let mut ac_lock = state.aircraft.lock().unwrap();
        ac_lock.clear();
        
        let mut ctx_lock = state.runway_context.lock().unwrap();
        *ctx_lock = RunwayContext::default();
    }

    Json("OK".to_string())
}
