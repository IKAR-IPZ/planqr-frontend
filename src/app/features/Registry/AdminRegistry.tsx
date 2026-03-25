import { useEffect, useRef, useState } from 'react';
import ThemeToggle from '../../layout/ThemeToggle';
// Removed semantic-ui-react imports

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

const ROOM_SEARCH_DEBOUNCE_MS = 350;
const ROOM_SEARCH_MIN_LENGTH = 2;

const sanitizeRoomValue = (value: string) => value.trim().replace(/\s+/g, ' ');
const normalizeRoomValue = (value: string) => sanitizeRoomValue(value).toUpperCase();
interface NightModeSettings {
    enabled: boolean;
    startTime: string;
    endTime: string;
}

const defaultNightModeSettings: NightModeSettings = {
    enabled: false,
    startTime: '22:00',
    endTime: '06:00'
};

const AdminRegistry = () => {
    const [devices, setDevices] = useState<Device[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [reloadingTablets, setReloadingTablets] = useState(false);
    const [reloadFeedback, setReloadFeedback] = useState<string | null>(null);
    const [nightModeSettings, setNightModeSettings] = useState<NightModeSettings>(defaultNightModeSettings);
    const [nightModeLoading, setNightModeLoading] = useState(false);
    const [nightModeSaving, setNightModeSaving] = useState(false);
    const [nightModeFeedback, setNightModeFeedback] = useState<string | null>(null);
    const [nightModeModalOpen, setNightModeModalOpen] = useState(false);

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
    const [selectedSuggestion, setSelectedSuggestion] = useState<string | null>(null);

    const roomSearchAbortRef = useRef<AbortController | null>(null);
    const roomSearchRequestIdRef = useRef(0);
    const roomSearchCacheRef = useRef(new Map<string, string[]>());
    const knownRoomsRef = useRef(new Set<string>());

    useEffect(() => {
        const query = sanitizeRoomValue(formClassroom);

        if (!showSuggestions) {
            roomSearchAbortRef.current?.abort();
            roomSearchAbortRef.current = null;
            roomSearchRequestIdRef.current += 1;
            setIsSearching(false);
            return;
        }

        if (query.length < ROOM_SEARCH_MIN_LENGTH) {
            roomSearchAbortRef.current?.abort();
            roomSearchAbortRef.current = null;
            roomSearchRequestIdRef.current += 1;
            setSuggestions([]);
            setIsSearching(false);
            return;
        }

        const timer = window.setTimeout(() => {
            void searchRooms(query);
        }, ROOM_SEARCH_DEBOUNCE_MS);

        return () => window.clearTimeout(timer);
    }, [formClassroom, showSuggestions]);

    useEffect(() => {
        return () => {
            roomSearchAbortRef.current?.abort();
        };
    }, []);

    const fetchRoomMatches = async (query: string, signal?: AbortSignal) => {
        const sanitizedQuery = sanitizeRoomValue(query);
        const cacheKey = normalizeRoomValue(sanitizedQuery);

        if (!sanitizedQuery) {
            return [];
        }

        const cachedRooms = roomSearchCacheRef.current.get(cacheKey);
        if (cachedRooms) {
            return cachedRooms;
        }

        const response = await fetch(`/schedule.php?kind=room&query=${encodeURIComponent(sanitizedQuery)}`, { signal });
        if (!response.ok) {
            return [];
        }

        const data = await response.json();
        const rooms = Array.isArray(data)
            ? Array.from(new Set(
                data
                    .filter((item: any) => item && typeof item.item === 'string')
                    .map((item: any) => sanitizeRoomValue(item.item))
                    .filter(Boolean)
            ))
            : [];

        roomSearchCacheRef.current.set(cacheKey, rooms);
        rooms.forEach(room => knownRoomsRef.current.add(normalizeRoomValue(room)));

        return rooms;
    };

    const searchRooms = async (query: string) => {
        const sanitizedQuery = sanitizeRoomValue(query);
        if (sanitizedQuery.length < ROOM_SEARCH_MIN_LENGTH) {
            setSuggestions([]);
            setIsSearching(false);
            return [];
        }

        roomSearchAbortRef.current?.abort();
        const controller = new AbortController();
        roomSearchAbortRef.current = controller;
        const requestId = roomSearchRequestIdRef.current + 1;
        roomSearchRequestIdRef.current = requestId;

        setIsSearching(true);
        try {
            const rooms = await fetchRoomMatches(sanitizedQuery, controller.signal);

            if (!controller.signal.aborted && requestId === roomSearchRequestIdRef.current) {
                setSuggestions(rooms);
            }

            return rooms;
        } catch (error) {
            if (!(error instanceof DOMException && error.name === 'AbortError')) {
                console.error("Error searching rooms:", error);
            }

            if (requestId === roomSearchRequestIdRef.current) {
                setSuggestions([]);
            }

            return [];
        } finally {
            if (requestId === roomSearchRequestIdRef.current) {
                setIsSearching(false);
            }
        }
    };

    const fetchDevices = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/devices');
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

    const fetchNightModeSettings = async () => {
        try {
            setNightModeLoading(true);
            const response = await fetch('/api/devices/display-settings');

            if (!response.ok) {
                throw new Error('Nie udało się pobrać ustawień trybu nocnego.');
            }

            const data = await response.json();
            setNightModeSettings(data.nightMode ?? defaultNightModeSettings);
        } catch (error) {
            console.error('Error fetching night mode settings:', error);
            setNightModeFeedback('Nie udało się pobrać ustawień trybu nocnego.');
        } finally {
            setNightModeLoading(false);
        }
    };

    const handleNightModeSettingsSave = async () => {
        if (nightModeSettings.startTime === nightModeSettings.endTime) {
            setNightModeFeedback('Godzina rozpoczęcia i zakończenia nie mogą być takie same.');
            return;
        }

        try {
            setNightModeSaving(true);
            setNightModeFeedback(null);

            const response = await fetch('/api/devices/display-settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(nightModeSettings)
            });

            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(data.message || 'Nie udało się zapisać ustawień trybu nocnego.');
            }

            setNightModeSettings(data.nightMode ?? nightModeSettings);
            setNightModeFeedback(`Zapisano. Zmiana została wysłana do ${data.delivered ?? 0} podłączonych ekranów.`);
        } catch (error) {
            console.error('Error saving night mode settings:', error);
            setNightModeFeedback(error instanceof Error ? error.message : 'Nie udało się zapisać ustawień trybu nocnego.');
        } finally {
            setNightModeSaving(false);
        }
    };

    const openNightModeModal = async () => {
        setNightModeFeedback(null);
        setNightModeModalOpen(true);
        await fetchNightModeSettings();
    };

    const handleReloadAllTablets = async () => {
        try {
            setReloadingTablets(true);
            setReloadFeedback(null);

            const response = await fetch('/api/devices/reload-all', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    reason: 'admin-manual-tablet-reload'
                })
            });

            if (!response.ok) {
                throw new Error('Nie udało się wysłać komendy reload.');
            }

            const data = await response.json();
            setReloadFeedback(`Wysłano sygnał do ${data.delivered} połączeń tabletów.`);
        } catch (error) {
            console.error('Error reloading tablets:', error);
            setReloadFeedback('Nie udało się wysłać sygnału przeładowania.');
        } finally {
            setReloadingTablets(false);
        }
    };

    useEffect(() => {
        fetchDevices();
        fetchNightModeSettings();
        const interval = setInterval(fetchDevices, 5000); // Poll for updates
        return () => clearInterval(interval);
    }, []);

    const openRegisterModal = (device: Device) => {
        const currentRoom = sanitizeRoomValue(device.deviceClassroom || '');

        setSelectedDevice(device);
        setFormClassroom(currentRoom);
        setSelectedSuggestion(currentRoom || null);
        setRoomError('');
        setSuggestions([]);
        setShowSuggestions(false);
        setIsSearching(false);
        setRegisterModalOpen(true);
    }

    const validateRoom = async (roomName: string): Promise<boolean> => {
        const normalizedRoom = normalizeRoomValue(roomName);

        if (!normalizedRoom) {
            return false;
        }

        if (knownRoomsRef.current.has(normalizedRoom)) {
            return true;
        }

        try {
            const rooms = await fetchRoomMatches(roomName);
            return rooms.some(room => normalizeRoomValue(room) === normalizedRoom);
        } catch {
            return false;
        }
    };

    const handleRegister = async () => {
        const sanitizedRoom = sanitizeRoomValue(formClassroom);

        if (!selectedDevice || !sanitizedRoom) {
            setRoomError('Proszę wprowadzić nazwę sali');
            return;
        }

        roomSearchAbortRef.current?.abort();
        roomSearchAbortRef.current = null;
        roomSearchRequestIdRef.current += 1;
        setIsSearching(false);
        setShowSuggestions(false);

        const normalizedRoom = normalizeRoomValue(sanitizedRoom);
        const isValid = (
            selectedSuggestion !== null &&
            normalizeRoomValue(selectedSuggestion) === normalizedRoom
        ) || await validateRoom(sanitizedRoom);

        if (!isValid) {
            setRoomError('Wybrana sala nie została znaleziona w systemie planu.');
            return;
        }

        try {
            const response = await fetch(`/api/devices/${selectedDevice.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: selectedDevice.id,
                    deviceName: sanitizedRoom,
                    deviceClassroom: sanitizedRoom
                })
            });
            if (response.ok) {
                setRegisterModalOpen(false);
                setFormClassroom(sanitizedRoom);
                setSelectedSuggestion(sanitizedRoom);
                setRoomError('');
                setSuggestions([]);
                fetchDevices();
                setDeleteId(null); // Clear delete ID if it was set
            } else {
                const errorData = await response.json().catch(() => ({}));
                setRoomError(errorData.message || 'Nie udało się zaktualizować urządzenia');
            }
        } catch (error) {
            console.error("Error registering device", error);
            setRoomError('Wystąpił błąd podczas aktualizacji urządzenia');
        }
    }

    const handleDelete = async () => {
        if (deleteId === null) return;
        try {
            const response = await fetch(`/api/devices/${deleteId}`, { method: 'DELETE' });
            if (response.ok) {
                fetchDevices();
            } else {
                alert('Nie udało się usunąć urządzenia');
            }
        } catch (error) {
            console.error('Error deleting device:', error);
            alert('Wystąpił błąd podczas usuwania urządzenia');
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
        <div className="admin-panel">
            {/* SIDEBAR */}
            <aside className="admin-panel__sidebar">
                <div className="admin-panel__sidebar-header">
                    <div className="admin-panel__sidebar-brand">
                        <i className="fas fa-shield-alt" style={{ color: 'var(--color-blue-glow)', marginRight: '0.75rem' }}></i>
                        <span>Admin Panel</span>
                    </div>
                    <div className="admin-panel__theme-toggle-wrapper">
                      <ThemeToggle />
                    </div>
                </div>

                <div className="admin-panel__sidebar-search">
                    <label style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.5rem', display: 'block' }}>SZUKAJ</label>
                    <input
                        type="text"
                        className="admin-panel__sidebar-input"
                        placeholder="Sala lub ID..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="admin-panel__sidebar-stats">
                    <label style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.5rem', display: 'block' }}>PRZEGLĄD</label>

                    <div className="admin-panel__stat-item">
                        <span className="admin-panel__stat-label">Wszystkie</span>
                        <span className="admin-panel__stat-value">{devices.length}</span>
                    </div>

                    <div className="admin-panel__stat-item admin-panel__stat-item--active">
                        <span className="admin-panel__stat-label">Aktywne</span>
                        <span className="admin-panel__stat-value" style={{ color: 'var(--color-success)' }}>{activeDevices.length}</span>
                    </div>

                    <div className="admin-panel__stat-item admin-panel__stat-item--pending">
                        <span className="admin-panel__stat-label">Oczekujące</span>
                        <span className="admin-panel__stat-value" style={{ color: 'var(--color-warning)' }}>{pendingDevices.length}</span>
                    </div>
                </div>

                <div className="admin-panel__sidebar-actions">
                    <button
                        className={`btn btn-primary btn-full ${loading ? 'loading' : ''}`}
                        onClick={fetchDevices}
                        disabled={loading}
                    >
                        <i className={`fas fa-sync ${loading ? 'fa-spin' : ''}`} style={{ marginRight: '0.5rem' }}></i>
                        Odśwież
                    </button>
                    <button
                        className={`btn btn-full ${reloadingTablets ? 'loading' : ''}`}
                        onClick={handleReloadAllTablets}
                        disabled={reloadingTablets}
                        style={{ marginTop: '0.75rem' }}
                    >
                        <i className={`fas fa-bolt ${reloadingTablets ? 'fa-spin' : ''}`} style={{ marginRight: '0.5rem' }}></i>
                        Przeładuj tablety
                    </button>
                    {reloadFeedback && (
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '0.75rem', lineHeight: 1.4 }}>
                            {reloadFeedback}
                        </p>
                    )}
                    <div style={{ marginTop: '1rem', textAlign: 'center' }}>
                        <a href="/" style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textDecoration: 'none' }}>Powrót do strony głównej</a>
                    </div>
                </div>
            </aside>

            {/* MAIN CONTENT */}
            <main className="admin-panel__content">
                <div className="admin-panel__page-header">
                    <div>
                        <h1 className="admin-panel__page-title">Zarządzanie Tabletami</h1>
                        <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', fontSize: '0.95rem' }}>
                            Zarządzaj urządzeniami tabletowymi i przypisuj je do sal
                        </p>
                    </div>
                    <button
                        className="btn btn-primary"
                        onClick={openNightModeModal}
                        disabled={nightModeLoading}
                    >
                        <i className={`fas fa-moon ${nightModeLoading ? 'fa-spin' : ''}`} style={{ marginRight: '0.5rem' }}></i>
                        Harmonogram trybu nocnego
                    </button>
                </div>

                {/* PENDING SECTION */}
                {pendingDevices.length > 0 && (
                    <div className="admin-panel__section">
                        <div className="admin-panel__section-label" style={{ color: 'var(--color-warning)' }}>
                            <i className="fas fa-exclamation-circle" /> Wykryto Nowe Urządzenia ({pendingDevices.length})
                        </div>
                        <div className="admin-panel__device-grid">
                            {pendingDevices.map(device => (
                                <div key={device.id} className="admin-panel__device-card" style={{ borderColor: 'var(--color-warning)', background: 'rgba(245, 158, 11, 0.05)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                        <div className="admin-panel__status-badge admin-panel__status-badge--pending">
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
                                    <h3 style={{ margin: '0 0 0.5rem 0' }} className="admin-panel__device-id">{device.deviceId}</h3>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
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
                <div className="admin-panel__section">
                    <div className="admin-panel__section-label">
                        Aktywne Terminale
                    </div>

                    {activeDevices.length === 0 ? (
                        <div className="empty-state-card">
                            <i className="fas fa-search" style={{ fontSize: '3em', marginBottom: '1rem' }} />
                            <h3>Brak aktywnych urządzeń</h3>
                            <p>Poczekaj na nowe połączenia systemowe.</p>
                        </div>
                    ) : (
                        <div className="admin-panel__device-grid">
                            {activeDevices.map(device => (
                                <div key={device.id} className="admin-panel__device-card">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                        <div>
                                            <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.25rem' }}>{device.deviceClassroom}</h3>
                                            <code className="admin-panel__device-id">
                                                {device.deviceId}
                                            </code>
                                        </div>
                                        <div className="admin-panel__status-badge admin-panel__status-badge--online">
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
                                            href={`/room/${device.deviceClassroom?.split(' ')[0] || 'WI'}/${device.deviceClassroom}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            <i className="fas fa-external-link-alt" style={{ opacity: 0.8, marginRight: '0.5rem' }} /> Plan sali
                                        </a>
                                        <button
                                            className="btn action-delete"
                                            onClick={() => openRegisterModal(device)}
                                            style={{ color: 'var(--color-warning)', borderColor: 'rgba(251, 191, 36, 0.4)', background: 'rgba(251, 191, 36, 0.1)' }}
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
                                        setSelectedSuggestion(null);
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
                                                    setSelectedSuggestion(room);
                                                    setRoomError('');
                                                    setShowSuggestions(false);
                                                    setSuggestions([]);
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
                                                fetch(`/api/devices/${selectedDevice.id}`, { method: 'DELETE' })
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
                                    onClick={() => {
                                        roomSearchAbortRef.current?.abort();
                                        roomSearchAbortRef.current = null;
                                        roomSearchRequestIdRef.current += 1;
                                        setShowSuggestions(false);
                                        setSuggestions([]);
                                        setIsSearching(false);
                                        setRegisterModalOpen(false);
                                    }}
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

            {nightModeModalOpen && (
                <div className="custom-modal-overlay" onClick={() => setNightModeModalOpen(false)}>
                    <div className="custom-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            Ustawienia Trybu Nocnego
                        </div>
                        <div className="modal-content">
                            <label className="admin-panel__checkbox-row">
                                <input
                                    type="checkbox"
                                    checked={nightModeSettings.enabled}
                                    onChange={(e) => {
                                        setNightModeSettings(current => ({
                                            ...current,
                                            enabled: e.target.checked
                                        }));
                                        setNightModeFeedback(null);
                                    }}
                                    disabled={nightModeLoading || nightModeSaving}
                                />
                                <span>Włącz harmonogram czarnego ekranu</span>
                            </label>

                            <div className="admin-panel__time-grid">
                                <label className="admin-panel__time-field">
                                    <span>Od</span>
                                    <input
                                        type="time"
                                        className="modal-input"
                                        value={nightModeSettings.startTime}
                                        onChange={(e) => {
                                            setNightModeSettings(current => ({
                                                ...current,
                                                startTime: e.target.value
                                            }));
                                            setNightModeFeedback(null);
                                        }}
                                        disabled={nightModeLoading || nightModeSaving}
                                    />
                                </label>

                                <label className="admin-panel__time-field">
                                    <span>Do</span>
                                    <input
                                        type="time"
                                        className="modal-input"
                                        value={nightModeSettings.endTime}
                                        onChange={(e) => {
                                            setNightModeSettings(current => ({
                                                ...current,
                                                endTime: e.target.value
                                            }));
                                            setNightModeFeedback(null);
                                        }}
                                        disabled={nightModeLoading || nightModeSaving}
                                    />
                                </label>
                            </div>

                            <p className="admin-panel__sidebar-help">
                                W podanym przedziale tablet przechodzi na całkowicie czarny ekran i sam wraca po zakończeniu okna.
                            </p>

                            <p className="admin-panel__sidebar-help" style={{ marginBottom: 0 }}>
                                Z poziomu zwykłej strony WWW nie da się fizycznie wyłączyć podświetlenia ekranu.
                            </p>

                            {nightModeFeedback && (
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '1rem', lineHeight: 1.4 }}>
                                    {nightModeFeedback}
                                </p>
                            )}
                        </div>
                        <div className="modal-actions" style={{ justifyContent: 'space-between' }}>
                            <button
                                className="btn btn-ghost"
                                onClick={() => setNightModeModalOpen(false)}
                            >
                                Zamknij
                            </button>
                            <button
                                className={`btn btn-primary ${nightModeSaving ? 'loading' : ''}`}
                                onClick={handleNightModeSettingsSave}
                                disabled={nightModeLoading || nightModeSaving}
                            >
                                <i className={`fas fa-save ${nightModeSaving ? 'fa-spin' : ''}`} style={{ marginRight: '0.5rem' }}></i>
                                Zapisz harmonogram
                            </button>
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
