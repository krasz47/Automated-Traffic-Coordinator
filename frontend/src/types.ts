export type Phase =
    | "Unknown"
    | "OnBlock"
    | "Pushback"
    | "TaxiOut"
    | "LineUp"
    | "TakeOff"
    | "Climb"
    | "Cruise"
    | "Descent"
    | "Approach"
    | "Final"
    | "Landing"
    | "TaxiIn";

export type WakeCategory =
    | "Light"
    | "Medium"
    | "Heavy"
    | "Super"
    | "Unknown";

export interface Aircraft {
    icao24: string;
    callsign?: string;
    origin_country: string;
    time_position?: number;
    last_contact: number;
    longitude?: number;
    latitude?: number;
    baro_altitude?: number; // Feet
    on_ground: boolean;
    velocity?: number; // Knots
    true_track?: number;
    vertical_rate?: number; // FPM
    geo_altitude?: number;
    squawk?: string;
    spi: boolean;
    position_source: number;

    // Augmented
    phase: Phase;
    wake_category: WakeCategory;
}
