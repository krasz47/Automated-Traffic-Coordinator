import React, { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, useMap, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { Aircraft } from '../types';
import L from 'leaflet';
import airportDataRaw from '../airport_data.json';

// Bearing calculation with wraparound handling
const calcBearing = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const toRad = (deg: number) => deg * Math.PI / 180;
    const toDeg = (rad: number) => rad * 180 / Math.PI;

    const phi1 = toRad(lat1);
    const phi2 = toRad(lat2);
    const lam1 = toRad(lon1);
    const lam2 = toRad(lon2);

    const y = Math.sin(lam2 - lam1) * Math.cos(phi2);
    const x = Math.cos(phi1) * Math.sin(phi2) -
        Math.sin(phi1) * Math.cos(phi2) * Math.cos(lam2 - lam1);

    let brg = toDeg(Math.atan2(y, x));
    return (brg + 360) % 360;
};

// Plane Icon Generator
const createPlaneIcon = (track: number, altitude: number, isHighDensity: boolean, category?: string) => {
    const isGroundVehicle = category?.startsWith('C');

    let size = 24;
    // Scale based on weight category
    if (category === 'A5') size = 32; // Heavy
    if (category === 'A3') size = 28; // Large
    if (category === 'A1') size = 18; // Light
    if (isGroundVehicle) size = 16;

    let color = '#ffffff';
    if (isGroundVehicle) {
        color = '#ff9800'; // Orange
    } else {
        // Altitude Color Coding
        if (altitude < 1000) color = '#ffeb3b'; // Low/Taxi
        else if (altitude < 5000) color = '#4caf50'; // Approach
        else if (altitude < 20000) color = '#03a9f4';
        else color = '#9c27b0'; // Cruise

        if (altitude === 0) color = '#ffeb3b';
    }

    const stroke = isHighDensity ? '#ff0000' : '#000';
    const strokeWidth = isHighDensity ? '2' : '1';

    let svgPath = `M12 2 L22 20 L12 17 L2 20 Z`; // Default Jet
    if (isGroundVehicle) {
        svgPath = `M4 4h16v16H4z`; // Square for ground vehicles
    }

    const rotation = track || 0;

    const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" style="transform: rotate(${rotation}deg); transform-origin: center;">
        <path fill="${color}" stroke="${stroke}" stroke-width="${strokeWidth}" d="${svgPath}"/>
    </svg>`;

    return L.divIcon({
        className: 'custom-plane-icon',
        html: svg,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
    });
};

interface MapProps {
    aircraft: Aircraft[];
    activeAirport: string;
    onSelect?: (ac: Aircraft) => void;
}

const AIRPORTS = {
    EGSS: { name: "Stansted (EGSS)", center: [51.885, 0.235] as [number, number], zoom: 14 },
    KLAX: { name: "Los Angeles (KLAX)", center: [33.942, -118.407] as [number, number], zoom: 13 },
    EGLL: { name: "London Heathrow (EGLL)", center: [51.470, -0.454] as [number, number], zoom: 13 },
    KJFK: { name: "New York JFK (KJFK)", center: [40.641, -73.778] as [number, number], zoom: 13 },
    OMDB: { name: "Dubai Intl (OMDB)", center: [25.253, 55.365] as [number, number], zoom: 13 },
    RJTT: { name: "Tokyo Haneda (RJTT)", center: [35.549, 139.779] as [number, number], zoom: 13 },
    LFPG: { name: "Paris CDG (LFPG)", center: [49.009, 2.556] as [number, number], zoom: 13 },
    EHAM: { name: "Amsterdam Schiphol (EHAM)", center: [52.310, 4.768] as [number, number], zoom: 13 },
    EDDF: { name: "Frankfurt (EDDF)", center: [50.037, 8.562] as [number, number], zoom: 13 },
    WSSS: { name: "Singapore Changi (WSSS)", center: [1.364, 103.991] as [number, number], zoom: 13 },
};

function SetViewOnClick({ center, zoom }: { center: [number, number], zoom: number }) {
    const map = useMap();
    useEffect(() => {
        map.setView(center, zoom);
    }, [center, zoom, map]);
    return null;
}

const MapComponent: React.FC<MapProps> = ({ aircraft, activeAirport, onSelect }) => {
    const [trails, setTrails] = useState<{ [icao: string]: [number, number][] }>({});

    // Map Data State
    const [mapData, setMapData] = useState<{ taxiways: any[], holds: any[], stands: any[] }>({ taxiways: [], holds: [], stands: [] });
    const [showStands, setShowStands] = useState(true);
    const [showHolds, setShowHolds] = useState(true);

    useEffect(() => {
        // @ts-ignore
        const data = airportDataRaw[activeAirport];
        if (data) {
            setMapData(data);
        } else {
            setMapData({ taxiways: [], holds: [], stands: [] });
        }
    }, [activeAirport]);

    // Trail Logic
    useEffect(() => {
        setTrails(prev => {
            const next = { ...prev };
            aircraft.forEach(ac => {
                if (ac.latitude && ac.longitude) {
                    const pos: [number, number] = [ac.latitude, ac.longitude];
                    const existing = next[ac.icao24] || [];
                    const last = existing[existing.length - 1];
                    // Update only if moved significantly
                    if (!last || Math.abs(last[0] - pos[0]) > 0.00005 || Math.abs(last[1] - pos[1]) > 0.00005) {
                        next[ac.icao24] = [...existing.slice(-8), pos];
                    }
                }
            });
            return next;
        });
    }, [aircraft]);

    // State for Last Known Headings
    const [lastHeadings, setLastHeadings] = useState<{ [icao: string]: number }>({});

    // Command Feed State
    const [commandLog, setCommandLog] = useState<{ callsign: string, msg: string, time: string }[]>([]);

    // Runway Occupancy State
    const [occupancyTimes, setOccupancyTimes] = useState<{ [icao: string]: number }>({});

    useEffect(() => {
        setOccupancyTimes(prev => {
            const next = { ...prev };
            const activeIcaos = new Set();
            aircraft.forEach(ac => {
                activeIcaos.add(ac.icao24);
                const isOnRunway = ac.phase === 'TakeOff' || ac.phase === 'Landing';
                if (isOnRunway) {
                    if (!next[ac.icao24]) {
                        next[ac.icao24] = Date.now();
                    }
                } else {
                    delete next[ac.icao24];
                }
            });
            Object.keys(next).forEach(k => {
                if (!activeIcaos.has(k)) delete next[k];
            });
            return next;
        });
    }, [aircraft]);

    // Force re-render every second for timers
    const [, setTick] = useState(0);
    useEffect(() => {
        const timer = setInterval(() => setTick(t => t + 1), 1000);
        return () => clearInterval(timer);
    }, []);

    // Watch for ATC messages to populate log
    useEffect(() => {
        aircraft.forEach(ac => {
            if (ac.atc_message && ac.icao24) {
                setCommandLog(prev => {
                    const lastMsg = prev.find(p => p.callsign === (ac.callsign || ac.icao24));
                    if (lastMsg && lastMsg.msg === ac.atc_message) return prev;
                    const newEntry = {
                        callsign: ac.callsign || ac.icao24,
                        msg: ac.atc_message || "",
                        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    };
                    return [newEntry, ...prev].slice(0, 10);
                });
            }
        });
    }, [aircraft]);

    // Arrivals Logic
    const arrivals = useMemo(() => {
        return aircraft
            .filter(ac => (ac.phase === 'Approach' || ac.phase === 'Final') && ac.distance !== undefined)
            .sort((a, b) => (a.distance || 999) - (b.distance || 999));
    }, [aircraft]);

    // Update Last Headings
    useEffect(() => {
        setLastHeadings(prev => {
            const next = { ...prev };
            aircraft.forEach(ac => {
                if (ac.true_track && ac.velocity && ac.velocity > 1) {
                    next[ac.icao24] = ac.true_track;
                } else if (ac.on_ground) {
                    // Try calculate from trails if standard track is missing
                    const hist = trails[ac.icao24];
                    if (hist && hist.length >= 2) {
                        const last = hist[hist.length - 1];
                        const prevPos = hist[hist.length - 2];
                        const dist = Math.sqrt(Math.pow(last[0] - prevPos[0], 2) + Math.pow(last[1] - prevPos[1], 2));
                        if (dist > 0.00001) {
                            next[ac.icao24] = calcBearing(prevPos[0], prevPos[1], last[0], last[1]);
                        }
                    }
                }
            });
            return next;
        });
    }, [aircraft, trails]);

    const airportConfig = AIRPORTS[activeAirport as keyof typeof AIRPORTS] || AIRPORTS['EGSS'];

    return (
        <MapContainer center={airportConfig.center} zoom={airportConfig.zoom} style={{ height: "100%", width: "100%" }}>

            <SetViewOnClick center={airportConfig.center} zoom={airportConfig.zoom} />

            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            />

            {/* Emergency Banner */}
            {aircraft.find(ac => ['7500', '7600', '7700'].includes(ac.squawk || "")) && (
                <div style={{
                    position: 'absolute', top: '10px', left: '50%', transform: 'translateX(-50%)',
                    zIndex: 2000, backgroundColor: 'red', color: 'white', fontWeight: 'bold',
                    padding: '10px 20px', borderRadius: '4px', boxShadow: '0 0 10px rgba(255,0,0,0.8)',
                    animation: 'blink 1s linear infinite'
                }}>
                    ⚠️ EMERGENCY REPORTED: {aircraft.find(ac => ['7500', '7600', '7700'].includes(ac.squawk || ""))?.callsign}
                </div>
            )}

            {/* UI: Top Right Controls */}
            <div className="leaflet-top leaflet-right" style={{ pointerEvents: 'auto', marginTop: '10px', marginRight: '10px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', zIndex: 1000 }}>
                {/* Toggles */}
                <div style={{ backgroundColor: 'rgba(0,0,0,0.6)', padding: '5px', borderRadius: '4px' }}>
                    <label style={{ color: 'white', display: 'block', cursor: 'pointer' }}>
                        <input type="checkbox" checked={showStands} onChange={e => setShowStands(e.target.checked)} /> Show Stands
                    </label>
                    <label style={{ color: 'white', display: 'block', cursor: 'pointer' }}>
                        <input type="checkbox" checked={showHolds} onChange={e => setShowHolds(e.target.checked)} /> Show Holds
                    </label>
                </div>
            </div>

            {/* UI: Top Left Appointments/Board */}
            <div className="leaflet-top leaflet-left" style={{ pointerEvents: 'auto', marginTop: '10px', marginLeft: '50px', zIndex: 1000 }}>
                <div style={{ backgroundColor: 'rgba(20,20,30,0.9)', color: 'white', padding: '10px', borderRadius: '8px', minWidth: '300px', border: '1px solid #444', boxShadow: '0 4px 6px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    {/* Runway Status Header */}
                    <div style={{ marginBottom: '4px', paddingBottom: '8px', borderBottom: '1px solid #444', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', color: '#ccc', textTransform: 'uppercase' }}>Runway 22</span>
                        {arrivals.some(a => (a.distance || 99) < 4) ? (
                            <span style={{ color: '#ff5252', fontWeight: 'bold', fontSize: '12px', border: '1px solid #ff5252', padding: '2px 4px', borderRadius: '2px' }}>OCCUPIED</span>
                        ) : (
                            <span style={{ color: '#69f0ae', fontWeight: 'bold', fontSize: '12px', border: '1px solid #69f0ae', padding: '2px 4px', borderRadius: '2px' }}>ACTIVE</span>
                        )}
                    </div>

                    <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px', color: '#4caf50' }}>Arrivals Board</h3>

                    {/* Departure Window Prediction */}
                    {arrivals.length > 0 && arrivals[0].eta ? (
                        <div style={{ marginBottom: '8px', padding: '4px', borderLeft: '3px solid', borderColor: (arrivals[0].eta * 1000 - Date.now()) > 120000 ? '#4caf50' : (arrivals[0].eta * 1000 - Date.now()) > 60000 ? '#ffeb3b' : '#ff5252', fontSize: '11px', display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#ccc' }}>NEXT ARRIVAL:</span>
                            <span style={{ fontWeight: 'bold' }}>{Math.max(0, Math.floor((arrivals[0].eta * 1000 - Date.now()) / 1000))}s</span>
                        </div>
                    ) : (
                        <div style={{ marginBottom: '8px', padding: '4px', borderLeft: '3px solid #4caf50', fontSize: '11px', color: '#ccc' }}>
                            WINDOW OPEN
                        </div>
                    )}

                    {arrivals.length === 0 ? <div style={{ color: '#888', fontStyle: 'italic' }}>No inbound traffic</div> : (
                        <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ color: '#aaa', textAlign: 'left' }}>
                                    <th>Callsign</th>
                                    <th>DME</th>
                                    <th>ETA</th>
                                    <th>Adv.</th>
                                </tr>
                            </thead>
                            <tbody>
                                {arrivals.slice(0, 8).map(ac => (
                                    <tr key={ac.icao24} style={{ borderBottom: '1px solid #333' }}>
                                        <td style={{ padding: '4px 0', fontWeight: 'bold' }}>{ac.callsign || ac.icao24}</td>
                                        <td style={{ padding: '4px 0' }}>{ac.distance?.toFixed(1)} nm</td>
                                        <td style={{ padding: '4px 0' }}>
                                            {ac.eta ? new Date(ac.eta * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                                        </td>
                                        <td style={{ padding: '4px 0', fontWeight: 'bold', color: ac.advisory?.includes('SLOW') ? '#ffeb3b' : ac.advisory?.includes('GO') ? '#ff5252' : '#69f0ae' }}>
                                            {ac.advisory || '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* UI: Bottom Left Command Feed */}
            <div className="leaflet-bottom leaflet-left" style={{ pointerEvents: 'auto', marginBottom: '20px', marginLeft: '10px', zIndex: 1000 }}>
                <div style={{ backgroundColor: 'rgba(20,20,30,0.9)', color: 'white', padding: '10px', borderRadius: '8px', width: '300px', border: '1px solid #444', maxHeight: '200px', overflowY: 'auto' }}>
                    <h3 style={{ margin: '0 0 8px 0', borderBottom: '1px solid #555', paddingBottom: '4px', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px', color: '#00bcd4' }}>ATC Command Feed</h3>
                    {commandLog.length === 0 ? <div style={{ color: '#888', fontStyle: 'italic' }}>No recent commands</div> : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {commandLog.map((log, idx) => (
                                <div key={idx} style={{ fontSize: '12px', borderLeft: '3px solid #00bcd4', paddingLeft: '8px', padding: '4px', backgroundColor: 'rgba(0,188,212,0.1)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#aaa', fontSize: '10px' }}>
                                        <span>{log.callsign}</span>
                                        <span>{log.time}</span>
                                    </div>
                                    <div style={{ fontWeight: 'bold', color: '#fff' }}>{log.msg}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* AIRPORT INFRASTRUCTURE */}
            {activeAirport === 'EGSS' && (
                <>
                    {/* Runway Outline */}
                    <Polyline positions={[[51.875, 0.220], [51.895, 0.250]]} color={'#ffffff'} weight={4} opacity={0.3} />

                    {/* Taxiways */}
                    {mapData.taxiways.map((tw, idx) => (
                        <Polyline
                            key={`tw-${idx}`}
                            positions={tw.coordinates}
                            color="#666"
                            weight={1}
                            opacity={0.8}
                        >
                            <Popup>{tw.name}</Popup>
                        </Polyline>
                    ))}

                    {/* Holds */}
                    {showHolds && mapData.holds.map((h, idx) => (
                        <CircleMarker
                            key={`hold-${idx}`}
                            center={[h.lat, h.lon]}
                            radius={2}
                            pathOptions={{ color: 'red', fillColor: 'red', fillOpacity: 1 }}
                        >
                            <Popup>Hold: {h.name}</Popup>
                        </CircleMarker>
                    ))}

                    {/* Stands */}
                    {showStands && mapData.stands.map((s, idx) => (
                        <CircleMarker
                            key={`stand-${idx}`}
                            center={[s.lat, s.lon]}
                            radius={1}
                            pathOptions={{ color: '#00bcd4', fillColor: '#00bcd4', fillOpacity: 0.5 }}
                        >
                            <Popup>Stand: {s.name}</Popup>
                        </CircleMarker>
                    ))}
                </>
            )}

            {/* AIRCRAFT RENDERING */}
            {aircraft.map((ac) => {
                let track = lastHeadings[ac.icao24] || ac.true_track || 0;
                const alt = ac.baro_altitude || 0;

                // Smart Exit Prediction (Visual Intelligence)
                let exitLine = null;
                if ((ac.phase === 'Final' || ac.phase === 'Landing') && ac.distance && ac.distance < 3.0) {
                    // Runway 22: Lands at 51.895, 0.250 -> Rollout to SW 51.875, 0.220
                    // RET Hotel (Mediums): ~60% down
                    // RET Juliet (Heavies): End

                    const isHeavy = ac.wake_category === 'Heavy';
                    const targetLat = isHeavy ? 51.875 : 51.883;
                    const targetLon = isHeavy ? 0.220 : 0.232;

                    exitLine = <Polyline positions={[[ac.latitude || 51.895, ac.longitude || 0.250], [targetLat, targetLon]]} pathOptions={{ color: '#00bcd4', weight: 2, dashArray: '5, 5', opacity: 0.6 }} />;
                }

                // Runway Timer
                const occStart = occupancyTimes[ac.icao24];
                const occDuration = occStart ? Math.floor((Date.now() - occStart) / 1000) : 0;
                const isLate = occDuration > 50;

                return (
                    <React.Fragment key={ac.icao24}>
                        {trails[ac.icao24] && (
                            <Polyline
                                positions={trails[ac.icao24]}
                                pathOptions={{ color: '#aaa', weight: 1, dashArray: '4, 8', opacity: 0.4 }}
                            />
                        )}
                        {exitLine}

                        <Marker
                            position={[ac.latitude || 0, ac.longitude || 0]}
                            icon={createPlaneIcon(track, alt, false, ac.category)}
                            eventHandlers={{
                                click: () => onSelect && onSelect(ac),
                            }}
                        >
                            {/* ROI Timer Label */}
                            {occStart && (
                                <Tooltip direction="right" offset={[10, 0]} permanent>
                                    <span style={{ fontWeight: 'bold', color: isLate ? 'red' : 'white', backgroundColor: 'rgba(0,0,0,0.5)', padding: '2px 4px', borderRadius: '3px' }}>
                                        ⏱ {occDuration}s
                                    </span>
                                </Tooltip>
                            )}

                            <Popup>
                                <strong>{ac.callsign || ac.icao24}</strong><br />
                                Type: {ac.category || 'Unknown'}<br />
                                Alt: {ac.baro_altitude?.toFixed(0)} ft<br />
                                Spd: {ac.velocity?.toFixed(0)} kts<br />
                                Hdg: {track.toFixed(0)}°<br />
                                Phase: {ac.phase}<br />
                                {ac.ground_state && <>State: {ac.ground_state}<br /></>}
                                {ac.atc_message && (
                                    <div style={{ color: ac.atc_message.includes('REMINDER') ? '#ff5252' : '#00bcd4', fontWeight: 'bold', marginTop: '4px' }}>
                                        {ac.atc_message.includes('REMINDER') ? '⚠️ ' : ''}ATC: {ac.atc_message}
                                    </div>
                                )}
                                {ac.advisory && <div style={{ color: '#ffeb3b', fontStyle: 'italic' }}>Rec: {ac.advisory}</div>}
                            </Popup>
                        </Marker>
                    </React.Fragment>
                );
            })}

        </MapContainer>
    );
};

export default MapComponent;
