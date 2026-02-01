use crate::models::{Aircraft, AircraftState, Phase};
use crate::logic::geofence::AirportZones;

pub fn determine_phase(
    aircraft: &Aircraft, 
    prev_state: Option<&AircraftState>, 
    zones: &AirportZones
) -> Phase {
    if let Some(cat) = &aircraft.category {
        if cat.starts_with('C') {
            return Phase::TaxiIn; // Simplification: Ground vehicles are always "Taxiing" or "OnBlock"
        }
    }

    if !aircraft.on_ground {
        // Airborne Logic
        let alt = aircraft.baro_altitude.unwrap_or(0.0);
        let vertical_rate = aircraft.vertical_rate.unwrap_or(0.0);
        let track = aircraft.true_track.unwrap_or(0.0);
        let lat = aircraft.latitude.unwrap_or(0.0);
        let lon = aircraft.longitude.unwrap_or(0.0);

        // Stansted (EGSS) Centroid Approx: 51.885, 0.235
        // Runway 04 Heading: ~44 deg | Runway 22 Heading: ~224 deg
        
        // Check alignment for Final
        // Logic: Low altitude + Descent + Aligned Heading + Correct Quadrant
        
        let is_aligned_22 = (track - 224.0).abs() < 15.0; // Runway 22 Approach
        let is_aligned_04 = (track - 44.0).abs() < 15.0;  // Runway 04 Approach

        let is_ne_quadrant = lat > 51.885 && lon > 0.235; // For Ry 22
        let is_sw_quadrant = lat < 51.885 && lon < 0.235; // For Ry 04

        if vertical_rate < -300.0 && alt < 5000.0 {
            if alt < 2500.0 {
                if (is_aligned_22 && is_ne_quadrant) || (is_aligned_04 && is_sw_quadrant) {
                    return Phase::Final;
                }
            }
            return Phase::Approach; // Descent but not aligned/low enough
        }
        if alt > 2000.0 && vertical_rate.abs() < 500.0 {
            return Phase::Cruise; 
        }
        if vertical_rate > 300.0 {
            return Phase::Climb;
        }
        return Phase::Unknown;
    }

    // Ground Logic
    let speed = aircraft.velocity.unwrap_or(0.0);
    let lat = aircraft.latitude.unwrap_or(0.0);
    let lon = aircraft.longitude.unwrap_or(0.0);
    let zone = zones.check_zone(lat, lon);
    
    // High speed on ground -> TakeOff or Landing
    if speed > 60.0 {
        if let Some(prev) = prev_state {
             match prev.phase {
                 Phase::Final | Phase::Landing | Phase::Approach => return Phase::Landing,
                 Phase::TaxiOut | Phase::LineUp | Phase::TakeOff => return Phase::TakeOff,
                 _ => {} // Ambiguous: infer from zone
             }
        }
        // Fallback if no history
        if let Some(z) = zone.as_deref() {
            if z == "Runway" {
                // Heuristic: Accelerating means Takeoff? Not available in single snapshot easily without acc.
                // We'll rely on history mostly. Default to TakeOff if unknown?
                // Or maybe check vertical rate just before? 
                return Phase::TakeOff; 
            }
        }
        return Phase::Unknown;
    }

    // Low speed logic
    if let Some(z) = zone.as_deref() {
        match z {
             "TaxiwayJ" => return Phase::TaxiIn, // Per EGSS rules
             "TaxiwayH" => return Phase::TaxiOut,
             "Runway" => return Phase::LineUp, // Or clearing runway
             _ => {}
        }
    }
    
    // Fallback: Use history
    if let Some(prev) = prev_state {
        // Hysteresis / Momentum
        return prev.phase; 
    }

    Phase::OnBlock
}
