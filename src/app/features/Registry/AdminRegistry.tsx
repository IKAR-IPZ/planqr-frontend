
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
}

const AdminRegistry = () => {
    const siteUrl = import.meta.env.VITE_SITE_URL || 'http://localhost:5000';
    const [devices, setDevices] = useState<Device[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Modal State
    const [registerModalOpen, setRegisterModalOpen] = useState(false);
    const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
    const [formClassroom, setFormClassroom] = useState('');

    // Delete Confirm
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [deleteId, setDeleteId] = useState<number | null>(null);

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
        setFormClassroom('');
        setRegisterModalOpen(true);
    }

    const handleRegister = async () => {
        if (!selectedDevice || !formClassroom) return;
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
                                        <i className="fas fa-tablet-alt" style={{ opacity: 0.5, fontSize: '1.5em' }} />
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
                                            onClick={() => { setDeleteId(device.id); setConfirmOpen(true); }}
                                            title="Usuń"
                                        >
                                            <i className="fas fa-trash-alt" style={{ margin: 0 }} />
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

            {/* REGISTER MODAL */}
            {registerModalOpen && (
                <div className="custom-modal-overlay">
                    <div className="custom-modal">
                        <div className="modal-header">Parowanie Urządzenia</div>
                        <div className="modal-content">
                            <label className="modal-label">Identyfikator Sali</label>
                            <input
                                className="modal-input"
                                placeholder='np. WI WI1- 308'
                                value={formClassroom}
                                onChange={(e) => setFormClassroom(e.target.value)}
                                autoFocus
                            />
                            <p className="modal-input-help">To będzie nazwa wyświetlana na tablecie.</p>
                        </div>
                        <div className="modal-actions">
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
                                style={{ paddingLeft: '2rem', paddingRight: '2rem' }}
                            >
                                Zatwierdź
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminRegistry;
