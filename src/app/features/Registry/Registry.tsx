import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ThemeToggle from '../../layout/ThemeToggle';
import { reportTabletDisplayProfile } from '../../services/displayProfileService';

const buildTabletPath = (room: string, secretUrl: string) =>
    `/tablet/${encodeURIComponent(room)}/${encodeURIComponent(secretUrl)}`;

interface RegistryStatusResponse {
    status: string;
    config?: {
        room: string;
        secretUrl: string;
    } | null;
}

const Registry = () => {
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

    useEffect(() => {
        if (!uuid) return;

        let resizeTimeoutId: number | null = null;

        const sendDisplayProfile = async () => {
            try {
                await reportTabletDisplayProfile(uuid);
            } catch (error) {
                console.error('[Registry] Failed to report display profile:', error);
            }
        };

        const handleViewportChange = () => {
            if (resizeTimeoutId !== null) {
                window.clearTimeout(resizeTimeoutId);
            }

            resizeTimeoutId = window.setTimeout(() => {
                void sendDisplayProfile();
            }, 300);
        };

        void sendDisplayProfile();
        window.addEventListener('resize', handleViewportChange);
        window.screen.orientation?.addEventListener?.('change', handleViewportChange);

        return () => {
            if (resizeTimeoutId !== null) {
                window.clearTimeout(resizeTimeoutId);
            }

            window.removeEventListener('resize', handleViewportChange);
            window.screen.orientation?.removeEventListener?.('change', handleViewportChange);
        };
    }, [uuid]);

    // Handshake and Polling
    useEffect(() => {
        if (!uuid) return;

        const performHandshake = async () => {
            try {
                const response = await fetch('/api/registry/handshake', {
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
                const response = await fetch(`/api/registry/status/${uuid}`);
                if (response.ok) {
                    const data = await response.json();
                    handleStatus(data);
                }
            } catch (err) {
                console.error(err);
            }
        }

        const handleStatus = (data: RegistryStatusResponse) => {
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
                navigate(buildTabletPath(data.config.room, data.config.secretUrl));
            }
        };

        performHandshake();
        const pollInterval = setInterval(checkStatus, 5000); // Poll every 5s

        return () => clearInterval(pollInterval);
    }, [uuid, navigate]);

    return (
        <div className="registry">
            <div className="registry__theme-toggle">
                <ThemeToggle />
            </div>
            <header className="registry__header">
                <h1 className="registry__title">Device Registration</h1>
            </header>

            <div className="registry__status-card">
                {status === 'LOADING' && <div className="loading-spinner"></div>}

                {status === 'PENDING' && (
                    <div style={{ textAlign: 'center' }}>
                        <h2 style={{ fontSize: '2rem', marginBottom: '1rem' }}>Pairing Code</h2>
                        <div className="registry__uuid-display pulse">{uuid}</div>
                        <p className="registry__status-text pulse">Waiting for administrator approval...</p>
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
