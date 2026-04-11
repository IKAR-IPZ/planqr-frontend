import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeCanvas } from 'qrcode.react';
import { reportTabletDisplayProfile } from '../../services/displayProfileService';
import { buildPairingQrValue, formatPairingDeviceId } from './adminPanel/helpers';

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
    const pairingQrValue = uuid ? buildPairingQrValue(uuid) : '';
    const formattedUuid = uuid ? formatPairingDeviceId(uuid) : '';

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

        let isMounted = true;
        let handshakeInFlight = false;

        const handleStatus = (data: RegistryStatusResponse) => {
            if (!isMounted) {
                return;
            }

            setError(null);
            setStatus(data.status);
            if (data.status === 'ACTIVE' && data.config) {
                navigate(buildTabletPath(data.config.room, data.config.secretUrl));
            }
        };

        const performHandshake = async () => {
            if (handshakeInFlight) {
                return;
            }

            handshakeInFlight = true;
            try {
                const response = await fetch('/api/registry/handshake', {
                    method: 'POST',
                    cache: 'no-store',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ deviceId: uuid })
                });

                if (response.ok) {
                    const data = await response.json();
                    handleStatus(data);
                } else {
                    if (isMounted) {
                        setError("Handshake failed");
                    }
                }
            } catch (err) {
                console.error(err);
                if (isMounted) {
                    setError("Connection error");
                }
            } finally {
                handshakeInFlight = false;
            }
        };

        const checkStatus = async () => {
            try {
                const response = await fetch(`/api/registry/status/${uuid}`, {
                    cache: 'no-store'
                });
                if (response.status === 404) {
                    await performHandshake();
                    return;
                }

                if (response.ok) {
                    const data = await response.json();
                    handleStatus(data);
                }
            } catch (err) {
                console.error(err);
            }
        };

        void performHandshake();
        const pollInterval = setInterval(checkStatus, 5000); // Poll every 5s

        return () => {
            isMounted = false;
            clearInterval(pollInterval);
        };
    }, [uuid, navigate]);

    return (
        <div className="registry">
            <header className="registry__header">
                <p className="registry__eyebrow">PlanQR</p>
                <h1 className="registry__title">Rejestracja tabletu</h1>
                <p className="registry__subtitle">
                    Zeskanuj kod QR z telefonu w panelu administratora albo wpisz kod ręcznie,
                    jeśli aparat nie jest dostępny.
                </p>
            </header>

            <div className="registry__status-card">
                {status === 'LOADING' && <div className="loading-spinner"></div>}

                {status === 'PENDING' && (
                    <div className="registry__pairing-panel">
                        <h2 className="registry__section-title">Kod parowania</h2>
                        <div className="registry__uuid-display pulse">{formattedUuid}</div>
                        <p className="registry__status-text pulse">
                            Czeka na przypisanie sali przez administratora.
                        </p>
                        {pairingQrValue ? (
                            <QRCodeCanvas
                                className="registry__qr"
                                value={pairingQrValue}
                                size={220}
                                includeMargin={true}
                                bgColor="#ffffff"
                                fgColor="#0f172a"
                                level="M"
                            />
                        ) : null}
                    </div>
                )}

                {status === 'ACTIVE' && (
                    <div className="registry__pairing-panel">
                        <h2 className="registry__section-title">Tablet aktywny</h2>
                        <p className="registry__status-text">Przekierowanie do widoku planu...</p>
                        <div className="loading-spinner"></div>
                    </div>
                )}

                {error && <div className="error-message">{error}</div>}
            </div>
        </div>
    );
};

export default Registry;
