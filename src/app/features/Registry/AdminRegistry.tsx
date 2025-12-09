
import { useEffect, useState } from 'react';
// Removed semantic-ui-react imports
import './Registry.css';

interface Device {
    id: number;
    deviceName: string | null;
    deviceClassroom: string | null;
    deviceURL: string | null;
    deviceId: string;
    status: 'PENDING' | 'ACTIVE';
    ipAddress?: string;
    deviceModel?: string;
    userAgent?: string;
    macAddress?: string;
}

const AdminRegistry = () => {
    const siteUrl = import.meta.env.VITE_SITE_URL || 'http://localhost:5000';
    const [devices, setDevices] = useState<Device[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Modal State
    const [registerModalOpen, setRegisterModalOpen] = useState(false);
    const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
    const [viewDevice, setViewDevice] = useState<Device | null>(null);
    const [formClassroom, setFormClassroom] = useState('');
    const [roomError, setRoomError] = useState('');

    // Delete Confirm
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [deleteId, setDeleteId] = useState<number | null>(null);

    // Autocomplete State
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [isSearching, setIsSearching] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (formClassroom.length >= 1 && showSuggestions) {
                searchRooms(formClassroom);
            } else if (formClassroom.length === 0) {
                setSuggestions([]);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [formClassroom, showSuggestions]);

    const searchRooms = async (query: string) => {
        setIsSearching(true);
        try {
            // Using a CORS proxy if needed, but trying direct first as requested or assuming dev proxy
            // The user provided URL: https://plan.zut.edu.pl/schedule.php?kind=room&query=
            // Using relative path to use Vite proxy
            const response = await fetch(`/schedule.php?kind=room&query=${encodeURIComponent(query)}`);
            if (response.ok) {
                const data = await response.json();
                // API returns [ {item: "name"}, false, false... ] or similar mixed types
                const rooms = data
                    .filter((item: any) => item && item.item)
                    .map((item: any) => item.item);
                setSuggestions(rooms);
            }
        } catch (error) {
            console.error("Error searching rooms:", error);
        } finally {
            setIsSearching(false);
        }
    };

    const fetchDevices = async () => {
        try {
            setLoading(true);
            const response = await fetch(`${siteUrl}/api/devices`);
            if (response.ok) {
                const data = await response.json();
                setDevices(data);
            }
        } catch (error) {
            console.error('Error fetching devices:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDevices();
        const interval = setInterval(fetchDevices, 5000); // Poll for updates
        return () => clearInterval(interval);
    }, []);

    const openRegisterModal = (device: Device) => {
        setSelectedDevice(device);
        setFormClassroom(device.deviceClassroom || '');
        setRoomError('');
        setSuggestions([]);
        setRegisterModalOpen(true);
    }

    const validateRoom = async (roomName: string): Promise<boolean> => {
        try {
            const response = await fetch(`/schedule.php?kind=room&query=${encodeURIComponent(roomName)}`);
            if (!response.ok) return false;
            const data = await response.json();
            return data.some((d: any) => d && d.item === roomName);
        } catch {
            return false;
        }
    };

    const handleRegister = async () => {
        if (!selectedDevice || !formClassroom) return;

        // Validate room existence
        const isValid = await validateRoom(formClassroom);
        if (!isValid) {
            setRoomError('Wybrana sala nie została znaleziona w systemie planu.');
            return;
        }

        try {
            const response = await fetch(`${siteUrl}/api/devices/${selectedDevice.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: selectedDevice.id,
                    deviceName: formClassroom,
                    deviceClassroom: formClassroom
                })
            });
            if (response.ok) {
                setRegisterModalOpen(false);
                fetchDevices();
                setDeleteId(null); // Clear delete ID if it was set
            }
        } catch (error) {
            console.error("Error registering device", error);
        }
    }

    const handleDelete = async () => {
        if (deleteId === null) return;
        try {
            await fetch(`${siteUrl}/api/devices/${deleteId}`, { method: 'DELETE' });
            fetchDevices();
        } catch (error) {
            console.error('Error deleting device:', error);
        } finally {
            setConfirmOpen(false);
            setRegisterModalOpen(false); // Also close the modal if deleted from there
            setDeleteId(null);
        }
    };

    const pendingDevices = devices.filter(d => d.status === 'PENDING');
    const activeDevices = devices.filter(d => d.status === 'ACTIVE')
        .filter(d =>
        (d.deviceClassroom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            d.deviceId.toLowerCase().includes(searchTerm.toLowerCase()))
        );

    return (
        <div className="admin-layout">
            {/* SIDEBAR */}
            <aside className="admin-sidebar">
                <div className="sidebar-header">
                    <div className="sidebar-brand">
                        <i className="fas fa-shield-alt" style={{ color: '#60a5fa', marginRight: '0.75rem' }}></i>
                        <span>Rejestr Urządzeń</span>
                    </div>
                </div>

                <div className="sidebar-search">
                    <label style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.5rem', display: 'block' }}>SZUKAJ</label>
                    <input
                        type="text"
                        className="dark-input-sidebar"
                        placeholder="Sala lub ID..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="sidebar-stats">
                    <label style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.5rem', display: 'block' }}>PRZEGLĄD</label>

                    <div className="stat-item">
                        <span className="stat-label">Wszystkie</span>
                        <span className="stat-value">{devices.length}</span>
                    </div>

                    <div className="stat-item active">
                        <span className="stat-label">Aktywne</span>
                        <span className="stat-value" style={{ color: '#4ade80' }}>{activeDevices.length}</span>
                    </div>

                    <div className="stat-item pending">
                        <span className="stat-label">Oczekujące</span>
                        <span className="stat-value" style={{ color: '#facc15' }}>{pendingDevices.length}</span>
                    </div>
                </div>

                <div className="sidebar-actions">
                    <button
                        className={`btn btn-primary btn-full ${loading ? 'loading' : ''}`}
                        onClick={fetchDevices}
                        disabled={loading}
                    >
                        <i className={`fas fa-sync ${loading ? 'fa-spin' : ''}`} style={{ marginRight: '0.5rem' }}></i>
                        Odśwież
                    </button>
                    <div style={{ marginTop: '1rem', textAlign: 'center' }}>
                        <a href="/" style={{ color: '#64748b', fontSize: '0.85rem', textDecoration: 'none' }}>Powrót do strony głównej</a>
                    </div>
                </div>
            </aside>

            {/* MAIN CONTENT */}
            <main className="admin-content">
                <div className="admin-page-header">
                    <h1 className="admin-page-title">Zarządzanie Tabletami</h1>
                </div>

                {/* PENDING SECTION */}
                {pendingDevices.length > 0 && (
                    <div className="content-section">
                        <div className="section-label" style={{ color: '#fbbf24' }}>
                            <i className="fas fa-exclamation-circle" /> Wykryto Nowe Urządzenia ({pendingDevices.length})
                        </div>
                        <div className="device-grid">
                            {pendingDevices.map(device => (
                                <div key={device.id} className="admin-device-card" style={{ borderColor: '#f59e0b', background: 'rgba(245, 158, 11, 0.05)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                        <div className="status-badge pending">
                                            <div className="status-dot"></div> Oczekuje na akceptację
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                            <button
                                                className="btn-info-icon"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setViewDevice(device);
                                                }}
                                                title="Szczegóły"
                                            >
                                                <i className="fas fa-info-circle"></i>
                                            </button>
                                            <i className="fas fa-tablet-alt" style={{ opacity: 0.5, fontSize: '1.5em' }} />
                                        </div>
                                    </div>
                                    <h3 style={{ margin: '0 0 0.5rem 0' }}>{device.deviceId}</h3>
                                    <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                                        Urządzenie czeka na przypisanie sali.
                                    </p>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                                        <button className="btn btn-success" onClick={() => openRegisterModal(device)}>
                                            Autoryzuj
                                        </button>
                                        <button className="btn btn-danger" onClick={() => { setDeleteId(device.id); setConfirmOpen(true); }}>
                                            Odrzuć
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ACTIVE SECTION */}
                <div className="content-section">
                    <div className="section-label">
                        Aktywne Terminale
                    </div>

                    {activeDevices.length === 0 ? (
                        <div className="empty-state-card">
                            <i className="fas fa-search" style={{ fontSize: '3em', marginBottom: '1rem' }} />
                            <h3>Brak aktywnych urządzeń</h3>
                            <p>Poczekaj na nowe połączenia systemowe.</p>
                        </div>
                    ) : (
                        <div className="device-grid">
                            {activeDevices.map(device => (
                                <div key={device.id} className="admin-device-card">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                        <div>
                                            <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.25rem' }}>{device.deviceClassroom}</h3>
                                            <code style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: '4px', color: '#94a3b8', fontSize: '0.8rem' }}>
                                                {device.deviceId}
                                            </code>
                                        </div>
                                        <div className="status-badge online">
                                            <div className="status-dot"></div> Aktywny
                                        </div>
                                        <button
                                            className="btn-info-icon"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setViewDevice(device);
                                            }}
                                            title="Szczegóły"
                                        >
                                            <i className="fas fa-info-circle"></i>
                                        </button>
                                    </div>

                                    <div className="card-actions">
                                        <a
                                            className="btn action-view"
                                            href={`/tablet/WI/${device.deviceClassroom}/${device.deviceURL}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            <i className="fas fa-external-link-alt" style={{ opacity: 0.8, marginRight: '0.5rem' }} /> Podgląd
                                        </a>
                                        <button
                                            className="btn action-delete"
                                            onClick={() => openRegisterModal(device)}
                                            style={{ color: '#fbbf24', borderColor: 'rgba(251, 191, 36, 0.4)', background: 'rgba(251, 191, 36, 0.1)' }}
                                            title="Edytuj"
                                        >
                                            <i className="fas fa-pen" style={{ margin: 0 }} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>

            {/* CUSTOM DELETE MODAL */}
            {confirmOpen && (
                <div className="custom-modal-overlay">
                    <div className="custom-modal">
                        <div className="modal-header" style={{ color: '#ef4444' }}>
                            <i className="fas fa-exclamation-triangle" style={{ marginRight: '10px' }}></i> Usuń Urządzenie
                        </div>
                        <div className="modal-content" style={{ textAlign: 'center', color: '#cbd5e1' }}>
                            <p>Czy na pewno chcesz usunąć to urządzenie z rejestru?</p>
                            <p style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>Urządzenie będzie musiało zostać ponownie sparowane, aby uzyskać dostęp.</p>
                        </div>
                        <div className="modal-actions" style={{ justifyContent: 'center', gap: '1rem' }}>
                            <button
                                className="btn btn-ghost"
                                onClick={() => setConfirmOpen(false)}
                            >
                                Anuluj
                            </button>
                            <button
                                className="btn btn-danger"
                                onClick={handleDelete}
                            >
                                Usuń dostęp
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* REGISTER / EDIT MODAL */}
            {registerModalOpen && (
                <div className="custom-modal-overlay">
                    <div className="custom-modal">
                        <div className="modal-header">
                            {selectedDevice?.status === 'ACTIVE' ? 'Edycja Urządzenia' : 'Parowanie Urządzenia'}
                        </div>
                        <div className="modal-content">
                            <label className="modal-label">Identyfikator Sali</label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    className="modal-input"
                                    placeholder='np. WI WI1- 308'
                                    value={formClassroom}
                                    onChange={(e) => {
                                        setFormClassroom(e.target.value);
                                        setRoomError('');
                                        setShowSuggestions(true);
                                    }}
                                    autoFocus
                                    style={roomError ? { borderColor: '#ef4444' } : {}}
                                />
                                {isSearching && (
                                    <div style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }}>
                                        <i className="fas fa-spinner fa-spin"></i>
                                    </div>
                                )}
                                {showSuggestions && suggestions.length > 0 && (
                                    <div className="suggestions-list">
                                        {suggestions.map((room, index) => (
                                            <div
                                                key={index}
                                                className="suggestion-item"
                                                onClick={() => {
                                                    setFormClassroom(room);
                                                    setRoomError('');
                                                    setShowSuggestions(false);
                                                }}
                                            >
                                                {room}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            {roomError && <p style={{ color: '#ef4444', fontSize: '0.85rem', marginTop: '0.5rem' }}>{roomError}</p>}
                            <p className="modal-input-help">To będzie nazwa wyświetlana na tablecie. Wybierz z listy.</p>
                        </div>
                        <div className="modal-actions" style={{ justifyContent: 'space-between' }}>
                            {/* Delete button only for Active devices (or pending if needed, but UI shows reject there) */}
                            {selectedDevice?.status === 'ACTIVE' && (
                                <button
                                    className="btn btn-danger"
                                    onClick={() => {
                                        if (selectedDevice) {
                                            setDeleteId(selectedDevice.id);
                                            // Handle delete directly here or open confirm?
                                            // User requested "Anuluj Zapisz Usuń" in the tile.
                                            // Let's make this button trigger the delete logic.
                                            // Since we are in a modal, maybe we don't need *another* confirm for this action if it's explicit?
                                            // But for safety, reusing handleDelete which uses deleteId seems fine, 
                                            // but handleDelete currently relies on confirmOpen or just calls API?
                                            // The existing handleDelete uses deleteId. 
                                            // Let's call handleDelete directly if we are sure, OR setConfirmOpen(true) on top of this modal?
                                            // Setting confirmOpen might stack modals. 
                                            // Let's just call the API directly here but we need to ensure update logic doesn't race.
                                            // Actually, let's just use the handleDelete logic but without the confirm dialog if the user clicks "Delete" inside the edit modal?
                                            // Or maybe we can just repurpose handleDelete to be called directly.
                                            // To be safe, I'll invoke a direct delete.
                                            if (window.confirm("Czy na pewno chcesz usunąć to urządzenie?")) {
                                                setDeleteId(selectedDevice.id);
                                                // We need to wait for state/effect? No, just call fetch.
                                                // Refactored logic below to be cleaner.
                                                fetch(`${siteUrl}/api/devices/${selectedDevice.id}`, { method: 'DELETE' })
                                                    .then(() => {
                                                        setRegisterModalOpen(false);
                                                        fetchDevices();
                                                    });
                                            }
                                        }
                                    }}
                                >
                                    Usuń
                                </button>
                            )}
                            {!selectedDevice || selectedDevice.status !== 'ACTIVE' ? <div /> : null}

                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <button
                                    className="btn btn-ghost"
                                    onClick={() => setRegisterModalOpen(false)}
                                >
                                    Anuluj
                                </button>
                                <button
                                    className="btn btn-success"
                                    onClick={handleRegister}
                                    disabled={!formClassroom.trim()}
                                >
                                    Zapisz
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* VIEW DETAILS MODAL */}
            {viewDevice && (
                <div className="custom-modal-overlay" onClick={() => setViewDevice(null)}>
                    <div className="custom-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header" style={{ marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem' }}>
                            <i className="fas fa-info-circle" style={{ marginRight: '10px', color: '#60a5fa' }}></i>
                            Szczegóły Urządzenia
                        </div>
                        <div className="modal-content" style={{ textAlign: 'left' }}>

                            <div className="detail-row">
                                <span className="detail-label">ID Bazy Danych</span>
                                <span className="detail-value">{viewDevice.id}</span>
                            </div>

                            <div className="detail-row">
                                <span className="detail-label">Nazwa Urządzenia</span>
                                <span className="detail-value">{viewDevice.deviceName || '-'}</span>
                            </div>

                            <div className="detail-row">
                                <span className="detail-label">Sala (Classroom)</span>
                                <span className="detail-value">{viewDevice.deviceClassroom || '-'}</span>
                            </div>

                            <div className="detail-row">
                                <span className="detail-label">Device ID (UUID)</span>
                                <span className="detail-value code-font">{viewDevice.deviceId}</span>
                            </div>

                            <div className="detail-row">
                                <span className="detail-label">Model</span>
                                <span className="detail-value">{viewDevice.deviceModel || '-'}</span>
                            </div>

                            <div className="detail-row">
                                <span className="detail-label">Adres IP</span>
                                <span className="detail-value">{viewDevice.ipAddress || '-'}</span>
                            </div>

                            <div className="detail-row">
                                <span className="detail-label">MAC</span>
                                <span className="detail-value code-font">{viewDevice.macAddress || '-'}</span>
                            </div>

                            <div className="detail-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.5rem' }}>
                                <span className="detail-label">User Agent</span>
                                <span className="detail-value" style={{ maxWidth: '100%', fontSize: '0.8rem', textAlign: 'left', color: '#64748b' }}>
                                    {viewDevice.userAgent || '-'}
                                </span>
                            </div>

                            <div className="detail-row">
                                <span className="detail-label">Status</span>
                                <span className={`detail-value ${viewDevice.status === 'ACTIVE' ? 'text-green' : 'text-yellow'}`}>
                                    {viewDevice.status}
                                </span>
                            </div>

                            <div className="detail-row">
                                <span className="detail-label">URL</span>
                                <div className="detail-value" style={{ wordBreak: 'break-all', fontSize: '0.85rem' }}>
                                    {viewDevice.deviceURL ? (
                                        <a href={viewDevice.deviceURL} target="_blank" rel="noopener noreferrer" style={{ color: '#60a5fa' }}>
                                            {viewDevice.deviceURL}
                                        </a>
                                    ) : '-'}
                                </div>
                            </div>

                        </div>
                        <div className="modal-actions" style={{ justifyContent: 'center' }}>
                            <button
                                className="btn btn-primary"
                                onClick={() => setViewDevice(null)}
                            >
                                Zamknij
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminRegistry;
