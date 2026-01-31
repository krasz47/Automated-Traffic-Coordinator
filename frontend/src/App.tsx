import { useState, useEffect } from 'react';
import MapComponent from './components/Map';
import GanttTimeline from './components/GanttTimeline';
import CommandFeed from './components/CommandFeed';
import type { Aircraft } from './types';
import './index.css';

function App() {
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<string[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('http://localhost:3000/api/states');
        if (!response.ok) {
          // throw new Error('Network response was not ok');
          console.warn("Backend not reachable or error");
          return;
        }
        const data = await response.json();
        setAircraft(data);

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
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 2000); // 2 seconds poll

    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw' }}>
      <header style={{ padding: '1rem', background: '#1a1a1a', borderBottom: '1px solid #333' }}>
        <h1 style={{ margin: 0, fontSize: '1.2rem' }}>ATC - Stansted Coordinator</h1>
        <span style={{ fontSize: '0.8rem', color: '#888' }}>
          Aircraft: {aircraft.length} | Status: {loading ? 'Syncing...' : 'Live'}
        </span>
      </header>
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <GanttTimeline aircraft={aircraft} />
        <div style={{ flex: 1, position: 'relative' }}>
          <MapComponent aircraft={aircraft} />
        </div>
      </div>
      <CommandFeed alerts={alerts} />
    </div>
  );
}

export default App;
