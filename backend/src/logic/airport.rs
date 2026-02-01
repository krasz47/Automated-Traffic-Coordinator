use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::Path;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Coordinate {
    pub lat: f64,
    pub lon: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Taxiway {
    pub name: String,
    pub type_: String, // "gap" or "taxiway"; mapped from "type" in json
    pub coordinates: Vec<Vec<Vec<f64>>>, // GeoJSON MultiLineString-ish
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Node {
    pub name: String,
    pub lat: f64,
    pub lon: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Airport {
    pub taxiways: Vec<Taxiway>,
    pub holds: Vec<Node>,
    pub stands: Vec<Node>,
    pub runways: Vec<Runway>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Runway {
    pub name: String,
    pub threshold: [f64; 2],
    pub heading: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AirportData {
    #[serde(rename = "EGSS")]
    pub egss: Airport,
}

impl Airport {
    pub fn find_nearest_stand(&self, lat: f64, lon: f64) -> Option<(&Node, f64)> {
        let mut nearest = None;
        let mut min_dist = f64::MAX;

        for stand in &self.stands {
            let dist = ((stand.lat - lat).powi(2) + (stand.lon - lon).powi(2)).sqrt();
            if dist < min_dist {
                min_dist = dist;
                nearest = Some(stand);
            }
        }
        
        nearest.map(|n| (n, min_dist))
    }

    pub fn find_nearest_hold(&self, lat: f64, lon: f64) -> Option<(&Node, f64)> {
        let mut nearest = None;
        let mut min_dist = f64::MAX;

        for hold in &self.holds {
            let dist = ((hold.lat - lat).powi(2) + (hold.lon - lon).powi(2)).sqrt();
            if dist < min_dist {
                min_dist = dist;
                nearest = Some(hold);
            }
        }
        
        nearest.map(|n| (n, min_dist))
    }
}

pub fn load_airport_data() -> Option<AirportData> {
    // Path relative to backend execution usually
    let paths = [
        "../frontend/src/airport_data.json",
        "frontend/src/airport_data.json", 
        "/home/akra/Dev/Automated-Traffic-Coordinator/frontend/src/airport_data.json"
    ];

    for p in paths {
        if Path::new(p).exists() {
            if let Ok(content) = fs::read_to_string(p) {
                if let Ok(data) = serde_json::from_str::<AirportData>(&content) {
                    println!("Loaded airport data from {}", p);
                    return Some(data);
                } else {
                    println!("Failed to parse JSON from {}", p);
                }
            }
        }
    }
    
    println!("Could not find airport_data.json");
    None
}
