use crate::models::{Aircraft, Phase, WakeCategory};
use reqwest::Client;
use serde::Deserialize;
use std::error::Error;

pub struct AdsbLolClient {
    client: Client,
    base_url: String,
}

#[derive(Deserialize, Debug)]
pub struct AdsbLolResponse {
    pub ac: Option<Vec<AdsbLolAircraft>>,
}

#[derive(Deserialize, Debug)]
pub struct AdsbLolAircraft {
    pub hex: String,
    pub flight: Option<String>,
    pub lat: Option<f64>,
    pub lon: Option<f64>,
    pub alt_baro: Option<serde_json::Value>, // Can be "ground" or number
    pub alt_geom: Option<i32>,
    pub gs: Option<f64>,
    pub track: Option<f64>,
    pub baro_rate: Option<i32>,
    pub squawk: Option<String>,
    pub category: Option<String>,
}

impl AdsbLolClient {
    pub fn new() -> Self {
        AdsbLolClient {
            client: Client::new(),
            base_url: "https://api.adsb.lol/v2".to_string(),
        }
    }

    pub async fn fetch_aircraft(&self, lat: f64, lon: f64, radius_nm: u32) -> Result<Vec<Aircraft>, Box<dyn Error>> {
        let url = format!("{}/point/{}/{}/{}", self.base_url, lat, lon, radius_nm);
        
        let resp_text = self.client.get(&url)
            .send()
            .await?
            .text()
            .await?;
            
        let response: AdsbLolResponse = serde_json::from_str(&resp_text)?;
        
        // Helper to parse "ground" or number for altitude
        fn parse_alt(alt: &Option<serde_json::Value>) -> (Option<f64>, bool) {
            match alt {
                Some(v) => {
                    if let Some(s) = v.as_str() {
                        if s == "ground" {
                            return (Some(0.0), true);
                        }
                    }
                    if let Some(n) = v.as_f64() {
                        return (Some(n), false);
                    }
                     if let Some(n) = v.as_i64() {
                        return (Some(n as f64), false);
                    }
                    (None, false)
                },
                None => (None, false),
            }
        }

        let aircraft_list = response.ac.unwrap_or_default().into_iter().map(|s| {
            let (baro_alt, on_ground_flag) = parse_alt(&s.alt_baro);
            
            Aircraft {
                icao24: s.hex,
                callsign: s.flight.map(|c| c.trim().to_string()),
                origin_country: "Unknown".to_string(), // API doesn't allow easy country lookup without db
                time_position: None, // API doesn't send timestamp per plane usually, assume NOW
                last_contact: chrono::Utc::now().timestamp(),
                longitude: s.lon,
                latitude: s.lat,
                baro_altitude: baro_alt,
                on_ground: on_ground_flag, // Logic can be improved
                velocity: s.gs,
                true_track: s.track,
                vertical_rate: s.baro_rate.map(|r| r as f64),
                geo_altitude: s.alt_geom.map(|a| a as f64),
                squawk: s.squawk,
                spi: false,
                position_source: 0,
                phase: Phase::Unknown, 
                wake_category: WakeCategory::Unknown,
                category: s.category,
                ground_state: None,
                atc_message: None,
                eta: None,
                distance: None,
                advisory: None,
                hold_time: None,
            }
        }).collect();

        Ok(aircraft_list)
    }
}
