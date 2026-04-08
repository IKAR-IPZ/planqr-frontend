import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import logo from "../../../assets/ZUT_Logo.png";
import {
  canOpenLecturerPlan,
  fetchSession,
  logout,
  type SessionInfo,
} from "../../services/authService";
import "./AdminRegistry.css";
import AdminPairingScanner from "./adminPanel/AdminPairingScanner";
import AdminPanelSidebar from "./adminPanel/AdminPanelSidebar";
import AdminPanelThemeToggle from "./adminPanel/AdminPanelThemeToggle";
import AdminsView from "./adminPanel/AdminsView";
import DeviceDrawer from "./adminPanel/DeviceDrawer";
import DevicePreviewModal from "./adminPanel/DevicePreviewModal";
import DevicesView from "./adminPanel/DevicesView";
import ScheduleView from "./adminPanel/ScheduleView";
import {
  adminViewMeta,
  defaultAdminPanelTheme,
  defaultNightModeSettings,
  formatPairingDeviceId,
  hasDeviceDisplayProfile,
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
const TOAST_DURATION_MS = 5000;
const ADMIN_SCROLL_ROOT_CLASS = "admin-console-scroll-root";
const MOBILE_BREAKPOINT_PX = 720;
const SCROLL_TOP_VISIBILITY_THRESHOLD_PX = 160;
const SCROLL_TOP_TOAST_GAP_PX = 12;

type AdminNavigationKey = AdminPanelView | "pairing";

interface NavigationItem {
  key: AdminNavigationKey;
  label: string;
  icon: string;
  active: boolean;
}

interface AdminToast {
  id: number;
  message: string;
  tone: Tone;
}

interface PreviewModalState {
  deviceId: number;
  phase: "loading-profile" | "ready" | "error";
  message: string | null;
  requestedAt: number | null;
}

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
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<number[]>([]);
  const [batchMutationLoading, setBatchMutationLoading] = useState(false);
  const [newAdminUsername, setNewAdminUsername] = useState("");
  const [adminFeedback, setAdminFeedback] = useState<string | null>(null);
  const [adminFeedbackTone, setAdminFeedbackTone] = useState<Tone>("neutral");
  const [reloadingTablets, setReloadingTablets] = useState(false);
  const [nightModeSettings, setNightModeSettings] =
    useState<NightModeSettings>(defaultNightModeSettings);
  const [nightModeLoading, setNightModeLoading] = useState(false);
  const [nightModeSaving, setNightModeSaving] = useState(false);
  const [nightModeFeedback, setNightModeFeedback] = useState<string | null>(null);
  const [nightModeFeedbackTone, setNightModeFeedbackTone] =
    useState<Tone>("neutral");

  const [drawerMode, setDrawerMode] = useState<"details" | "edit" | null>(null);
  const [drawerDeviceId, setDrawerDeviceId] = useState<number | null>(null);
  const [previewModal, setPreviewModal] = useState<PreviewModalState | null>(null);
  const [formClassroom, setFormClassroom] = useState("");
  const [roomError, setRoomError] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<string | null>(null);
  const [toasts, setToasts] = useState<AdminToast[]>([]);
  const [isPairingScannerOpen, setPairingScannerOpen] = useState(false);
  const [isMobileNavOpen, setMobileNavOpen] = useState(false);
  const [isMobileSettingsOpen, setMobileSettingsOpen] = useState(false);
  const [pairingReturnMode, setPairingReturnMode] =
    useState<"none" | "after-save">("none");
  const [isScrollTopVisible, setScrollTopVisible] = useState(false);
  const [toastStackOffset, setToastStackOffset] = useState(0);

  const roomSearchAbortRef = useRef<AbortController | null>(null);
  const roomSearchRequestIdRef = useRef(0);
  const roomSearchCacheRef = useRef(new Map<string, string[]>());
  const knownRoomsRef = useRef(new Set<string>());
  const pendingDeviceIdsRef = useRef<Set<string>>(new Set());
  const hasFetchedDevicesRef = useRef(false);
  const toastIdRef = useRef(0);
  const toastTimeoutRef = useRef(new Map<number, number>());
  const toastStackRef = useRef<HTMLDivElement | null>(null);

  const drawerDevice = useMemo(
    () =>
      drawerDeviceId === null
        ? null
        : devices.find((device) => device.id === drawerDeviceId) ?? null,
    [devices, drawerDeviceId],
  );

  const previewDevice = useMemo(
    () =>
      previewModal === null
        ? null
        : devices.find((device) => device.id === previewModal.deviceId) ?? null,
    [devices, previewModal],
  );
  const lecturerPanelHref = canOpenLecturerPlan(session) ? "/lecturerPlan" : null;

  useEffect(() => {
    window.localStorage.setItem(ADMIN_THEME_STORAGE_KEY, adminTheme);
  }, [adminTheme]);

  useEffect(() => {
    document.documentElement.classList.add(ADMIN_SCROLL_ROOT_CLASS);
    document.body.classList.add(ADMIN_SCROLL_ROOT_CLASS);

    return () => {
      document.documentElement.classList.remove(ADMIN_SCROLL_ROOT_CLASS);
      document.body.classList.remove(ADMIN_SCROLL_ROOT_CLASS);
    };
  }, []);

  useEffect(() => {
    if (drawerDeviceId !== null && !drawerDevice) {
      setDrawerMode(null);
      setDrawerDeviceId(null);
    }
  }, [drawerDevice, drawerDeviceId]);

  useEffect(() => {
    if (previewModal !== null && !previewDevice) {
      setPreviewModal(null);
    }
  }, [previewDevice, previewModal]);

  useEffect(() => {
    if (!isMobileNavOpen && !isMobileSettingsOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileNavOpen(false);
        setMobileSettingsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMobileNavOpen, isMobileSettingsOpen]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > MOBILE_BREAKPOINT_PX) {
        setMobileNavOpen(false);
        setMobileSettingsOpen(false);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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
    const toastTimeouts = toastTimeoutRef.current;

    return () => {
      roomSearchAbortRef.current?.abort();
      for (const timeoutId of toastTimeouts.values()) {
        window.clearTimeout(timeoutId);
      }
      toastTimeouts.clear();
    };
  }, []);

  const dismissToast = (toastId: number) => {
    const timeoutId = toastTimeoutRef.current.get(toastId);
    if (timeoutId) {
      window.clearTimeout(timeoutId);
      toastTimeoutRef.current.delete(toastId);
    }

    setToasts((current) => current.filter((toast) => toast.id !== toastId));
  };

  const pushToast = (
    message: string,
    tone: Tone = "neutral",
    duration = TOAST_DURATION_MS,
  ) => {
    const nextToastId = toastIdRef.current + 1;
    toastIdRef.current = nextToastId;

    setToasts((current) => [...current, { id: nextToastId, message, tone }]);

    const timeoutId = window.setTimeout(() => {
      dismissToast(nextToastId);
    }, duration);

    toastTimeoutRef.current.set(nextToastId, timeoutId);
  };

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

  const handleDrawerClose = () => {
    setPairingReturnMode("none");
    closeDrawer();
  };

  const closePreviewModal = () => {
    setPreviewModal(null);
  };

  const closeMobilePanels = () => {
    setMobileNavOpen(false);
    setMobileSettingsOpen(false);
  };

  const toggleMobileNav = () => {
    setMobileSettingsOpen(false);
    setMobileNavOpen((current) => !current);
  };

  const toggleMobileSettings = () => {
    setMobileNavOpen(false);
    setMobileSettingsOpen((current) => !current);
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
        const data = (await response.json()) as Device[];
        const nextPendingDevices = data.filter((device) => device.status === "PENDING");
        const nextPendingIds = new Set(nextPendingDevices.map((device) => device.deviceId));

        if (hasFetchedDevicesRef.current) {
          const newPendingDevices = nextPendingDevices.filter(
            (device) => !pendingDeviceIdsRef.current.has(device.deviceId),
          );

          if (newPendingDevices.length > 0) {
            const message =
              newPendingDevices.length === 1
                ? `Nowy tablet czeka na sparowanie: ${formatPairingDeviceId(
                    newPendingDevices[0].deviceId,
                  )}.`
                : `${newPendingDevices.length} nowe tablety czekają na sparowanie.`;
            pushToast(message, "warning", 7000);
          }
        }

        pendingDeviceIdsRef.current = nextPendingIds;
        hasFetchedDevicesRef.current = true;
        setDevices(data);
        return data;
      }
    } catch (error) {
      console.error("Error fetching devices:", error);
      return null;
    } finally {
      if (!silent) {
        setLoading(false);
      }

      if (manual) {
        setManualRefreshing(false);
      }
    }

    return null;
  };

  const openDevicePreview = async (
    device: Device,
    options?: { forceProfileRefresh?: boolean },
  ) => {
    if (device.status !== "ACTIVE" || !device.deviceClassroom || !device.deviceURL) {
      setPreviewModal({
        deviceId: device.id,
        phase: "error",
        message: "Tablet nie ma kompletnej konfiguracji do podglądu.",
        requestedAt: null,
      });
      return;
    }

    if (hasDeviceDisplayProfile(device) && !options?.forceProfileRefresh) {
      setPreviewModal({
        deviceId: device.id,
        phase: "ready",
        message: null,
        requestedAt: null,
      });
      return;
    }

    if (device.connectionStatus !== "ONLINE") {
      setPreviewModal({
        deviceId: device.id,
        phase: "error",
        message:
          "Tablet nie ma jeszcze zapisanego profilu ekranu i nie jest aktualnie online.",
        requestedAt: null,
      });
      return;
    }

    setPreviewModal({
      deviceId: device.id,
      phase: "loading-profile",
      message: "Pobieranie parametrów ekranu z tabletu...",
      requestedAt: Date.now(),
    });

    try {
      const response = await fetch(`/api/devices/${device.id}/request-display-profile`, {
        method: "POST",
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Nie udało się pobrać profilu ekranu.");
      }

      if ((data.delivered ?? 0) < 1) {
        setPreviewModal({
          deviceId: device.id,
          phase: "error",
          message: "Tablet nie odpowiedział na prośbę o przesłanie profilu ekranu.",
          requestedAt: null,
        });
      }
    } catch (error) {
      setPreviewModal({
        deviceId: device.id,
        phase: "error",
        message:
          error instanceof Error
            ? error.message
            : "Nie udało się pobrać profilu ekranu z urządzenia.",
        requestedAt: null,
      });
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
      pushToast(`Zapisano ustawienia. Wysłano do ${data.delivered ?? 0} ekranów.`, "success");
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
      pushToast(`Wysłano sygnał do ${data.delivered} połączeń.`, "success");
    } catch (error) {
      console.error("Error reloading tablets:", error);
      pushToast("Nie udało się wysłać komendy.", "danger");
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (currentView === "schedule") {
      void fetchNightModeSettings();
    }
  }, [currentView]);

  useEffect(() => {
    if (previewModal?.phase !== "loading-profile" || previewModal.requestedAt === null) {
      return;
    }

    let cancelled = false;
    const deadlineAt = previewModal.requestedAt + 10_000;
    const previewDeviceId = previewModal.deviceId;

    const pollForProfile = async () => {
      try {
        const response = await fetch(`/api/devices/${previewDeviceId}`);
        if (!response.ok) {
          throw new Error("Nie udało się pobrać danych urządzenia.");
        }

        const nextDevice = (await response.json()) as Device;
        if (cancelled) {
          return;
        }

        setDevices((current) =>
          current.map((device) => (device.id === nextDevice.id ? nextDevice : device)),
        );

        if (hasDeviceDisplayProfile(nextDevice)) {
          setPreviewModal((current) =>
            current && current.deviceId === previewDeviceId
              ? {
                  ...current,
                  phase: "ready",
                  message: null,
                  requestedAt: null,
                }
              : current,
          );
          return;
        }
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.error("Error fetching device preview profile:", error);
      }

      if (Date.now() >= deadlineAt) {
        setPreviewModal((current) =>
          current && current.deviceId === previewDeviceId
            ? {
                ...current,
                phase: "error",
                message: "Nie udało się pobrać parametrów ekranu z podłączonego tabletu.",
                requestedAt: null,
              }
            : current,
        );
      }
    };

    void pollForProfile();
    const intervalId = window.setInterval(() => {
      void pollForProfile();
    }, 1000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [previewModal]);

  const handleLogout = async () => {
    try {
      closeMobilePanels();
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

  const openPairingScanner = () => {
    closeMobilePanels();
    closePreviewModal();
    closeDrawer();
    setPairingReturnMode("none");
    setPairingScannerOpen(true);
  };

  const handlePairingLookup = async (deviceId: string) => {
    const exactMatch =
      devices.find((device) => device.deviceId === deviceId) ??
      (await fetchDevices({ silent: true }))?.find((device) => device.deviceId === deviceId) ??
      null;

    if (!exactMatch) {
      return {
        ok: false as const,
        message: `Nie znaleziono tabletu ${formatPairingDeviceId(
          deviceId,
        )}. Odśwież /registry i spróbuj ponownie.`,
      };
    }

    setPairingScannerOpen(false);
    setPairingReturnMode("after-save");
    openDeviceEditor(exactMatch);

    return { ok: true as const };
  };

  const handlePreviewRetry = () => {
    if (!previewDevice) {
      return;
    }

    void openDevicePreview(previewDevice, { forceProfileRefresh: true });
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

  const updateDeviceRoomAssignment = async (deviceId: number, roomName: string) => {
    const response = await fetch(`/api/devices/${deviceId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: deviceId,
        deviceName: roomName,
        deviceClassroom: roomName,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        ok: false as const,
        message: errorData.message || "Nie udało się zapisać zmian.",
      };
    }

    return { ok: true as const };
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
      const deviceLabel =
        device.deviceClassroom || device.deviceName || formatPairingDeviceId(device.deviceId);
      const result = await updateDeviceRoomAssignment(device.id, sanitizedRoom);
      if (!result.ok) {
        setRoomError(result.message);
        return;
      }

      const shouldReturnToScanner = pairingReturnMode === "after-save";
      setPairingReturnMode("none");
      closeDrawer();
      pushToast(
        device.status === "PENDING"
          ? `Tablet ${deviceLabel} został sparowany.`
          : `Zapisano zmiany dla tabletu ${deviceLabel}.`,
        "success",
      );
      await fetchDevices();

      if (shouldReturnToScanner) {
        setPairingScannerOpen(true);
      }
    } catch (error) {
      console.error("Error registering device", error);
      setRoomError("Nie udało się zapisać zmian.");
      pushToast("Nie udało się zapisać zmian tabletu.", "danger");
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
      const deviceLabel =
        device.deviceClassroom || device.deviceName || formatPairingDeviceId(device.deviceId);
      const shouldReturnToScanner =
        pairingReturnMode === "after-save" && drawerDeviceId === device.id;
      const response = await fetch(`/api/devices/${device.id}`, { method: "DELETE" });
      if (!response.ok) {
        pushToast("Nie udało się usunąć urządzenia.", "danger");
        return;
      }

      if (drawerDeviceId === device.id) {
        closeDrawer();
      }
      if (previewModal?.deviceId === device.id) {
        closePreviewModal();
      }

      if (shouldReturnToScanner) {
        setPairingReturnMode("none");
      }

      pushToast(`Usunięto tablet ${deviceLabel}.`, "success");
      await fetchDevices();

      if (shouldReturnToScanner) {
        setPairingScannerOpen(true);
      }
    } catch (error) {
      console.error("Error deleting device:", error);
      pushToast("Wystąpił błąd podczas usuwania urządzenia.", "danger");
    }
  };

  const clearDeviceSelection = () => {
    setSelectedDeviceIds([]);
  };

  const handleToggleDeviceSelection = (deviceId: number) => {
    setSelectedDeviceIds((current) =>
      current.includes(deviceId)
        ? current.filter((currentId) => currentId !== deviceId)
        : [...current, deviceId],
    );
  };

  const handleToggleAllActiveDevices = (checked: boolean) => {
    setSelectedDeviceIds(checked ? activeDevices.map((device) => device.id) : []);
  };

  const handleDeleteSelectedDevices = async () => {
    const selectedDevices = activeDevices.filter((device) =>
      selectedDeviceIds.includes(device.id),
    );

    if (selectedDevices.length === 0) {
      pushToast("Zaznacz co najmniej jeden tablet.", "danger");
      return;
    }

    const shouldDelete = window.confirm(
      `Usunąć ${selectedDevices.length} zaznaczonych tabletów z rejestru?`,
    );
    if (!shouldDelete) {
      return;
    }

    try {
      setBatchMutationLoading(true);

      const results = await Promise.allSettled(
        selectedDevices.map((device) =>
          fetch(`/api/devices/${device.id}`, { method: "DELETE" }).then(async (response) => {
            if (!response.ok) {
              throw new Error("Nie udało się usunąć urządzenia.");
            }
          }),
        ),
      );

      const deletedCount = results.filter((result) => result.status === "fulfilled").length;
      const failedCount = results.length - deletedCount;

      if (failedCount > 0) {
        pushToast(
          `Usunięto ${deletedCount} z ${results.length} tabletów.`,
          deletedCount > 0 ? "warning" : "danger",
        );
      } else {
        pushToast(`Usunięto ${deletedCount} tabletów.`, "success");
      }

      if (deletedCount > 0) {
        if (drawerDeviceId !== null && selectedDeviceIds.includes(drawerDeviceId)) {
          closeDrawer();
        }
        if (previewModal !== null && selectedDeviceIds.includes(previewModal.deviceId)) {
          closePreviewModal();
        }

        clearDeviceSelection();
        await fetchDevices({ silent: true });
      }
    } catch (error) {
      console.error("Error deleting selected devices:", error);
      pushToast("Nie udało się usunąć zaznaczonych tabletów.", "danger");
    } finally {
      setBatchMutationLoading(false);
    }
  };

  const handleViewChange = (view: AdminPanelView) => {
    closeMobilePanels();
    closeDrawer();
    closePreviewModal();
    setPairingScannerOpen(false);
    setPairingReturnMode("none");

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

  const navigationItems: NavigationItem[] = [
    ...(Object.keys(adminViewMeta) as AdminPanelView[]).map((key) => ({
      key,
      label: adminViewMeta[key].label,
      icon: adminViewMeta[key].icon,
      active: currentView === key,
    })),
    {
      key: "pairing",
      label: "Tryb parowania",
      icon: "fas fa-camera",
      active: false,
    },
  ];

  const handleNavigationSelect = (key: AdminNavigationKey) => {
    closeMobilePanels();

    if (key === "pairing") {
      openPairingScanner();
      return;
    }

    handleViewChange(key);
  };

  useEffect(() => {
    const visibleIds = new Set(activeDevices.map((device) => device.id));
    setSelectedDeviceIds((current) => {
      const next = current.filter((deviceId) => visibleIds.has(deviceId));
      return next.length === current.length ? current : next;
    });
  }, [activeDevices]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [currentView]);

  useEffect(() => {
    const syncScrollTopVisibility = () => {
      setScrollTopVisible(window.scrollY > SCROLL_TOP_VISIBILITY_THRESHOLD_PX);
    };

    syncScrollTopVisibility();
    window.addEventListener("scroll", syncScrollTopVisibility, { passive: true });

    return () => window.removeEventListener("scroll", syncScrollTopVisibility);
  }, []);

  useEffect(() => {
    const toastStackNode = toastStackRef.current;

    if (!toastStackNode) {
      setToastStackOffset(0);
      return;
    }

    const syncToastStackOffset = () => {
      const nextHeight = Math.ceil(toastStackNode.getBoundingClientRect().height);
      setToastStackOffset(nextHeight > 0 ? nextHeight + SCROLL_TOP_TOAST_GAP_PX : 0);
    };

    syncToastStackOffset();

    const resizeListener = () => syncToastStackOffset();
    window.addEventListener("resize", resizeListener);

    if (typeof ResizeObserver === "undefined") {
      return () => {
        window.removeEventListener("resize", resizeListener);
      };
    }

    const observer = new ResizeObserver(() => {
      syncToastStackOffset();
    });

    observer.observe(toastStackNode);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", resizeListener);
    };
  }, [toasts.length]);

  const scrollTopButtonStyle: CSSProperties = {
    ["--admin-scroll-top-toast-offset" as const]:
      `${toastStackOffset}px`,
  };

  return (
    <div className="admin-console" data-admin-theme={adminTheme}>
      <header className="admin-console__appbar">
        <button
          type="button"
          className="admin-icon-button admin-console__mobile-trigger"
          onClick={toggleMobileNav}
          aria-label="Otwórz sekcje panelu"
          aria-expanded={isMobileNavOpen}
        >
          <i className="fas fa-bars" aria-hidden="true" />
        </button>

        <div className="admin-console__brand">
          <img className="admin-console__brand-logo" src={logo} alt="ZUT" />
          <div className="admin-console__brand-copy">
            <strong>PlanQR Admin</strong>
            {session?.login ? (
              <span className="admin-console__brand-user">Zalogowany: {session.login}</span>
            ) : null}
          </div>
        </div>

        <strong className="admin-console__mobile-title">PlanQR Admin</strong>

        <div className="admin-console__appbar-actions">
          <AdminPanelThemeToggle theme={adminTheme} onChange={setAdminTheme} />
          {lecturerPanelHref ? (
            <a
              className="admin-button admin-button--ghost admin-button--small"
              href={lecturerPanelHref}
            >
              Panel Dydaktyka
            </a>
          ) : null}
          <button
            type="button"
            className="admin-button admin-button--ghost admin-button--small"
            onClick={handleLogout}
          >
            Wyloguj
          </button>
        </div>

        <button
          type="button"
          className="admin-icon-button admin-console__mobile-trigger"
          onClick={toggleMobileSettings}
          aria-label="Otwórz ustawienia panelu"
          aria-expanded={isMobileSettingsOpen}
        >
          <i className="fas fa-cog" aria-hidden="true" />
        </button>
      </header>

      <div className="admin-console__body">
        <AdminPanelSidebar
          className="admin-nav--desktop"
          navigationItems={navigationItems}
          onItemSelect={handleNavigationSelect}
        />

        <main className="admin-console__main">
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
              batchUpdating={batchMutationLoading}
              selectedDeviceIds={selectedDeviceIds}
              searchTerm={searchTerm}
              sortBy={deviceSort}
              onSearchTermChange={setSearchTerm}
              onSortChange={setDeviceSort}
              onDeleteSelectedDevices={() => void handleDeleteSelectedDevices()}
              onClearSelectedDevices={clearDeviceSelection}
              onToggleAllActiveDevices={handleToggleAllActiveDevices}
              onToggleDeviceSelection={handleToggleDeviceSelection}
              onRefresh={() => void fetchDevices({ manual: true })}
              onReloadTablets={handleReloadAllTablets}
              onViewDevice={openDeviceDetails}
              onEditDevice={openDeviceEditor}
              onPreviewDevice={(device) => {
                void openDevicePreview(device);
              }}
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

      {isMobileNavOpen ? (
        <div
          className="admin-mobile-panel__overlay admin-mobile-panel__overlay--nav"
          onClick={closeMobilePanels}
        >
          <aside
            className="admin-mobile-panel admin-mobile-panel--nav"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="admin-mobile-panel__header">
              <h2 className="admin-mobile-panel__title">Sekcje</h2>
              <button
                type="button"
                className="admin-icon-button"
                onClick={closeMobilePanels}
                aria-label="Zamknij sekcje"
              >
                <i className="fas fa-times" aria-hidden="true" />
              </button>
            </header>
            <div className="admin-mobile-panel__body">
              <AdminPanelSidebar
                className="admin-nav--mobile"
                navigationItems={navigationItems}
                onItemSelect={handleNavigationSelect}
              />
            </div>
          </aside>
        </div>
      ) : null}

      {isMobileSettingsOpen ? (
        <div
          className="admin-mobile-panel__overlay admin-mobile-panel__overlay--settings"
          onClick={closeMobilePanels}
        >
          <aside
            className="admin-mobile-panel admin-mobile-panel--settings"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="admin-mobile-panel__header">
              <h2 className="admin-mobile-panel__title">Ustawienia</h2>
              <button
                type="button"
                className="admin-icon-button"
                onClick={closeMobilePanels}
                aria-label="Zamknij ustawienia"
              >
                <i className="fas fa-times" aria-hidden="true" />
              </button>
            </header>
            <div className="admin-mobile-panel__body">
              {session?.login ? (
                <div className="admin-mobile-panel__user">
                  <span>Zalogowany</span>
                  <strong>{session.login}</strong>
                </div>
              ) : null}

              <AdminPanelThemeToggle theme={adminTheme} onChange={setAdminTheme} />

              <div className="admin-mobile-panel__actions">
                {lecturerPanelHref ? (
                  <a
                    className="admin-button admin-button--ghost"
                    href={lecturerPanelHref}
                    onClick={closeMobilePanels}
                  >
                    Panel Dydaktyka
                  </a>
                ) : null}
                <button
                  type="button"
                  className="admin-button admin-button--ghost"
                  onClick={handleLogout}
                >
                  Wyloguj
                </button>
              </div>
            </div>
          </aside>
        </div>
      ) : null}

      {drawerMode && drawerDevice ? (
        <DeviceDrawer
          mode={drawerMode}
          device={drawerDevice}
          formClassroom={formClassroom}
          roomError={roomError}
          suggestions={suggestions}
          showSuggestions={showSuggestions}
          isSearching={isSearching}
          onClose={handleDrawerClose}
          onStartEdit={() => openDeviceEditor(drawerDevice)}
          onPreview={() => {
            void openDevicePreview(drawerDevice);
          }}
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

      {isPairingScannerOpen ? (
        <AdminPairingScanner
          onClose={() => {
            setPairingScannerOpen(false);
            setPairingReturnMode("none");
          }}
          onPair={handlePairingLookup}
        />
      ) : null}

      {previewModal && previewDevice ? (
        <DevicePreviewModal
          device={previewDevice}
          phase={previewModal.phase}
          message={previewModal.message}
          onClose={closePreviewModal}
          onRetry={handlePreviewRetry}
        />
      ) : null}

      <button
        type="button"
        className={`admin-scroll-top-button ${
          isScrollTopVisible ? "admin-scroll-top-button--visible" : ""
        }`}
        style={scrollTopButtonStyle}
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        aria-label="Przewiń na górę strony"
      >
        <i className="fas fa-arrow-up" aria-hidden="true" />
      </button>

      {toasts.length > 0 ? (
        <div
          ref={toastStackRef}
          className="admin-toast-stack"
          aria-live="polite"
          aria-atomic="false"
        >
          {toasts.map((toast) => (
            <div key={toast.id} className={`admin-toast admin-toast--${toast.tone}`}>
              <p className="admin-toast__message">{toast.message}</p>
              <button
                type="button"
                className="admin-toast__close"
                onClick={() => dismissToast(toast.id)}
                aria-label="Zamknij powiadomienie"
              >
                <i className="fas fa-times" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
};

export default AdminRegistry;
