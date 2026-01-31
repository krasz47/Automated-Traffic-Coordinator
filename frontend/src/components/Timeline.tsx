import React from 'react';
import type { Aircraft } from '../types';

interface TimelineProps {
    aircraft: Aircraft[];
}

const Timeline: React.FC<TimelineProps> = ({ aircraft }) => {
    // Sort by some criteria (e.g., longitude/distance to runway)
    const sorted = [...aircraft].sort((a, b) => (a.baro_altitude || 0) - (b.baro_altitude || 0));

    return (
        <div style={{ width: '250px', background: '#2c2c2c', padding: '10px', overflowY: 'auto' }}>
            <h3>Sequence</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {sorted.map(ac => (
                    <div key={ac.icao24} style={{
                        padding: '8px',
                        background: '#333',
                        borderLeft: `4px solid ${ac.on_ground ? 'orange' : 'cyan'}`
                    }}>
                        <strong>{ac.callsign || ac.icao24}</strong>
                        <div style={{ fontSize: '0.8rem' }}>{ac.phase}</div>
                        <div style={{ fontSize: '0.8rem' }}>{ac.wake_category}</div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Timeline;
