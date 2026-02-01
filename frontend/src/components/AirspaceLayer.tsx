import React from 'react';
import { Polygon, Circle, Tooltip } from 'react-leaflet';

// Approximate Coordinates for Stansted Airspace Zones
// Refined based on research

const CTA_COORDS: [number, number][] = [
    [51.8, 0.1],
    [52.0, 0.1],
    [52.0, 0.4],
    [51.8, 0.4],
];

const TMA_COORDS: [number, number][] = [
    [51.7, 0.0],
    [52.1, 0.0],
    [52.1, 0.5],
    [51.7, 0.5],
];

const TMZ_COORDS: [number, number][] = [
    [51.85, 0.2],
    [51.92, 0.2],
    [51.92, 0.27],
    [51.85, 0.27],
];

// Holding Stacks
// ABBOT: 52° 0' 58" N, 0° 35' 58" E => 52.016, 0.599
// LOREL (LOREX): 52° 0' 50" N, 0° 3' 10" W => 52.013, -0.052
const ABBOT_POS: [number, number] = [52.016, 0.599];
const LOREL_POS: [number, number] = [52.013, -0.052];

const AirspaceLayer: React.FC = () => {
    return (
        <>
            <Polygon positions={TMA_COORDS} pathOptions={{ color: 'blue', fillOpacity: 0.05, dashArray: '5, 5', weight: 1 }}>
                <Tooltip sticky>London TMA</Tooltip>
            </Polygon>

            <Polygon positions={CTA_COORDS} pathOptions={{ color: 'purple', fillOpacity: 0.1, weight: 1 }}>
                <Tooltip sticky>Stansted CTA</Tooltip>
            </Polygon>

            <Polygon positions={TMZ_COORDS} pathOptions={{ color: 'red', fillOpacity: 0.0, dashArray: '2, 4', weight: 2 }}>
                <Tooltip sticky>Stansted TMZ</Tooltip>
            </Polygon>

            {/* Holding Stacks */}
            <Circle center={ABBOT_POS} radius={3000} pathOptions={{ color: 'orange', fillOpacity: 0.0, dashArray: '4, 4' }}>
                <Tooltip sticky>ABBOT Hold</Tooltip>
            </Circle>
            <Circle center={LOREL_POS} radius={3000} pathOptions={{ color: 'orange', fillOpacity: 0.0, dashArray: '4, 4' }}>
                <Tooltip sticky>LOREL Hold</Tooltip>
            </Circle>
        </>
    );
};

export default AirspaceLayer;
