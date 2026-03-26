import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import logo from "../../../assets/ZUT_Logo.png";
import { fetchSession, logout, type SessionInfo } from "../../services/authService";
import "./AdminRegistry.css";
import AdminPanelSidebar from "./adminPanel/AdminPanelSidebar";
import AdminPanelThemeToggle from "./adminPanel/AdminPanelThemeToggle";
import AdminsView from "./adminPanel/AdminsView";
import DeviceDrawer from "./adminPanel/DeviceDrawer";
import DevicesView from "./adminPanel/DevicesView";
import ScheduleView from "./adminPanel/ScheduleView";
import {
  adminViewMeta,
  defaultAdminPanelTheme,
  defaultNightModeSettings,
  matchesDeviceSearch,
  normalizeRoomValue,
  ROOM_SEARCH_DEBOUNCE_MS,
  ROOM_SEARCH_MIN_LENGTH,
  sanitizeRoomValue,
  sortDevices,
} from "./adminPanel/helpers";
import type {
  AdminPanelTheme,
  AdminPanelView,
  AdminRecord,
  Device,
  DeviceSortOption,
  NightModeSettings,
  Tone,
} from "./adminPanel/types";

const ADMIN_THEME_STORAGE_KEY = "admin-theme";

const getActiveView = (value: string | null): AdminPanelView => {
  if (value === "admins" || value === "schedule") {
    return value;
  }

  return "devices";
};

const getStoredAdminTheme = (): AdminPanelTheme => {
  if (typeof window === "undefined") {
    return defaultAdminPanelTheme;
  }

  const storedTheme = window.localStorage.getItem(ADMIN_THEME_STORAGE_KEY);
  return storedTheme === "dark" ? "dark" : defaultAdminPanelTheme;
};

