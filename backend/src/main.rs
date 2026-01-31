mod config;
mod models;
mod opensky;
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
use crate::opensky::OpenSkyClient;
use crate::logic::geofence::AirportZones;
use crate::logic::phases::determine_phase;

struct AppState {
    aircraft: Mutex<HashMap<String, Aircraft>>,
    history: Mutex<HashMap<String, AircraftState>>,
    config: Config,
}

#[tokio::main]
async fn main() {
    // Load config
    let config = Config::from_env();
    
    // Shared state
    let state = Arc::new(AppState {
        aircraft: Mutex::new(HashMap::new()),
        history: Mutex::new(HashMap::new()),
        config: config.clone(),
    });

    // Start Poller
    let poller_state = state.clone();
    tokio::spawn(async move {
        let client = OpenSkyClient::new(&poller_state.config);
        let zones = AirportZones::new();
        let mut interval = time::interval(Duration::from_secs(10)); // OpenSky free limit is slow

        loop {
            interval.tick().await;
            // EGSS Bounding Box (approx)
            // Min Lat: 51.70 | Max Lat: 52.05
            // Min Lon: 0.00 | Max Lon: 0.50
            let bbox = (51.70, 0.00, 52.05, 0.50);
            
            match client.fetch_states(bbox).await {
                Ok(planes) => {
                    let mut ac_lock = poller_state.aircraft.lock().unwrap();
                    let mut hist_lock = poller_state.history.lock().unwrap();
                    
                    for mut plane in planes {
                        // Get history
                        let prev = hist_lock.get(&plane.icao24);
                        
                        // Determine Phase
                        let phase = determine_phase(&plane, prev, &zones);
                        plane.phase = phase;
                        
                        // Update History
                        let state_entry = AircraftState {
                            icao24: plane.icao24.clone(),
                            phase,
                            last_update: plane.time_position.unwrap_or(0),
                        };
                        hist_lock.insert(plane.icao24.clone(), state_entry);
                        
                        // Update Current View
                        ac_lock.insert(plane.icao24.clone(), plane);
                    }
                    // Prune old aircraft? (TODO)
                    println!("Updated {} aircraft", ac_lock.len());
                }
                Err(e) => {
                    eprintln!("Error fetching states: {}", e);
                }
            }
        }
    });

    // Start Server
    let app = Router::new()
        .route("/api/states", get(get_states))
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
