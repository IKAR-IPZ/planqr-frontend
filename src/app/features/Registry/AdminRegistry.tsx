import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { logout } from "../../services/authService";
import "./AdminRegistry.css";
import AdminPanelSidebar from "./adminPanel/AdminPanelSidebar";
import AdminsView from "./adminPanel/AdminsView";
import DevicesView from "./adminPanel/DevicesView";
import ScheduleView from "./adminPanel/ScheduleView";
import {
  adminViewMeta,
  defaultNightModeSettings,
  formatLastSeen,
  getConnectionLabel,
  getConnectionTone,
  matchesDeviceSearch,
  normalizeRoomValue,
  ROOM_SEARCH_DEBOUNCE_MS,
  ROOM_SEARCH_MIN_LENGTH,
  sanitizeRoomValue,
  sortDevices,
} from "./adminPanel/helpers";
import type {
  AdminPanelView,
  AdminRecord,
  Device,
  DeviceSortOption,
  NightModeSettings,
} from "./adminPanel/types";

const getActiveView = (value: string | null): AdminPanelView => {
  if (value === "admins" || value === "schedule") {
    return value;
  }

  return "devices";
};

const AdminRegistry = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentView = getActiveView(searchParams.get("view"));

  const [devices, setDevices] = useState<Device[]>([]);
  const [admins, setAdmins] = useState<AdminRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [adminsLoading, setAdminsLoading] = useState(false);
  const [adminMutationLoading, setAdminMutationLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [deviceSort, setDeviceSort] = useState<DeviceSortOption>("status");
  const [newAdminUsername, setNewAdminUsername] = useState("");
  const [adminFeedback, setAdminFeedback] = useState<string | null>(null);
  const [reloadingTablets, setReloadingTablets] = useState(false);
  const [reloadFeedback, setReloadFeedback] = useState<string | null>(null);
  const [nightModeSettings, setNightModeSettings] =
    useState<NightModeSettings>(defaultNightModeSettings);
  const [nightModeLoading, setNightModeLoading] = useState(false);
  const [nightModeSaving, setNightModeSaving] = useState(false);
  const [nightModeFeedback, setNightModeFeedback] = useState<string | null>(null);

  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [viewDevice, setViewDevice] = useState<Device | null>(null);
  const [formClassroom, setFormClassroom] = useState("");
  const [roomError, setRoomError] = useState("");

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

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
      roomSearchAbortRef.current?.abort();
      const controller = new AbortController();
      roomSearchAbortRef.current = controller;
      const requestId = roomSearchRequestIdRef.current + 1;
      roomSearchRequestIdRef.current = requestId;

      setIsSearching(true);

      void fetchRoomMatches(query, controller.signal)
        .then((rooms) => {
          if (!controller.signal.aborted && requestId === roomSearchRequestIdRef.current) {
            setSuggestions(rooms);
          }
        })
        .catch((error) => {
          if (!(error instanceof DOMException && error.name === "AbortError")) {
            console.error("Error searching rooms:", error);
          }

          if (requestId === roomSearchRequestIdRef.current) {
            setSuggestions([]);
          }
        })
        .finally(() => {
          if (requestId === roomSearchRequestIdRef.current) {
            setIsSearching(false);
          }
        });
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

    const response = await fetch(
      `/schedule.php?kind=room&query=${encodeURIComponent(sanitizedQuery)}`,
      { signal },
    );
    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    const rooms = Array.isArray(data)
      ? Array.from(
          new Set(
            data
              .filter((item: { item?: unknown }) => typeof item?.item === "string")
              .map((item: { item: string }) => sanitizeRoomValue(item.item))
              .filter(Boolean),
          ),
        )
      : [];

    roomSearchCacheRef.current.set(cacheKey, rooms);
    rooms.forEach((room) => knownRoomsRef.current.add(normalizeRoomValue(room)));

    return rooms;
  };

  const fetchDevices = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/devices");
      if (response.ok) {
        const data = await response.json();
        setDevices(data);
      }
    } catch (error) {
      console.error("Error fetching devices:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAdmins = async () => {
    try {
      setAdminsLoading(true);
      const response = await fetch("/api/admins", {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Nie udało się pobrać listy administratorów.");
      }

      const data = await response.json();
      setAdmins(Array.isArray(data.admins) ? data.admins : []);
    } catch (error) {
      console.error("Error fetching admins:", error);
      setAdminFeedback("Nie udało się pobrać listy administratorów.");
    } finally {
      setAdminsLoading(false);
    }
  };

  const fetchNightModeSettings = async () => {
    try {
      setNightModeLoading(true);
      const response = await fetch("/api/devices/display-settings");

      if (!response.ok) {
        throw new Error("Nie udało się pobrać ustawień trybu nocnego.");
      }

      const data = await response.json();
      setNightModeSettings(data.nightMode ?? defaultNightModeSettings);
    } catch (error) {
      console.error("Error fetching night mode settings:", error);
      setNightModeFeedback("Nie udało się pobrać ustawień trybu nocnego.");
    } finally {
      setNightModeLoading(false);
    }
  };

  const handleNightModeSettingsSave = async () => {
    if (nightModeSettings.startTime === nightModeSettings.endTime) {
      setNightModeFeedback(
        "Godzina rozpoczęcia i zakończenia nie mogą być takie same.",
      );
      return;
    }

    try {
      setNightModeSaving(true);
      setNightModeFeedback(null);

      const response = await fetch("/api/devices/display-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nightModeSettings),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          data.message || "Nie udało się zapisać ustawień trybu nocnego.",
        );
      }

      setNightModeSettings(data.nightMode ?? nightModeSettings);
      setNightModeFeedback(
        `Zapisano. Zmiana została wysłana do ${data.delivered ?? 0} podłączonych ekranów.`,
      );
    } catch (error) {
      console.error("Error saving night mode settings:", error);
      setNightModeFeedback(
        error instanceof Error
          ? error.message
          : "Nie udało się zapisać ustawień trybu nocnego.",
      );
    } finally {
      setNightModeSaving(false);
    }
  };

  const handleReloadAllTablets = async () => {
    try {
      setReloadingTablets(true);
      setReloadFeedback(null);

      const response = await fetch("/api/devices/reload-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: "admin-manual-tablet-reload",
        }),
      });

      if (!response.ok) {
        throw new Error("Nie udało się wysłać komendy reload.");
      }

      const data = await response.json();
      setReloadFeedback(`Wysłano sygnał do ${data.delivered} połączeń tabletów.`);
    } catch (error) {
      console.error("Error reloading tablets:", error);
      setReloadFeedback("Nie udało się wysłać sygnału przeładowania.");
    } finally {
      setReloadingTablets(false);
    }
  };

  useEffect(() => {
    void fetchDevices();
    void fetchNightModeSettings();
    void fetchAdmins();
    const interval = window.setInterval(fetchDevices, 5000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (currentView === "schedule") {
      void fetchNightModeSettings();
    }
  }, [currentView]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/");
    } catch (error) {
      console.error("Error during logout:", error);
      alert("Nie udało się wylogować. Spróbuj ponownie.");
    }
  };

  const handleAddAdmin = async () => {
    const username = newAdminUsername.trim().toLowerCase();

    if (!username) {
      setAdminFeedback("Podaj login LDAP użytkownika.");
      return;
    }

    try {
      setAdminMutationLoading(true);
      setAdminFeedback(null);

      const response = await fetch("/api/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || "Nie udało się nadać uprawnień administratora.");
      }

      setNewAdminUsername("");
      setAdminFeedback(data.message || "Nadano uprawnienia administratora.");
      await fetchAdmins();
    } catch (error) {
      console.error("Error adding admin:", error);
      setAdminFeedback(
        error instanceof Error
          ? error.message
          : "Nie udało się nadać uprawnień administratora.",
      );
    } finally {
      setAdminMutationLoading(false);
    }
  };

  const handleRemoveAdmin = async (admin: AdminRecord) => {
    if (admin.adminSource !== "panel") {
      setAdminFeedback(
        "Administrator dodany z bazy danych może zostać usunięty tylko bezpośrednio w bazie danych.",
      );
      return;
    }

    if (admin.isCurrentUser) {
      setAdminFeedback("Nie możesz odebrać uprawnień samemu sobie z poziomu panelu.");
      return;
    }

    const shouldDelete = window.confirm(`Usunąć administratora ${admin.username}?`);
    if (!shouldDelete) {
      return;
    }

    try {
      setAdminMutationLoading(true);
      setAdminFeedback(null);

      const response = await fetch(
        `/api/admins/${encodeURIComponent(admin.username)}`,
        {
          method: "DELETE",
          credentials: "include",
        },
      );

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || "Nie udało się usunąć administratora.");
      }

      setAdminFeedback(data.message || "Usunięto administratora.");
      await fetchAdmins();
    } catch (error) {
      console.error("Error removing admin:", error);
      setAdminFeedback(
        error instanceof Error ? error.message : "Nie udało się usunąć administratora.",
      );
    } finally {
      setAdminMutationLoading(false);
    }
  };

  const closeRegisterModal = () => {
    roomSearchAbortRef.current?.abort();
    roomSearchAbortRef.current = null;
    roomSearchRequestIdRef.current += 1;
    setShowSuggestions(false);
    setSuggestions([]);
    setIsSearching(false);
    setRegisterModalOpen(false);
  };

  const openRegisterModal = (device: Device) => {
    const currentRoom = sanitizeRoomValue(device.deviceClassroom || "");

    setSelectedDevice(device);
    setFormClassroom(currentRoom);
    setSelectedSuggestion(currentRoom || null);
    setRoomError("");
    setSuggestions([]);
    setShowSuggestions(false);
    setIsSearching(false);
    setRegisterModalOpen(true);
  };

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
      return rooms.some((room) => normalizeRoomValue(room) === normalizedRoom);
    } catch {
      return false;
    }
  };

  const handleRegister = async () => {
    const sanitizedRoom = sanitizeRoomValue(formClassroom);

    if (!selectedDevice || !sanitizedRoom) {
      setRoomError("Proszę wprowadzić nazwę sali.");
      return;
    }

    roomSearchAbortRef.current?.abort();
    roomSearchAbortRef.current = null;
    roomSearchRequestIdRef.current += 1;
    setIsSearching(false);
    setShowSuggestions(false);

    const normalizedRoom = normalizeRoomValue(sanitizedRoom);
    const isValid =
      (selectedSuggestion !== null &&
        normalizeRoomValue(selectedSuggestion) === normalizedRoom) ||
      (await validateRoom(sanitizedRoom));

    if (!isValid) {
      setRoomError("Wybrana sala nie została znaleziona w systemie planu.");
      return;
    }

    try {
      const response = await fetch(`/api/devices/${selectedDevice.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedDevice.id,
          deviceName: sanitizedRoom,
          deviceClassroom: sanitizedRoom,
        }),
      });

      if (response.ok) {
        closeRegisterModal();
        setFormClassroom(sanitizedRoom);
        setSelectedSuggestion(sanitizedRoom);
        setRoomError("");
        setDeleteId(null);
        await fetchDevices();
      } else {
        const errorData = await response.json().catch(() => ({}));
        setRoomError(errorData.message || "Nie udało się zaktualizować urządzenia.");
      }
    } catch (error) {
      console.error("Error registering device", error);
      setRoomError("Wystąpił błąd podczas aktualizacji urządzenia.");
    }
  };

  const handleDelete = async () => {
    if (deleteId === null) {
      return;
    }

    try {
      const response = await fetch(`/api/devices/${deleteId}`, { method: "DELETE" });
      if (response.ok) {
        await fetchDevices();
      } else {
        alert("Nie udało się usunąć urządzenia.");
      }
    } catch (error) {
      console.error("Error deleting device:", error);
      alert("Wystąpił błąd podczas usuwania urządzenia.");
    } finally {
      setConfirmOpen(false);
      closeRegisterModal();
      setDeleteId(null);
    }
  };

  const handleViewChange = (view: AdminPanelView) => {
    if (view === "devices") {
      setSearchParams({});
      return;
    }

    setSearchParams({ view });
  };

  const allPendingDevices = devices.filter((device) => device.status === "PENDING");
  const pendingDevices = allPendingDevices.filter((device) =>
    matchesDeviceSearch(device, searchTerm),
  );
  const pairedDevices = devices.filter((device) => device.status === "ACTIVE");
  const activeDevices = sortDevices(
    pairedDevices.filter((device) => matchesDeviceSearch(device, searchTerm)),
    deviceSort,
  );
  const onlineDevicesCount = pairedDevices.filter(
    (device) => device.connectionStatus === "ONLINE",
  ).length;
  const offlineDevicesCount = pairedDevices.filter(
    (device) => device.connectionStatus === "OFFLINE",
  ).length;

  const viewMeta = adminViewMeta[currentView];
  const navigationItems = (Object.keys(adminViewMeta) as AdminPanelView[]).map((key) => ({
    key,
    label: adminViewMeta[key].label,
    description: adminViewMeta[key].description,
  }));
  const summaryItems = [
    { label: "Wszystkie urządzenia", value: devices.length },
    { label: "Online", value: onlineDevicesCount, tone: "success" as const },
    { label: "Offline", value: offlineDevicesCount, tone: "danger" as const },
    { label: "Oczekujące", value: allPendingDevices.length, tone: "warning" as const },
    { label: "Administratorzy", value: admins.length },
  ];

  return (
    <div className="admin-workspace">
      <AdminPanelSidebar
        activeView={currentView}
        navigationItems={navigationItems}
        summaryItems={summaryItems}
        loading={loading}
        reloadingTablets={reloadingTablets}
        reloadFeedback={reloadFeedback}
        onRefreshDevices={fetchDevices}
        onReloadTablets={handleReloadAllTablets}
        onLogout={handleLogout}
        onViewChange={handleViewChange}
      />

      <main className="admin-workspace__main">
        <header className="admin-workspace__header">
          <div>
            <span className="admin-workspace__eyebrow">{viewMeta.label}</span>
            <h2 className="admin-workspace__header-title">{viewMeta.title}</h2>
            <p className="admin-workspace__header-description">
              {viewMeta.description}
            </p>
          </div>
          <div className="admin-workspace__header-card">
            <span className="admin-workspace__header-card-label">Widok aktywny</span>
            <strong>{viewMeta.label}</strong>
            <span>
              {currentView === "devices"
                ? `${activeDevices.length} pozycji w tabeli`
                : currentView === "admins"
                  ? `${admins.length} kont z dostępem`
                  : `Okno ${nightModeSettings.startTime} - ${nightModeSettings.endTime}`}
            </span>
          </div>
        </header>

        <div className="admin-workspace__content">
          {currentView === "devices" ? (
            <DevicesView
              activeDevices={activeDevices}
              pendingDevices={pendingDevices}
              loading={loading}
              searchTerm={searchTerm}
              sortBy={deviceSort}
              onSearchTermChange={setSearchTerm}
              onSortChange={setDeviceSort}
              onRefresh={fetchDevices}
              onViewDevice={setViewDevice}
              onEditDevice={openRegisterModal}
              onAuthorizeDevice={openRegisterModal}
              onRejectDevice={(device) => {
                setDeleteId(device.id);
                setConfirmOpen(true);
              }}
            />
          ) : null}

          {currentView === "admins" ? (
            <AdminsView
              admins={admins}
              adminsLoading={adminsLoading}
              adminMutationLoading={adminMutationLoading}
              newAdminUsername={newAdminUsername}
              adminFeedback={adminFeedback}
              onUsernameChange={(value) => {
                setNewAdminUsername(value);
                setAdminFeedback(null);
              }}
              onAddAdmin={handleAddAdmin}
              onRefreshAdmins={fetchAdmins}
              onRemoveAdmin={handleRemoveAdmin}
            />
          ) : null}

          {currentView === "schedule" ? (
            <ScheduleView
              settings={nightModeSettings}
              loading={nightModeLoading}
              saving={nightModeSaving}
              feedback={nightModeFeedback}
              onRefresh={fetchNightModeSettings}
              onSettingChange={(next) => {
                setNightModeSettings(next);
                setNightModeFeedback(null);
              }}
              onSave={handleNightModeSettingsSave}
            />
          ) : null}
        </div>
      </main>

      {confirmOpen ? (
        <div className="admin-modal__overlay">
          <div className="admin-modal admin-modal--compact">
            <div className="admin-modal__header">
              <h3>Usuń urządzenie</h3>
              <p>
                Urządzenie zostanie usunięte z rejestru i będzie wymagało ponownego
                sparowania.
              </p>
            </div>
            <div className="admin-modal__actions">
              <button
                type="button"
                className="admin-button admin-button--ghost"
                onClick={() => setConfirmOpen(false)}
              >
                Anuluj
              </button>
              <button
                type="button"
                className="admin-button admin-button--danger"
                onClick={handleDelete}
              >
                Usuń dostęp
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {registerModalOpen ? (
        <div className="admin-modal__overlay" onClick={closeRegisterModal}>
          <div className="admin-modal" onClick={(event) => event.stopPropagation()}>
            <div className="admin-modal__header">
              <h3>
                {selectedDevice?.status === "ACTIVE"
                  ? "Edytuj urządzenie"
                  : "Autoryzuj urządzenie"}
              </h3>
              <p>Wybierz poprawną salę z planu i zapisz powiązanie tabletu.</p>
            </div>

            <div className="admin-modal__content">
              <label className="admin-form-field">
                <span className="admin-form-field__label">Sala</span>
                <div className="admin-autocomplete">
                  <input
                    className="admin-form-field__input"
                    placeholder="np. WI WI1-308"
                    value={formClassroom}
                    onChange={(event) => {
                      setFormClassroom(event.target.value);
                      setSelectedSuggestion(null);
                      setRoomError("");
                      setShowSuggestions(true);
                    }}
                    autoFocus
                  />
                  {isSearching ? (
                    <span className="admin-autocomplete__loading">
                      <i className="fas fa-spinner fa-spin" aria-hidden="true" />
                    </span>
                  ) : null}
                  {showSuggestions && suggestions.length > 0 ? (
                    <div className="admin-autocomplete__list">
                      {suggestions.map((room) => (
                        <button
                          key={room}
                          type="button"
                          className="admin-autocomplete__item"
                          onClick={() => {
                            setFormClassroom(room);
                            setSelectedSuggestion(room);
                            setRoomError("");
                            setShowSuggestions(false);
                            setSuggestions([]);
                          }}
                        >
                          {room}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </label>

              {roomError ? <p className="admin-feedback admin-feedback--error">{roomError}</p> : null}

              <p className="admin-modal__hint">
                Nazwa wyświetlana na tablecie powinna pochodzić z listy zwróconej przez
                system planu.
              </p>
            </div>

            <div className="admin-modal__actions admin-modal__actions--between">
              {selectedDevice?.status === "ACTIVE" ? (
                <button
                  type="button"
                  className="admin-button admin-button--danger"
                  onClick={() => {
                    setDeleteId(selectedDevice.id);
                    setConfirmOpen(true);
                    closeRegisterModal();
                  }}
                >
                  Usuń
                </button>
              ) : (
                <span />
              )}
              <div className="admin-modal__actions-group">
                <button
                  type="button"
                  className="admin-button admin-button--ghost"
                  onClick={closeRegisterModal}
                >
                  Anuluj
                </button>
                <button
                  type="button"
                  className="admin-button admin-button--primary"
                  onClick={handleRegister}
                  disabled={!formClassroom.trim()}
                >
                  Zapisz
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {viewDevice ? (
        <div className="admin-modal__overlay" onClick={() => setViewDevice(null)}>
          <div className="admin-modal" onClick={(event) => event.stopPropagation()}>
            <div className="admin-modal__header">
              <h3>Szczegóły urządzenia</h3>
              <p>Techniczne informacje o tablecie i jego aktualnym stanie połączenia.</p>
            </div>

            <div className="admin-detail-list">
              <div className="admin-detail-list__row">
                <span>ID bazy danych</span>
                <strong>{viewDevice.id}</strong>
              </div>
              <div className="admin-detail-list__row">
                <span>Nazwa urządzenia</span>
                <strong>{viewDevice.deviceName || "-"}</strong>
              </div>
              <div className="admin-detail-list__row">
                <span>Sala</span>
                <strong>{viewDevice.deviceClassroom || "-"}</strong>
              </div>
              <div className="admin-detail-list__row">
                <span>Device ID</span>
                <strong className="admin-table__meta-code">{viewDevice.deviceId}</strong>
              </div>
              <div className="admin-detail-list__row">
                <span>Status</span>
                <strong>
                  <span
                    className={`admin-status-pill admin-status-pill--${getConnectionTone(
                      viewDevice,
                    )}`}
                  >
                    {getConnectionLabel(viewDevice)}
                  </span>
                </strong>
              </div>
              <div className="admin-detail-list__row">
                <span>Model</span>
                <strong>{viewDevice.deviceModel || "-"}</strong>
              </div>
              <div className="admin-detail-list__row">
                <span>Adres IP</span>
                <strong>{viewDevice.ipAddress || "-"}</strong>
              </div>
              <div className="admin-detail-list__row">
                <span>MAC</span>
                <strong className="admin-table__meta-code">{viewDevice.macAddress || "-"}</strong>
              </div>
              <div className="admin-detail-list__row">
                <span>Ostatni heartbeat</span>
                <strong>{formatLastSeen(viewDevice.lastSeen)}</strong>
              </div>
              <div className="admin-detail-list__row admin-detail-list__row--stacked">
                <span>User Agent</span>
                <strong>{viewDevice.userAgent || "-"}</strong>
              </div>
              <div className="admin-detail-list__row admin-detail-list__row--stacked">
                <span>URL</span>
                {viewDevice.deviceURL ? (
                  <a
                    className="admin-detail-list__link"
                    href={viewDevice.deviceURL}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {viewDevice.deviceURL}
                  </a>
                ) : (
                  <strong>-</strong>
                )}
              </div>
            </div>

            <div className="admin-modal__actions">
              <button
                type="button"
                className="admin-button admin-button--primary"
                onClick={() => setViewDevice(null)}
              >
                Zamknij
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default AdminRegistry;