const AdminRegistry = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentView = getActiveView(searchParams.get("view"));

  const [adminTheme, setAdminTheme] = useState<AdminPanelTheme>(getStoredAdminTheme);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(false);
  const [manualRefreshing, setManualRefreshing] = useState(false);
  const [admins, setAdmins] = useState<AdminRecord[]>([]);
  const [adminsLoading, setAdminsLoading] = useState(false);
  const [adminMutationLoading, setAdminMutationLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [deviceSort, setDeviceSort] = useState<DeviceSortOption>("status");
  const [newAdminUsername, setNewAdminUsername] = useState("");
  const [adminFeedback, setAdminFeedback] = useState<string | null>(null);
  const [adminFeedbackTone, setAdminFeedbackTone] = useState<Tone>("neutral");
  const [reloadingTablets, setReloadingTablets] = useState(false);
  const [reloadFeedback, setReloadFeedback] = useState<string | null>(null);
  const [reloadFeedbackTone, setReloadFeedbackTone] = useState<Tone>("neutral");
  const [nightModeSettings, setNightModeSettings] =
    useState<NightModeSettings>(defaultNightModeSettings);
  const [nightModeLoading, setNightModeLoading] = useState(false);
  const [nightModeSaving, setNightModeSaving] = useState(false);
  const [nightModeFeedback, setNightModeFeedback] = useState<string | null>(null);
  const [nightModeFeedbackTone, setNightModeFeedbackTone] =
    useState<Tone>("neutral");

  const [drawerMode, setDrawerMode] = useState<"details" | "edit" | null>(null);
  const [drawerDeviceId, setDrawerDeviceId] = useState<number | null>(null);
  const [formClassroom, setFormClassroom] = useState("");
  const [roomError, setRoomError] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<string | null>(null);

  const roomSearchAbortRef = useRef<AbortController | null>(null);
  const roomSearchRequestIdRef = useRef(0);
  const roomSearchCacheRef = useRef(new Map<string, string[]>());
  const knownRoomsRef = useRef(new Set<string>());

  const drawerDevice = useMemo(
    () =>
      drawerDeviceId === null
        ? null
        : devices.find((device) => device.id === drawerDeviceId) ?? null,
    [devices, drawerDeviceId],
  );

  useEffect(() => {
    window.localStorage.setItem(ADMIN_THEME_STORAGE_KEY, adminTheme);
  }, [adminTheme]);

  useEffect(() => {
    if (drawerDeviceId !== null && !drawerDevice) {
      setDrawerMode(null);
      setDrawerDeviceId(null);
    }
  }, [drawerDevice, drawerDeviceId]);

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

  const resetRoomSearch = () => {
    roomSearchAbortRef.current?.abort();
    roomSearchAbortRef.current = null;
    roomSearchRequestIdRef.current += 1;
    setShowSuggestions(false);
    setSuggestions([]);
    setIsSearching(false);
    setSelectedSuggestion(null);
    setRoomError("");
  };

  const closeDrawer = () => {
    resetRoomSearch();
    setDrawerMode(null);
    setDrawerDeviceId(null);
    setFormClassroom("");
  };

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

  const fetchDevices = async (options?: {
    silent?: boolean;
    manual?: boolean;
  }) => {
    const silent = options?.silent ?? false;
    const manual = options?.manual ?? false;

    try {
      if (!silent) {
        setLoading(true);
      }

      if (manual) {
        setManualRefreshing(true);
      }

      const response = await fetch("/api/devices");
      if (response.ok) {
        const data = await response.json();
        setDevices(data);
      }
    } catch (error) {
      console.error("Error fetching devices:", error);
    } finally {
      if (!silent) {
        setLoading(false);
      }

      if (manual) {
        setManualRefreshing(false);
      }
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
      setAdminFeedbackTone("danger");
    } finally {
      setAdminsLoading(false);
    }
  };

  const fetchNightModeSettings = async () => {
    try {
      setNightModeLoading(true);
      const response = await fetch("/api/devices/display-settings");

      if (!response.ok) {
        throw new Error("Nie udało się pobrać ustawień.");
      }

      const data = await response.json();
      setNightModeSettings(data.nightMode ?? defaultNightModeSettings);
    } catch (error) {
      console.error("Error fetching night mode settings:", error);
      setNightModeFeedback("Nie udało się pobrać ustawień.");
      setNightModeFeedbackTone("danger");
    } finally {
      setNightModeLoading(false);
    }
  };

  const handleNightModeSettingsSave = async () => {
    if (nightModeSettings.startTime === nightModeSettings.endTime) {
      setNightModeFeedback("Godzina startu i końca nie mogą być takie same.");
      setNightModeFeedbackTone("danger");
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
        throw new Error(data.message || "Nie udało się zapisać ustawień.");
      }

      setNightModeSettings(data.nightMode ?? nightModeSettings);
      setNightModeFeedback(`Zapisano. Wysłano do ${data.delivered ?? 0} ekranów.`);
      setNightModeFeedbackTone("success");
    } catch (error) {
      console.error("Error saving night mode settings:", error);
      setNightModeFeedback(
        error instanceof Error ? error.message : "Nie udało się zapisać ustawień.",
      );
      setNightModeFeedbackTone("danger");
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
        throw new Error("Nie udało się wysłać komendy.");
      }

      const data = await response.json();
      setReloadFeedback(`Wysłano sygnał do ${data.delivered} połączeń.`);
      setReloadFeedbackTone("success");
    } catch (error) {
      console.error("Error reloading tablets:", error);
      setReloadFeedback("Nie udało się wysłać komendy.");
      setReloadFeedbackTone("danger");
    } finally {
      setReloadingTablets(false);
    }
  };

  useEffect(() => {
    void fetchDevices();
    void fetchNightModeSettings();
    void fetchAdmins();
    void fetchSession().then(setSession).catch((error) => {
      console.error("Error fetching session:", error);
    });
    const interval = window.setInterval(() => {
      void fetchDevices({ silent: true });
    }, 5000);
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
      setAdminFeedback("Podaj login LDAP.");
      setAdminFeedbackTone("danger");
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
        throw new Error(data.message || "Nie udało się nadać uprawnień.");
      }

      setNewAdminUsername("");
      setAdminFeedback(data.message || "Dodano administratora.");
      setAdminFeedbackTone("success");
      await fetchAdmins();
    } catch (error) {
      console.error("Error adding admin:", error);
      setAdminFeedback(
        error instanceof Error ? error.message : "Nie udało się nadać uprawnień.",
      );
      setAdminFeedbackTone("danger");
    } finally {
      setAdminMutationLoading(false);
    }
  };

  const handleRemoveAdmin = async (admin: AdminRecord) => {
    if (admin.adminSource !== "panel") {
      setAdminFeedback("To konto można usunąć tylko poza panelem.");
      setAdminFeedbackTone("danger");
      return;
    }

    if (admin.isCurrentUser) {
      setAdminFeedback("Nie możesz usunąć własnego konta administratora.");
      setAdminFeedbackTone("danger");
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
      setAdminFeedbackTone("success");
      await fetchAdmins();
    } catch (error) {
      console.error("Error removing admin:", error);
      setAdminFeedback(
        error instanceof Error ? error.message : "Nie udało się usunąć administratora.",
      );
      setAdminFeedbackTone("danger");
    } finally {
      setAdminMutationLoading(false);
    }
  };

  const openDeviceDetails = (device: Device) => {
    resetRoomSearch();
    setDrawerDeviceId(device.id);
    setDrawerMode("details");
  };

  const openDeviceEditor = (device: Device) => {
    resetRoomSearch();
    const currentRoom = sanitizeRoomValue(device.deviceClassroom || "");

    setDrawerDeviceId(device.id);
    setDrawerMode("edit");
    setFormClassroom(currentRoom);
    setSelectedSuggestion(currentRoom || null);
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
    const device = drawerDevice;
    const sanitizedRoom = sanitizeRoomValue(formClassroom);

    if (!device || !sanitizedRoom) {
      setRoomError("Wprowadź nazwę sali.");
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
      setRoomError("Wybrana sala nie istnieje w planie.");
      return;
    }

    try {
      const response = await fetch(`/api/devices/${device.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: device.id,
          deviceName: sanitizedRoom,
          deviceClassroom: sanitizedRoom,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        setRoomError(errorData.message || "Nie udało się zapisać zmian.");
        return;
      }

      closeDrawer();
      await fetchDevices();
    } catch (error) {
      console.error("Error registering device", error);
      setRoomError("Nie udało się zapisać zmian.");
    }
  };

  const handleDeleteDevice = async (device: Device) => {
    const confirmationLabel =
      device.status === "PENDING"
        ? "Odrzucić urządzenie z kolejki?"
        : "Usunąć urządzenie z rejestru?";
    const shouldDelete = window.confirm(confirmationLabel);

    if (!shouldDelete) {
      return;
    }

    try {
      const response = await fetch(`/api/devices/${device.id}`, { method: "DELETE" });
      if (!response.ok) {
        alert("Nie udało się usunąć urządzenia.");
        return;
      }

      if (drawerDeviceId === device.id) {
        closeDrawer();
      }
      await fetchDevices();
    } catch (error) {
      console.error("Error deleting device:", error);
      alert("Wystąpił błąd podczas usuwania urządzenia.");
    }
  };

  const handleViewChange = (view: AdminPanelView) => {
    closeDrawer();

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

  const navigationItems = (Object.keys(adminViewMeta) as AdminPanelView[]).map((key) => ({
    key,
    label: adminViewMeta[key].label,
    icon: adminViewMeta[key].icon,
  }));

  return (
    <div className="admin-console" data-admin-theme={adminTheme}>
      <header className="admin-console__appbar">
        <div className="admin-console__brand">
          <img className="admin-console__brand-logo" src={logo} alt="ZUT" />
          <div className="admin-console__brand-copy">
            <strong>PlanQR Admin</strong>
            {session?.login ? (
              <span className="admin-console__brand-user">Zalogowany: {session.login}</span>
            ) : null}
          </div>
        </div>

        <div className="admin-console__appbar-actions">
          <AdminPanelThemeToggle theme={adminTheme} onChange={setAdminTheme} />
          <a className="admin-button admin-button--ghost admin-button--small" href="/">
            Powrót
          </a>
          <button
            type="button"
            className="admin-button admin-button--ghost admin-button--small"
            onClick={handleLogout}
          >
            Wyloguj
          </button>
        </div>
      </header>

      <div className="admin-console__body">
        <AdminPanelSidebar
          activeView={currentView}
          navigationItems={navigationItems}
          onViewChange={handleViewChange}
        />

        <main className="admin-console__main">
          {reloadFeedback ? (
            <div className={`admin-inline-message admin-inline-message--${reloadFeedbackTone}`}>
              {reloadFeedback}
            </div>
          ) : null}

          {currentView === "devices" ? (
            <DevicesView
              activeDevices={activeDevices}
              pendingDevices={pendingDevices}
              counts={{
                all: devices.length,
                online: onlineDevicesCount,
                offline: offlineDevicesCount,
                pending: allPendingDevices.length,
              }}
              loading={loading}
              manualRefreshing={manualRefreshing}
              reloadingTablets={reloadingTablets}
              searchTerm={searchTerm}
              sortBy={deviceSort}
              onSearchTermChange={setSearchTerm}
              onSortChange={setDeviceSort}
              onRefresh={() => void fetchDevices({ manual: true })}
              onReloadTablets={handleReloadAllTablets}
              onViewDevice={openDeviceDetails}
              onEditDevice={openDeviceEditor}
              onAuthorizeDevice={openDeviceEditor}
              onDeleteDevice={handleDeleteDevice}
            />
          ) : null}

          {currentView === "admins" ? (
            <AdminsView
              admins={admins}
              adminsLoading={adminsLoading}
              adminMutationLoading={adminMutationLoading}
              newAdminUsername={newAdminUsername}
              adminFeedback={adminFeedback}
              adminFeedbackTone={adminFeedbackTone}
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
              feedbackTone={nightModeFeedbackTone}
              onRefresh={fetchNightModeSettings}
              onSettingChange={(next) => {
                setNightModeSettings(next);
                setNightModeFeedback(null);
              }}
              onSave={handleNightModeSettingsSave}
            />
          ) : null}
        </main>
      </div>

      {drawerMode && drawerDevice ? (
        <DeviceDrawer
          mode={drawerMode}
          device={drawerDevice}
          formClassroom={formClassroom}
          roomError={roomError}
          suggestions={suggestions}
          showSuggestions={showSuggestions}
          isSearching={isSearching}
          onClose={closeDrawer}
          onStartEdit={() => openDeviceEditor(drawerDevice)}
          onFormChange={(value) => {
            setFormClassroom(value);
            setSelectedSuggestion(null);
            setRoomError("");
            setShowSuggestions(true);
          }}
          onSuggestionSelect={(room) => {
            setFormClassroom(room);
            setSelectedSuggestion(room);
            setRoomError("");
            setShowSuggestions(false);
            setSuggestions([]);
          }}
          onSave={handleRegister}
          onDelete={() => void handleDeleteDevice(drawerDevice)}
        />
      ) : null}
    </div>
  );
};

export default AdminRegistry;
