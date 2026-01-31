# ATC (Automatic Traffic Coordinator) - System Design Document

**Project:** ATC
**Event:** ICHack 2024
**Type:** Solo Project
**Tracks:** Hudson River Trading (Data/Predictions), Best Travel Hack.

## 1. Project Overview
ATC is a **Decision Support System (DSS)** for Air Traffic Controllers at single-runway airports (specifically Stansted - EGSS). It ingests live ADS-B data to:
1.  **Predict** arrival times and wake turbulence conflicts.
2.  **Optimize** the landing sequence to minimize delays.
3.  **Identify** "Green Windows" for safe departure injections.
4.  **Automate** ground state logic (Arrivals vs. Departures) using geofencing.

**The Goal:** Reduce cognitive load for controllers and minimize fuel burn/delays for passengers.

---

## 2. Domain Logic & Physics (The "Rules")

### A. Wake Turbulence Separation Matrix (ICAO UK)
The system must flag any pair of arrival aircraft $(A, B)$ where $Distance(A, B) < Minimum$.

| Leader (A) | Follower (B) | Min Distance (nm) | Min Time (approx) |
| :--- | :--- | :--- | :--- |
| **Heavy** (B747, A330, B777) | **Light** (C172, PA28) | **6 nm** | 3 mins |
| **Heavy** | **Medium** (B737, A320) | **5 nm** | 2 mins |
| **Medium** | **Light** | **5 nm** | 3 mins |
| **Medium** | **Medium** | **3 nm** | ~90 sec |
| **Light** | **Any** | **3 nm** | ~60 sec |

* **Rule:** If `Current_Separation < Min_Distance`, Status = **CRITICAL**.
* **Correction:** "Slow Flight B by 20 kts".

### B. Runway Occupancy Time (ROT)
* **Average Landing ROT:** 50 seconds.
* **Average Departure ROT:** 60 seconds (Line up + Takeoff roll).
* **Safety Buffer:** +20 seconds.
* **Departure Injection Rule:** A departure can only be inserted between two arrivals if the gap time $\Delta T > 110$ seconds.

### C. Ground Logic (EGSS Specifics)
We use "Point-in-Polygon" to determine state.
* **Runway:** 04/22 (Orientation 044° / 224°).
* **Taxiway Juliet (J):** Inner parallel (East side). **Status:** Arrival / Taxi-In.
* **Taxiway Hotel (H):** Outer parallel (East side). **Status:** Departure / Queueing.

---

## 3. Data Source: OpenSky Network API

**Endpoint:** `GET https://opensky-network.org/api/states/all`
**Bounding Box (Stansted TMA):**
* Min Lat: `51.70` | Max Lat: `52.05`
* Min Lon: `0.00` | Max Lon: `0.50`

**Relevant Fields:**
* `icao24` (ID)
* `callsign` (String)
* `baro_altitude` (Meters -> Convert to Feet)
* `velocity` (m/s -> Convert to Knots)
* `true_track` (Degrees)
* `on_ground` (Bool)
* `vertical_rate` (m/s)

---

## 4. System Architecture

### Backend: Rust (`axum`, `tokio`, `geo`)
* **Responsibility:** "The Engine." Fetches data, runs the physics math, maintains state.
* **Loop:** Runs every 2 seconds.
* **State Machine:**
    * `AircraftState`: { Position, Velocity, Intent, Phase }
    * `Phase` Enum: `OnGround`, `TaxiOut`, `LineUp`, `TakeOff`, `Climb`, `Cruise`, `Descent`, `Approach`, `Final`, `Landed`.

### Frontend: TypeScript + React (Vite)
* **Responsibility:** "The Radar." Visualizes the state.
* **Components:**
    * **Map:** Leaflet/Mapbox showing moving dots.
    * **Timeline (The USP):** A Gantt-style vertical timeline showing "Occupied Runway Slots" and "Green Departure Windows."
    * **Command Feed:** A text list of suggested actions (e.g., *"Line up RYR123"*).

---

## 5. Key Algorithms (Pseudocode)

### A. Intent Detection
```rust
fn determine_phase(plane) -> Phase {
    if plane.on_ground {
        if plane.velocity > 80 kts { return Phase::TakeOff; } // or Landing Roll
        if juliet_poly.contains(plane.pos) { return Phase::TaxiIn; }
        if hotel_poly.contains(plane.pos) { return Phase::TaxiOut; }
        return Phase::OnBlock;
    }
    if plane.altitude < 2500ft && plane.vertical_rate < -2.0 {
        return Phase::Final;
    }
    // ... other phases
}