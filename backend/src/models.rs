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
    pub category: Option<String>,
    pub ground_state: Option<String>, // e.g., "OnStand", "Pushback", "Taxiing"
    pub atc_message: Option<String>, // e.g., "Hold Short H1"
    pub eta: Option<i64>, // Estimated Time of Arrival (timestamp)
    pub distance: Option<f64>, // Distance to Touchdown (nm)
    pub advisory: Option<String>, // e.g., "SLOW 160", "EXPEDITE"
    pub hold_time: Option<i64>, // Timestamp when entered Holding state
}

impl Default for Aircraft {
    fn default() -> Self {
        Aircraft {
            icao24: String::new(),
            callsign: None,
            origin_country: String::new(),
            time_position: None,
            last_contact: 0,
            longitude: None,
            latitude: None,
            baro_altitude: None,
            on_ground: false,
            velocity: None,
            true_track: None,
            vertical_rate: None,
            geo_altitude: None,
            squawk: None,
            spi: false,
            position_source: 0,
            phase: Phase::Unknown,
            wake_category: WakeCategory::Unknown,
            category: None,
            ground_state: None,
            atc_message: None,
            eta: None,
            distance: None,
            advisory: None,
            hold_time: None,
        }
    }
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
