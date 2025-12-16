
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Registry.css';

const Registry = () => {
    const siteUrl = import.meta.env.VITE_SITE_URL || 'http://localhost:5000';
    const navigate = useNavigate();
    const [uuid, setUuid] = useState<string>('');
    const [status, setStatus] = useState<string>('LOADING');
    const [error, setError] = useState<string | null>(null);

    // Initialize ID
    useEffect(() => {
        let deviceId = localStorage.getItem('tablet_uuid');
        if (!deviceId) {
            // Generate 6-digit code
            deviceId = Math.floor(100000 + Math.random() * 900000).toString();
            localStorage.setItem('tablet_uuid', deviceId);
        }
        setUuid(deviceId);
    }, []);

    // Handshake and Polling
    useEffect(() => {
        if (!uuid) return;

        let pollInterval: NodeJS.Timeout;

        const performHandshake = async () => {
            try {
                const response = await fetch(`${siteUrl}/api/registry/handshake`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ deviceId: uuid })
                });

                if (response.ok) {
                    const data = await response.json();
                    handleStatus(data);
                } else {
                    setError("Handshake failed");
                }
            } catch (err) {
                console.error(err);
                setError("Connection error");
            }
        };

        const checkStatus = async () => {
            try {
                const response = await fetch(`${siteUrl}/api/registry/status/${uuid}`);
                if (response.ok) {
                    const data = await response.json();
                    handleStatus(data);
                }
            } catch (err) {
                console.error(err);
            }
        }

        const handleStatus = (data: any) => {
            setStatus(data.status);
            if (data.status === 'ACTIVE' && data.config) {
                // Redirect to tablet view with secret
                // path: tablet/:department/:room/:secretUrl
                // Assuming config.room is "Building Room"? Or just Room? 
                // The backend returns what was stored.
                // If we stored "Room 101" and "Building" isn't separate, we might need adjustments.
                // For now, assume data.config.room contains proper info or we pass placeholders.
                // Actually, in DeviceListController we stored "deviceClassroom".
                // Let's assume deviceClassroom is the Room Number. Building is... ? 
                // In legacy, "department" and "room" were needed. 
                // Let's use "WI" as default department for now as seen in Tablet.tsx logic
                navigate(`/tablet/${data.config.room}/${data.config.secretUrl}`);
            }
        };

        performHandshake();
        pollInterval = setInterval(checkStatus, 5000); // Poll every 5s

        return () => clearInterval(pollInterval);
    }, [uuid, navigate, siteUrl]);

    return (
        <div className="registry-container">
            <header className="registry-header">
                <h1 className="registry-title">Device Registration</h1>
            </header>

            <div className="registry-status-card">
                {status === 'LOADING' && <div className="loading-spinner"></div>}

                {status === 'PENDING' && (
                    <div style={{ textAlign: 'center' }}>
                        <h2 style={{ fontSize: '2rem', marginBottom: '1rem' }}>Pairing Code</h2>
                        <div className="uuid-display">{uuid}</div>
                        <p className="status-text pulse">Waiting for administrator approval...</p>
                        <div className="qr-placeholder">
                            {/* Could generate QR code of UUID for easier admin scanning if mobile app exists */}
                        </div>
                    </div>
                )}

                {status === 'ACTIVE' && (
                    <div style={{ textAlign: 'center' }}>
                        <h2>Device Active</h2>
                        <p>Redirecting to plan view...</p>
                        <div className="loading-spinner"></div>
                    </div>
                )}

                {error && <div className="error-message">{error}</div>}
            </div>
        </div>
    );
};

export default Registry;

