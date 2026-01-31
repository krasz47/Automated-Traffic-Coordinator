use crate::config::Config;
use crate::models::{Aircraft, Phase, WakeCategory};
use reqwest::Client;
use serde::Deserialize;
use std::error::Error;

pub struct OpenSkyClient {
    client: Client,
    base_url: String,
    username: Option<String>,
    password: Option<String>,
}

#[derive(Deserialize, Debug)]
pub struct OpenSkyResponse {
    pub time: i64,
    pub states: Option<Vec<StateVector>>,
}

// OpenSky returns a specific format where states are arrays of mixed types.
// We use a custom deserializer or just generic Value if simple, but a struct is better if possible.
// Actually, OpenSky states are JSON arrays: [icao24, callsign, origin_country, time_position, last_contact, long, lat, baro_alt, on_ground, velocity, true_track, vertical_rate, sensors, geo_alt, squawk, spi, position_source]
// Using a struct with serde(deserialize_with = "...") is complex. 
// A simpler approach for this prototype is to deserialise to `serde_json::Value` and map manually.

#[derive(Deserialize, Debug)]
pub struct StateVector(
    pub String, // icao24
    pub Option<String>, // callsign
    pub String, // origin_country
    pub Option<i64>, // time_position
    pub i64, // last_contact
    pub Option<f64>, // longitude
    pub Option<f64>, // latitude
    pub Option<f64>, // baro_altitude
    pub bool, // on_ground
    pub Option<f64>, // velocity
    pub Option<f64>, // true_track
    pub Option<f64>, // vertical_rate
    pub Option<Vec<i32>>, // sensors
    pub Option<f64>, // geo_altitude
    pub Option<String>, // squawk
    pub bool, // spi
    pub i32, // position_source
);

impl OpenSkyClient {
    pub fn new(config: &Config) -> Self {
        OpenSkyClient {
            client: Client::new(),
            base_url: "https://opensky-network.org/api".to_string(),
            username: config.opensky_username.clone(),
            password: config.opensky_password.clone(),
        }
    }

    pub async fn fetch_states(&self, bbox: (f64, f64, f64, f64)) -> Result<Vec<Aircraft>, Box<dyn Error>> {
        let (min_lat, min_lon, max_lat, max_lon) = bbox;
        let url = format!("{}/states/all?lamin={}&lomin={}&lamax={}&lomax={}", 
            self.base_url, min_lat, min_lon, max_lat, max_lon);

        let mut request = self.client.get(&url);
        
        if let (Some(u), Some(p)) = (&self.username, &self.password) {
            request = request.basic_auth(u, Some(p));
        }

        let resp_text = request.send().await?.text().await?;
        // println!("Raw OpenSky Resp: {}", resp_text); // For debugging
        
        let response: OpenSkyResponse = serde_json::from_str(&resp_text)?;

        let aircraft_list = response.states.unwrap_or_default().into_iter().map(|s| {
            Aircraft {
                icao24: s.0,
                callsign: s.1.map(|c| c.trim().to_string()),
                origin_country: s.2,
                time_position: s.3,
                last_contact: s.4,
                longitude: s.5,
                latitude: s.6,
                baro_altitude: s.7.map(|x| x * 3.28084), // Convert meters to feet
                on_ground: s.8,
                velocity: s.9.map(|x| x * 1.94384), // Convert m/s to knots
                true_track: s.10,
                vertical_rate: s.11.map(|x| x * 196.85), // Convert m/s to fpm
                geo_altitude: s.13.map(|x| x * 3.28084),
                squawk: s.14,
                spi: s.15,
                position_source: s.16,
                phase: Phase::Unknown, // To be calculated
                wake_category: WakeCategory::Unknown, // To be filled
            }
        }).collect();

        Ok(aircraft_list)
    }
}
