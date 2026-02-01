import React from 'react';
import type { Aircraft } from '../types';

interface SelectionPanelProps {
    aircraft: Aircraft | null;
}

const SelectionPanel: React.FC<SelectionPanelProps> = ({ aircraft }) => {
    if (!aircraft) {
        return (
            <div style={{ width: '250px', background: '#1e1e1e', padding: '10px', borderLeft: '1px solid #444', color: '#666' }}>
                <h3>Details</h3>
                <p>Select an aircraft on the map</p>
            </div>
        );
    }

    return (
        <div style={{ width: '250px', background: '#1e1e1e', padding: '10px', borderLeft: '1px solid #444' }}>
            <h3 style={{ borderBottom: '1px solid #444', paddingBottom: '5px' }}>
                {aircraft.callsign || aircraft.icao24}
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px', fontSize: '0.9rem' }}>
                <div style={{ color: '#aaa' }}>ICAO:</div>
                <div>{aircraft.icao24}</div>

                <div style={{ color: '#aaa' }}>Phase:</div>
                <div>{aircraft.phase}</div>

                <div style={{ color: '#aaa' }}>Wake:</div>
                <div>{aircraft.wake_category}</div>

                <div style={{ color: '#aaa' }}>Alt:</div>
                <div>{aircraft.baro_altitude?.toFixed(0)} ft</div>

                <div style={{ color: '#aaa' }}>Speed:</div>
                <div>{aircraft.velocity?.toFixed(0)} kts</div>

                <div style={{ color: '#aaa' }}>V/S:</div>
                <div>{aircraft.vertical_rate?.toFixed(0)} fpm</div>

                <div style={{ color: '#aaa' }}>Lat:</div>
                <div>{aircraft.latitude?.toFixed(4)}</div>

                <div style={{ color: '#aaa' }}>Lon:</div>
                <div>{aircraft.longitude?.toFixed(4)}</div>

                <div style={{ color: '#aaa' }}>Squawk:</div>
                <div>{aircraft.squawk || 'N/A'}</div>
            </div>

            <div style={{ marginTop: '20px', padding: '10px', background: '#333', borderRadius: '4px' }}>
                <strong>Actions</strong>
                <div style={{ display: 'flex', gap: '5px', marginTop: '5px' }}>
                    <button style={{ flex: 1, padding: '5px', cursor: 'pointer' }}>Route</button>
                    <button style={{ flex: 1, padding: '5px', cursor: 'pointer' }}>Hold</button>
                </div>
            </div>
        </div>
    );
};

export default SelectionPanel;
