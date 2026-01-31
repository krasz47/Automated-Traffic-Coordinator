import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { Aircraft } from '../types';
import L from 'leaflet';

// Plane Icon SVG as a function of rotation and color
const createPlaneIcon = (track: number, altitude: number) => {
    // Color scaling based on altitude (FlightRadar24-ish)
    // < 1000: Yellow/White
    // 1000-5000: Green
    // 5000-10000: Light Blue
    // > 10000: Purple
    let color = '#ffffff';
    if (altitude < 1000) color = '#ffeb3b'; // Yellow (Low/Ground)
    else if (altitude < 5000) color = '#4caf50'; // Green (Approach)
    else if (altitude < 20000) color = '#03a9f4'; // Light Blue
    else color = '#9c27b0'; // Purple (Cruise)

    if (altitude === 0 || altitude === undefined) color = '#ff9800'; // Orange (Ground likely)

    // SVG Icon
    const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" style="transform: rotate(${track}deg); transform-origin: center;">
        <path fill="${color}" stroke="#000" stroke-width="1" d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
    </svg>`;

    return L.divIcon({
        className: 'custom-plane-icon',
        html: svg,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
    });
};

interface MapProps {
    aircraft: Aircraft[];
}

// EGSS
const EGSS_CENTER: [number, number] = [51.885, 0.235];

const MapComponent: React.FC<MapProps> = ({ aircraft }) => {
    return (
        <MapContainer center={EGSS_CENTER} zoom={11} style={{ height: "100%", width: "100%" }}>
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            />
            {aircraft.map((ac) => {
                const track = ac.true_track || 0;
                const alt = ac.baro_altitude || 0;
                return (
                    <Marker
                        key={ac.icao24}
                        position={[ac.latitude || 0, ac.longitude || 0]}
                        icon={createPlaneIcon(track, alt)}
                    >
                        <Popup>
                            <strong>{ac.callsign || ac.icao24}</strong><br />
                            Alt: {ac.baro_altitude?.toFixed(0)} ft<br />
                            Spd: {ac.velocity?.toFixed(0)} kts<br />
                            Hdg: {track.toFixed(0)}°<br />
                            Phase: {ac.phase}
                        </Popup>
                    </Marker>
                );
            })}

            {/* Runway Outline */}
            <Polyline positions={[
                [51.875, 0.22],
                [51.895, 0.25]
            ]} color="#ff5252" weight={3} />

            {/* Extended Centerlines for Visual Ref (approx 5nm) */}
            <Polyline positions={[
                [51.875, 0.22],
                [51.8, 0.12]
            ]} color="#555" weight={1} dashArray="5, 10" />
            <Polyline positions={[
                [51.895, 0.25],
                [51.97, 0.35]
            ]} color="#555" weight={1} dashArray="5, 10" />

        </MapContainer>
    );
};

export default MapComponent;
