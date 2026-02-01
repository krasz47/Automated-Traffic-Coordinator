import { useState, useEffect } from 'react';
import MapComponent from './components/Map';
import GanttTimeline from './components/GanttTimeline';
import CommandFeed from './components/CommandFeed';
import type { Aircraft } from './types';
import './index.css';

const AIRPORT_DB = [
  { code: 'EGSS', name: 'London Stansted', country: 'United Kingdom', lat: 51.885, lon: 0.235 },
  { code: 'KLAX', name: 'Los Angeles Intl', country: 'United States', lat: 33.942, lon: -118.407 },
  { code: 'EGLL', name: 'London Heathrow', country: 'United Kingdom', lat: 51.470, lon: -0.454 },
  { code: 'KJFK', name: 'John F. Kennedy', country: 'United States', lat: 40.641, lon: -73.778 },
  { code: 'OMDB', name: 'Dubai International', country: 'United Arab Emirates', lat: 25.253, lon: 55.365 },
  { code: 'RJTT', name: 'Tokyo Haneda', country: 'Japan', lat: 35.549, lon: 139.779 },
  { code: 'LFPG', name: 'Paris Charles de Gaulle', country: 'France', lat: 49.009, lon: 2.556 },
  { code: 'EHAM', name: 'Amsterdam Schiphol', country: 'Netherlands', lat: 52.310, lon: 4.768 },
  { code: 'EDDF', name: 'Frankfurt', country: 'Germany', lat: 50.037, lon: 8.562 },
  { code: 'WSSS', name: 'Singapore Changi', country: 'Singapore', lat: 1.364, lon: 103.991 }
];

