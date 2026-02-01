use crate::models::{Aircraft, Phase};
use crate::logic::airport::AirportData;
use std::collections::HashMap;

pub struct RunwayContext {
    pub last_departure_time: i64,
}

impl Default for RunwayContext {
    fn default() -> Self {
        Self {
            last_departure_time: 0,
        }
    }
}

pub fn process_ground_traffic(aircraft_map: &mut HashMap<String, Aircraft>, airport_data: &AirportData, context: &mut RunwayContext) {
    let now = chrono::Utc::now().timestamp();
    
    // 1. Emergency Detection
    let emergency_active = aircraft_map.values().any(|a| {
        matches!(a.squawk.as_deref(), Some("7500" | "7600" | "7700"))
    });

    // 2. Snapshot arrivals for safety check & Approach Spacing
    let mut arrivals: Vec<Aircraft> = aircraft_map.values()
        .filter(|a| a.phase == Phase::Final || a.phase == Phase::Landing || a.phase == Phase::Approach)
        .cloned()
        .collect();
    
    // Sort by distance (descending - furthest first? No, we need relative order)
    arrivals.sort_by(|a, b| (a.distance.unwrap_or(999.0)).partial_cmp(&b.distance.unwrap_or(999.0)).unwrap());

    // Calculate Approach Spacing Advisories
    // We need to write back to the map.
    for i in 0..arrivals.len() {
        let mut advice = None;
        let ac = &arrivals[i];

        // 1. Go-Around Detection (Top Priority)
        // Only check if close to runway (< 4nm) and climbing substantially (> 400 fpm)
        if ac.distance.unwrap_or(99.0) < 4.0 && ac.vertical_rate.unwrap_or(0.0) > 400.0 {
            advice = Some("ABORTED APPROACH".to_string());
        }

        // 2. Spacing Advice (Only if no critical alert)
        if advice.is_none() && i > 0 {
             let preceding = &arrivals[i-1];
             let current = &arrivals[i];
             
             if let (Some(d1), Some(d2)) = (preceding.distance, current.distance) {
                 let gap = d2 - d1; // d2 is further out
                 
                 // Logic
                 if gap < 2.5 {
                     advice = Some("GO AROUND".to_string());
                 } else if gap < 3.0 {
                     advice = Some("MIN SPD".to_string());
                 } else if gap < 4.0 {
                     advice = Some("SLOW 160".to_string());
                 } else if gap < 5.0 {
                     advice = Some("MAINTAIN".to_string());
                 } else if gap > 7.0 && gap < 9.0 {
                     advice = Some("EXPEDITE".to_string());
                 }
             }
        }
        
        // Write back
        if let Some(msg) = advice {
             if let Some(entry) = aircraft_map.get_mut(&arrivals[i].icao24) {
                 entry.advisory = Some(msg);
             }
        }
    }

    // Refresh arrivals snapshot for ground safety (exclude those explicitly not on final)
    let final_traffic: Vec<Aircraft> = arrivals.iter().filter(|a| a.distance.unwrap_or(99.0) < 5.0).cloned().collect();

    // 3. Iterate ground traffic
    for aircraft in aircraft_map.values_mut() {
        if !aircraft.on_ground {
            continue;
        }

        // Initialize state if missing
        if aircraft.ground_state.is_none() {
             // Determine initial state based on location
             if let Some((stand, dist)) = airport_data.egss.find_nearest_stand(aircraft.latitude.unwrap_or(0.0), aircraft.longitude.unwrap_or(0.0)) {
                 if dist < 0.001 {
                     aircraft.ground_state = Some("OnStand".to_string());
                     aircraft.atc_message = Some(format!("Stand {}", stand.name));
                 } else {
                     aircraft.ground_state = Some("Taxiing".to_string());
                 }
             }
        }

        let speed = aircraft.velocity.unwrap_or(0.0);
        let lat = aircraft.latitude.unwrap_or(0.0);
        let lon = aircraft.longitude.unwrap_or(0.0);

        // Emergency Override
        if emergency_active {
             let is_emergency_ac = matches!(aircraft.squawk.as_deref(), Some("7500" | "7600" | "7700"));
             if !is_emergency_ac {
                  aircraft.atc_message = Some("AIRPORT CLOSED - EMERGENCY IN PROGRESS".to_string());
                  continue; 
             }
        }

        // State Machine
        match aircraft.ground_state.as_deref() {
            Some("OnStand") => {
                if speed > 2.0 {
                    aircraft.ground_state = Some("Pushback".to_string());
                    aircraft.atc_message = Some("Pushback Approved".to_string());
                }
            },
            Some("Pushback") => {
                if speed > 5.0 {
                    aircraft.ground_state = Some("Taxiing".to_string());
                    aircraft.atc_message = Some("Taxi to Runway".to_string()); 
                }
            },
            Some("Taxiing") => {
                // Check if approaching a Hold
                if let Some((hold, dist)) = airport_data.egss.find_nearest_hold(lat, lon) {
                    if dist < 0.002 { 
                         aircraft.ground_state = Some("Holding".to_string());
                         aircraft.atc_message = Some(format!("Hold Short {}", hold.name));
                         aircraft.hold_time = Some(now); // Start Timer
                    }
                }
            },
            Some("Holding") => {
                 // Stagnation Check
                 if let Some(t) = aircraft.hold_time {
                     if (now - t) > 180 { // 3 mins
                          aircraft.atc_message = Some("REMINDER: AWAITING TAKEOFF".to_string());
                          // We don't return here, we still check if we can clear them. 
                          // If we clear them, the message will be overwritten below, which is correct (problem solved).
                     }
                 }

                 if let Some((_hold, dist)) = airport_data.egss.find_nearest_hold(lat, lon) {
                    if dist > 0.003 {
                         aircraft.ground_state = Some("LiningUp".to_string());
                         aircraft.atc_message = Some("Line Up & Wait".to_string());
                         aircraft.hold_time = None; // Reset
                    } else {
                        // Still at Hold -> Check Checks
                        let (runway_clear, gap_msg) = is_runway_clear(&final_traffic);
                        if !runway_clear {
                             // Only overwrite Stagnation warning if there is a valid reason to hold
                             aircraft.atc_message = Some(gap_msg);
                        } else {
                            // Check Wake Turbulence Timer
                            let time_since_dep = now - context.last_departure_time;
                            if time_since_dep < 120 { 
                                 aircraft.atc_message = Some(format!("Hold Short - Wake Turbulence ({}s)", 120 - time_since_dep));
                            } else {
                                 aircraft.atc_message = Some("Cleared for Takeoff".to_string());
                            }
                        }
                    }
                }
            },
            Some("LiningUp") => {
                match aircraft.atc_message.as_deref() {
                    Some("Cleared for Takeoff") => {
                         // Already cleared, just waiting for them to roll
                    },
                     _ => {
                        // Re-check safety while lining up?
                        // If they are lining up, they might have been cleared previously or just entered.
                        // Assuming valid LineUp. Check if they start rolling.
                     }
                }

                if speed > 40.0 {
                    aircraft.ground_state = Some("Takeoff".to_string());
                    aircraft.atc_message = Some("Takeoff Roll".to_string());
                    // Update Timer
                    context.last_departure_time = now;
                }
            },
            _ => {}
        }
    }
}

fn is_runway_clear(arrivals: &[Aircraft]) -> (bool, String) {
    let thresh_lat = 51.895;
    let thresh_lon = 0.250;

    for arr in arrivals {
        let lat = arr.latitude.unwrap_or(0.0);
        let lon = arr.longitude.unwrap_or(0.0);
        let dist = ((lat - thresh_lat).powi(2) + (lon - thresh_lon).powi(2)).sqrt();
        
        // 0.08 deg ~ 4-5nm. 0.05 ~ 3nm.
        if dist < 0.08 && arr.baro_altitude.unwrap_or(0.0) < 2000.0 {
            return (false, format!("Hold Short - Traffic Final ({:.1}nm)", dist * 60.0)); // Approx conversion for display
        }
    }
    (true, String::new())
}
