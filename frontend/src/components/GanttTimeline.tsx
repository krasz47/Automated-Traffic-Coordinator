import React from 'react';
import type { Aircraft } from '../types';

interface TimelineProps {
    aircraft: Aircraft[];
}

const GanttTimeline: React.FC<TimelineProps> = ({ aircraft }) => {
    // Filter generic traffic relevant for sequencing
    const relevant = aircraft.filter(a =>
        a.phase === "Final" || a.phase === "Approach" || a.phase === "LineUp" || a.phase === "TakeOff"
    );

    // Sort by estimated distance to runway instead of altitude
    // EGSS Ref: 51.885, 0.235
    const dist = (lat: number, lon: number) => {
        return Math.sqrt(Math.pow(lat - 51.885, 2) + Math.pow(lon - 0.235, 2));
    };

    const sorted = [...relevant].sort((a, b) => {
        const distA = dist(a.latitude || 0, a.longitude || 0);
        const distB = dist(b.latitude || 0, b.longitude || 0);

        // Prioritize ground traffic for departure if ready? 
        // For now, let's keep arrivals and departures mixed but sorted by "progress"
        // This is tricky for mixed mode. Let's just sort arrivals by distance, departures by FIFO (mocked)
        return distA - distB;
    });

    return (
        <div style={{ width: '300px', background: '#222', borderRight: '1px solid #444', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '10px', background: '#333', fontWeight: 'bold' }}>Runway Sequence</div>
            <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                {/* Time Axis (Mock) */}
                <div style={{ position: 'absolute', top: 0, bottom: 0, left: '50px', width: '2px', background: '#555' }}></div>

                {sorted.map((ac) => {
                    // ETA Calculation: Time = Distance / Speed
                    // Dist is in deg lat/lon approx. Need to convert to NM.
                    // 1 deg lat ~= 60nm.
                    // ETA (mins) = (Dist(nm) / Speed(kts)) * 60
                    const dLat = (ac.latitude || 0) - 51.885;
                    const dLon = (ac.longitude || 0) - 0.235;
                    const distDeg = Math.sqrt(dLat * dLat + dLon * dLon);
                    const distNm = distDeg * 60;
                    const speed = ac.velocity || 140; // Default to approach speed if 0/unknown
                    const etaMins = (distNm / (speed < 10 ? 140 : speed)) * 60;

                    // Visualization scaling: 1 min = 20px
                    const topOffset = etaMins * 20;

                    return (
                        <div key={ac.icao24} style={{
                            position: 'absolute',
                            top: `${topOffset}px`,
                            left: '10px',
                            right: '10px',
                            height: '50px',
                            background: ac.on_ground ? '#4a3b18' : '#183b4a',
                            border: `1px solid ${ac.on_ground ? 'orange' : 'cyan'}`,
                            borderRadius: '4px',
                            padding: '4px',
                            fontSize: '0.8rem',
                            zIndex: 2
                        }}>
                            <div style={{ fontWeight: 'bold' }}>{ac.callsign || ac.icao24}</div>
                            <div>{ac.phase} | {ac.wake_category}</div>
                            <div style={{ position: 'absolute', right: '4px', top: '4px', fontSize: '0.7em', color: '#aaa' }}>
                                {etaMins.toFixed(1)}m
                            </div>
                        </div>
                    );
                })}

                {/* Green Window Indicators (Mock) */}
                <div style={{
                    position: 'absolute',
                    top: '150px',
                    left: '60px',
                    right: '10px',
                    height: '2px',
                    borderTop: '2px dashed #4caf50'
                }}>
                    <span style={{ color: '#4caf50', background: '#222', fontSize: '0.7rem', padding: '0 4px' }}>
                        Departure Window (GAP &gt; 2min)
                    </span>
                </div>

            </div>
        </div>
    );
};

export default GanttTimeline;
