import React, { useState, useEffect } from 'react';

interface CommandFeedProps {
    alerts: string[];
}

interface Command {
    id: number;
    text: string;
    accepted?: boolean;
    rejected?: boolean;
}

const CommandFeed: React.FC<CommandFeedProps> = ({ alerts }) => {
    const [history, setHistory] = useState<Command[]>([]);

    useEffect(() => {
        // When new alerts come in, add them if they don't exist in recent history
        // This is a naive implementation; normally backend would send unique IDs.
        alerts.forEach(alertText => {
            setHistory(prev => {
                // Avoid duplicates for the last few seconds/items
                if (prev.some(c => c.text === alertText && !c.accepted && !c.rejected)) {
                    return prev;
                }
                return [...prev, { id: Date.now() + Math.random(), text: alertText }];
            });
        });
    }, [alerts]);

    const handleAccept = (id: number) => {
        setHistory(prev => prev.map(c => c.id === id ? { ...c, accepted: true } : c));
        // Todo: Send to backend
    };

    const handleReject = (id: number) => {
        setHistory(prev => prev.map(c => c.id === id ? { ...c, rejected: true } : c));
    };

    // Filter out old completed items (optional)
    const visible = history.filter(c => !c.rejected).reverse(); // Newest first

    return (
        <div style={{ height: '200px', background: '#1e1e1e', padding: '10px', borderTop: '1px solid #444', overflowY: 'auto' }}>
            <h3 style={{ margin: '0 0 10px 0' }}>D-C Commands & Alerts</h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {visible.length === 0 && <li style={{ color: '#666' }}>No active commands</li>}
                {visible.map((cmd) => (
                    <li key={cmd.id} style={{
                        padding: '8px',
                        marginBottom: '4px',
                        border: '1px solid #333',
                        background: cmd.accepted ? '#1b2e1b' : '#333',
                        color: cmd.accepted ? '#8f8' : '#ff6b6b',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        <span>{cmd.text} {cmd.accepted && '✓'}</span>
                        {!cmd.accepted && (
                            <div style={{ display: 'flex', gap: '5px' }}>
                                <button
                                    onClick={() => handleAccept(cmd.id)}
                                    style={{ background: '#28a745', border: 'none', color: 'white', cursor: 'pointer', padding: '2px 8px', borderRadius: '4px' }}
                                >
                                    ACK
                                </button>
                                <button
                                    onClick={() => handleReject(cmd.id)}
                                    style={{ background: '#dc3545', border: 'none', color: 'white', cursor: 'pointer', padding: '2px 8px', borderRadius: '4px' }}
                                >
                                    REJ
                                </button>
                            </div>
                        )}
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default CommandFeed;