function App() {
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<string[]>([]);
  const [activeAirport, setActiveAirport] = useState<string | null>(null);

  // Search State
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredAirports, setFilteredAirports] = useState(AIRPORT_DB);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  useEffect(() => {
    // Filter logic
    const term = searchTerm.toLowerCase();
    const results = AIRPORT_DB.filter(ap =>
      ap.name.toLowerCase().includes(term) ||
      ap.code.toLowerCase().includes(term) ||
      ap.country.toLowerCase().includes(term)
    );
    setFilteredAirports(results);
    setSelectedIndex(0);
  }, [searchTerm]);

  useEffect(() => {
    // Poll loop
    const fetchData = async () => {
      // If no airport selected, don't fetch or fetch empty? 
      // Actually backend returns empty if no airport selected.
      try {
        const response = await fetch('http://localhost:3000/api/states');
        if (!response.ok) {
          console.warn("Backend not reachable");
          return;
        }
        const data = await response.json();
        setAircraft(data);
        setLoading(false); // Only stop loading when we get data

        // Simple Alert Logic
        const newAlerts: string[] = [];
        data.forEach((ac: Aircraft) => {
          if (ac.phase === "Final" && (ac.velocity || 0) > 160) {
            newAlerts.push(`SLOW DOWN ${ac.callsign || ac.icao24} (Fast on Final)`);
          }
          if (ac.wake_category === "Heavy" && ac.phase === "Final") {
            newAlerts.push(`CAUTION WAKE ${ac.callsign || ac.icao24} (Heavy)`);
          }
        });
        setAlerts(newAlerts);
      } catch (error) {
        console.error("Error fetching aircraft data:", error);
      }
    };

    if (activeAirport) {
      fetchData();
      const interval = setInterval(fetchData, 2000);
      return () => clearInterval(interval);
    }
  }, [activeAirport]);

  const selectAirport = async (code: string) => {
    try {
      await fetch('http://localhost:3000/api/airport', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      });
      setActiveAirport(code);
    } catch (e) {
      console.error("Failed to set airport", e);
    }
  };

  // AIRPORT SELECTION MODAL
  if (!activeAirport) {
    return (
      <div style={{
        height: '100vh', width: '100vw',
        backgroundColor: '#0a0a0a', color: 'white',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        fontFamily: 'Inter, sans-serif'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '3rem', animation: 'fadeIn 0.8s ease-out' }}>
          <h1 style={{
            fontSize: '2.5rem', margin: '0 0 1rem 0', fontWeight: '300', letterSpacing: '-1px',
            color: '#ffffff'
          }}>
            Automated Traffic Coordination
          </h1>
          <p style={{ fontSize: '0.9rem', color: '#888', letterSpacing: '3px', textTransform: 'uppercase' }}>
            Flight Monitoring System
          </p>
        </div>

        <div style={{ width: '100%', maxWidth: '500px', position: 'relative', animation: 'slideUp 0.6s ease-out 0.2s backwards' }}>
          {/* Minimal Search Input */}
          <div style={{
            position: 'relative', display: 'flex', alignItems: 'center',
            borderBottom: isSearchFocused ? '1px solid #fff' : '1px solid rgba(255, 255, 255, 0.2)',
            transition: 'border-color 0.3s ease',
            paddingBottom: '8px'
          }}>
            <span style={{ fontSize: '1.2rem', color: isSearchFocused ? '#fff' : '#666', marginRight: '10px', transition: 'color 0.3s' }}>✈</span>
            <input
              type="text"
              placeholder="Search airport..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && filteredAirports.length > 0) {
                  selectAirport(filteredAirports[selectedIndex].code);
                }
              }}
              style={{
                width: '100%', background: 'transparent', border: 'none',
                color: 'white', fontSize: '1.5rem', outline: 'none', fontWeight: '300'
              }}
            />
          </div>

          {/* Minimal Dropdown - Only visible on search focus */}
          <div style={{
            marginTop: '10px',
            opacity: isSearchFocused ? 1 : 0,
            pointerEvents: isSearchFocused ? 'auto' : 'none',
            transform: isSearchFocused ? 'translateY(0)' : 'translateY(-10px)',
            transition: 'all 0.2s ease',
            maxHeight: '300px', overflowY: 'auto'
          }}>
            {filteredAirports.map((ap, idx) => (
              <div
                key={ap.code}
                onClick={() => selectAirport(ap.code)}
                onMouseEnter={() => setSelectedIndex(idx)}
                style={{
                  padding: '12px 0',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  cursor: 'pointer',
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                  color: idx === selectedIndex ? '#fff' : '#888',
                  transition: 'color 0.2s'
                }}
              >
                <div style={{ fontSize: '1rem' }}>{ap.name}, <span style={{ opacity: 0.5 }}>{ap.country}</span></div>
                <div style={{ fontSize: '0.9rem', fontFamily: 'monospace', opacity: 0.7 }}>{ap.code}</div>
              </div>
            ))}
            {filteredAirports.length === 0 && (
              <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>No airports found</div>
            )}
          </div>
        </div>

        <style>{`
                  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                  @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
              `}</style>
      </div >
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw' }}>
      <header style={{ padding: '1rem', background: '#1a1a1a', borderBottom: '1px solid #333' }}>
        <h1 style={{ margin: 0, fontSize: '1.2rem' }}>ATC - {activeAirport === 'EGSS' ? 'Stansted Coordinator' : 'LAX Coordinator'}</h1>
        <span style={{ fontSize: '0.8rem', color: '#888' }}>
          Monitoring: {activeAirport} | Aircraft: {aircraft.length} | Status: {loading ? 'Syncing...' : 'Live'}
        </span>
        <button onClick={() => setActiveAirport(null)} style={{ float: 'right', padding: '4px 8px', background: '#333', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Switch Airport</button>
      </header>
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <GanttTimeline aircraft={aircraft} />
        <div style={{ flex: 1, position: 'relative' }}>
          <MapComponent aircraft={aircraft} activeAirport={activeAirport} />
        </div>
      </div>
      <CommandFeed alerts={alerts} />
    </div>
  );
}

export default App;
