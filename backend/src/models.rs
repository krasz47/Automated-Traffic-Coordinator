use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Aircraft {
    pub icao24: String,
    pub callsign: Option<String>,
    pub origin_country: String,
    pub time_position: Option<i64>,
    pub last_contact: i64,
    pub longitude: Option<f64>,
    pub latitude: Option<f64>,
    pub baro_altitude: Option<f64>,
    pub on_ground: bool,
    pub velocity: Option<f64>,
    pub true_track: Option<f64>,
    pub vertical_rate: Option<f64>,
    pub geo_altitude: Option<f64>,
    pub squawk: Option<String>,
    pub spi: bool,
    pub position_source: i32,
    // Augmented fields
    pub phase: Phase,
    pub wake_category: WakeCategory,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Phase {
    Unknown,
    OnBlock,
    Pushback,
    TaxiOut,
    LineUp,
    TakeOff,
    Climb,
    Cruise,
    Descent,
    Approach,
    Final,
    Landing,
    TaxiIn,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum WakeCategory {
    Light,
    Medium,
    Heavy,
    Super,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AircraftState {
   pub icao24: String,
   pub phase: Phase,
   pub last_update: i64,
}
