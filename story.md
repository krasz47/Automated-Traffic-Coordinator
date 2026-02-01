# Automated Traffic Coordinator

## What it does
The Automated Traffic Coordinator is an advanced visualisation tool acting as a Surface Movement Radar (SMR) and Terminal Approach display. Its primary goal is to reduce airport delays by intelligently drawing attention to specific congestion points. It actively monitors aircraft spacing and runway occupancy, specifying how traffic should be ordered to maximise efficiency and minimise the frustration of ground delays.

## Why
The project was inspired by a frustrating real-world travel experience. A friend of mine took a flight that had a flight time of only **1 hour and 40 minutes**, but upon arrival at Heathrow, they were stuck **taxiing for an hour and a half**, followed by another hour wait for baggage. The realisation that the **delays on the ground lasted longer than the flight itself** highlighted a massive inefficiency in airport coordination that this software aims to address.

## How we built it
I built this system using **Rust** for the high-performance backend to handle live ADS-B data streams, and **TypeScript** for the responsive frontend interface. I developed it with the assistance of **Antigravity** as an AI pair programmer. The project was chosen specifically to help me learn and implement advanced **Rust** features like async runtimes and strict type safety in a real-world context, while also diving deep into the technical domain of Air Traffic Control.

## What we learnt
Through building this, I learnt valuable lessons about the complexity of the Air Traffic Control environment—specifically how Approach Control and Ground Control interact. Technically, I mastered advanced areas of Rust, learning how to manage complex, concurrent state safely and efficiently.

## What's next for Automated Traffic Coordinator
The next step is to expand the system's scope beyond the immediate terminal area. I plan to implement sequencing and flight plan analysis across the **Main Upper and Lower Airways**. This would allow the system to optimize traffic flow hundreds of miles out, ensuring aircraft arrive at the terminal area already perfectly sequenced, rather than just managing them once they arrive.
