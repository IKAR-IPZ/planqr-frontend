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
import DevicesView from "./adminPanel/DevicesView";
import ScheduleView from "./adminPanel/ScheduleView";
import TabletPreviewView from "./adminPanel/TabletPreviewView";
import {
  adminViewMeta,
  defaultDeviceSortState,
  defaultAdminPanelTheme,
  defaultNightModeSettings,
  formatPairingDeviceId,
  formatPairingDeviceInput,
  getDeviceDisplayName,
  getNextDeviceSortState,
  hasDeviceDisplayProfile,
  matchesDeviceSearch,
  normalizeRoomValue,
  ROOM_SEARCH_DEBOUNCE_MS,
  ROOM_SEARCH_MIN_LENGTH,
  sanitizePairingDeviceId,
  sanitizeRoomValue,
  sortDevices,
} from "./adminPanel/helpers";
import type {
    AdminPanelTheme,
    AdminPanelView,
    AdminRecord,
    Device,
    DeviceSortState,
    NightModeSettings,
    Tone,
  } from "./adminPanel/types";

const ADMIN_THEME_STORAGE_KEY = "admin-theme";
const TOAST_DURATION_MS = 5000;
const ADMIN_SCROLL_ROOT_CLASS = "admin-console-scroll-root";
const MOBILE_BREAKPOINT_PX = 720;
const SCROLL_TOP_VISIBILITY_THRESHOLD_PX = 160;
const SCROLL_TOP_TOAST_GAP_PX = 12;

type AdminNavigationKey = AdminPanelView | "pairing" | "lecturer-preview";

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

const PAIRING_MESSAGE = {
  staleDevice: "Tablet już sparowany.",
  codeInvalid: "Błędny kod.",
  codeNotFound: "Nie znaleziono.",
  lookupError: "Błąd wyszukiwania.",
  lookupConnectionError: "Błąd połączenia.",
  found: "Tablet znaleziony.",
  roomRequired: "Wpisz salę.",
  roomInvalid: "Sala nie istnieje.",
  assignError: "Nie zapisano zmian.",
  assigned: "Tablet przypisany.",
} as const;

const getActiveView = (value: string | null): AdminPanelView => {
  if (value === "admins" || value === "schedule" || value === "tablet-preview") {
    return value;
  }

  return "devices";
};

const getPreviewDeviceId = (value: string | null) => {
  const parsedValue = Number(value);
  return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : null;
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
  const previewDeviceId = getPreviewDeviceId(searchParams.get("deviceId"));

  const [adminTheme, setAdminTheme] = useState<AdminPanelTheme>(getStoredAdminTheme);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(false);
  const [manualRefreshing, setManualRefreshing] = useState(false);
  const [admins, setAdmins] = useState<AdminRecord[]>([]);
  const [adminsLoading, setAdminsLoading] = useState(false);
  const [adminMutationLoading, setAdminMutationLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [deviceSort, setDeviceSort] = useState<DeviceSortState>(defaultDeviceSortState);
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<number[]>([]);
  const [batchMutationLoading, setBatchMutationLoading] = useState(false);
  const [batchThemeValue, setBatchThemeValue] = useState<Device["displayTheme"]>("dark");
  const [batchThemeLoading, setBatchThemeLoading] = useState(false);
  const [themeMutationDeviceId, setThemeMutationDeviceId] = useState<number | null>(null);
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
  const [previewState, setPreviewState] = useState<PreviewModalState | null>(null);
  const [formClassroom, setFormClassroom] = useState("");
  const [roomError, setRoomError] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState("");
  const [pairingDeviceId, setPairingDeviceId] = useState<number | null>(null);
  const [pairingRoom, setPairingRoom] = useState("");
  const [pairingRoomSuggestions, setPairingRoomSuggestions] = useState<string[]>([]);
  const [pairingShowRoomSuggestions, setPairingShowRoomSuggestions] = useState(false);
  const [pairingSelectedSuggestion, setPairingSelectedSuggestion] = useState<string | null>(null);
  const [pairingSearchingRooms, setPairingSearchingRooms] = useState(false);
  const [pairingLookingUp, setPairingLookingUp] = useState(false);
  const [pairingAssigning, setPairingAssigning] = useState(false);
  const [pairingCodeTone, setPairingCodeTone] = useState<Tone>("neutral");
  const [pairingRoomTone, setPairingRoomTone] = useState<Tone>("neutral");
  const [pairingFeedback, setPairingFeedback] = useState<string | null>(null);
  const [pairingFeedbackTone, setPairingFeedbackTone] = useState<Tone>("neutral");
  const [toasts, setToasts] = useState<AdminToast[]>([]);
  const [isPairingScannerOpen, setPairingScannerOpen] = useState(false);
  const [pairingReturnMode, setPairingReturnMode] =
    useState<"none" | "after-save">("none");
  const [isMobileNavOpen, setMobileNavOpen] = useState(false);
  const [isMobileSettingsOpen, setMobileSettingsOpen] = useState(false);
  const [isScrollTopVisible, setScrollTopVisible] = useState(false);
  const [toastStackOffset, setToastStackOffset] = useState(0);

  const roomSearchAbortRef = useRef<AbortController | null>(null);
  const roomSearchRequestIdRef = useRef(0);
  const pairingRoomSearchAbortRef = useRef<AbortController | null>(null);
  const pairingRoomSearchRequestIdRef = useRef(0);
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
      previewDeviceId === null
        ? null
        : devices.find((device) => device.id === previewDeviceId && device.status === "ACTIVE") ??
          null,
    [devices, previewDeviceId],
  );
  const pairingDevice = useMemo(
    () =>
      pairingDeviceId === null
        ? null
        : devices.find((device) => device.id === pairingDeviceId && device.status === "PENDING") ??
          null,
    [devices, pairingDeviceId],
  );
  const pairingSuggestions = useMemo(() => {
    const normalizedCode = sanitizePairingDeviceId(pairingCode);

    if (!normalizedCode || pairingDevice !== null) {
      return [];
    }

    return devices
      .filter(
        (device) => device.status === "PENDING" && device.deviceId.startsWith(normalizedCode),
      )
      .sort(
        (left, right) =>
          new Date(right.lastSeen).getTime() - new Date(left.lastSeen).getTime(),
      )
      .slice(0, 5);
  }, [devices, pairingCode, pairingDevice]);
  const allPendingDevices = devices.filter((device) => device.status === "PENDING");
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
    if (previewState !== null && !previewDevice) {
      setPreviewState(null);
    }
  }, [previewDevice, previewState]);

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
    const query = sanitizeRoomValue(pairingRoom);

    if (!pairingShowRoomSuggestions) {
      pairingRoomSearchAbortRef.current?.abort();
      pairingRoomSearchAbortRef.current = null;
      pairingRoomSearchRequestIdRef.current += 1;
      setPairingSearchingRooms(false);
      return;
    }

    if (query.length < ROOM_SEARCH_MIN_LENGTH) {
      pairingRoomSearchAbortRef.current?.abort();
      pairingRoomSearchAbortRef.current = null;
      pairingRoomSearchRequestIdRef.current += 1;
      setPairingRoomSuggestions([]);
      setPairingSearchingRooms(false);
      return;
    }

    const timer = window.setTimeout(() => {
      pairingRoomSearchAbortRef.current?.abort();
      const controller = new AbortController();
      pairingRoomSearchAbortRef.current = controller;
      const requestId = pairingRoomSearchRequestIdRef.current + 1;
      pairingRoomSearchRequestIdRef.current = requestId;

      setPairingSearchingRooms(true);

      void fetchRoomMatches(query, controller.signal)
        .then((rooms) => {
          if (
            !controller.signal.aborted &&
            requestId === pairingRoomSearchRequestIdRef.current
          ) {
            setPairingRoomSuggestions(rooms);
          }
        })
        .catch((error) => {
          if (!(error instanceof DOMException && error.name === "AbortError")) {
            console.error("Error searching pairing rooms:", error);
          }

          if (requestId === pairingRoomSearchRequestIdRef.current) {
            setPairingRoomSuggestions([]);
          }
        })
        .finally(() => {
          if (requestId === pairingRoomSearchRequestIdRef.current) {
            setPairingSearchingRooms(false);
          }
        });
    }, ROOM_SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [pairingRoom, pairingShowRoomSuggestions]);

  useEffect(() => {
    const toastTimeouts = toastTimeoutRef.current;

    return () => {
      roomSearchAbortRef.current?.abort();
      pairingRoomSearchAbortRef.current?.abort();
      for (const timeoutId of toastTimeouts.values()) {
        window.clearTimeout(timeoutId);
      }
      toastTimeouts.clear();
    };
  }, []);

  useEffect(() => {
    if (pairingDeviceId === null || pairingDevice !== null) {
      return;
    }

    pairingRoomSearchAbortRef.current?.abort();
    pairingRoomSearchAbortRef.current = null;
    pairingRoomSearchRequestIdRef.current += 1;
    setPairingDeviceId(null);
    setPairingRoom("");
    setPairingRoomSuggestions([]);
    setPairingShowRoomSuggestions(false);
    setPairingSelectedSuggestion(null);
    setPairingSearchingRooms(false);
    setPairingCodeTone("danger");
    setPairingRoomTone("neutral");
    setPairingFeedback(PAIRING_MESSAGE.staleDevice);
    setPairingFeedbackTone("warning");
  }, [pairingDevice, pairingDeviceId]);

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

  const resetPairingRoomSearch = () => {
    pairingRoomSearchAbortRef.current?.abort();
    pairingRoomSearchAbortRef.current = null;
    pairingRoomSearchRequestIdRef.current += 1;
    setPairingShowRoomSuggestions(false);
    setPairingRoomSuggestions([]);
    setPairingSearchingRooms(false);
    setPairingSelectedSuggestion(null);
  };

  const resetPairingSelection = (options?: { keepCode?: boolean }) => {
    resetPairingRoomSearch();
    setPairingDeviceId(null);
    setPairingRoom("");
    setPairingCodeTone("neutral");
    setPairingRoomTone("neutral");
    setPairingFeedback(null);
    setPairingFeedbackTone("neutral");

    if (!options?.keepCode) {
      setPairingCode("");
    }
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

  const setTabletPreviewSearchParams = (deviceId?: number | null) => {
    if (!deviceId) {
      setSearchParams({ view: "tablet-preview" });
      return;
    }

    setSearchParams({
      view: "tablet-preview",
      deviceId: String(deviceId),
    });
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
    closeMobilePanels();
    closeDrawer();
    setTabletPreviewSearchParams(device.id);

    if (device.status !== "ACTIVE" || !device.deviceClassroom || !device.deviceURL) {
      setPreviewState({
        deviceId: device.id,
        phase: "error",
        message: "Tablet nie ma kompletnej konfiguracji do podglądu.",
        requestedAt: null,
      });
      return;
    }

    if (hasDeviceDisplayProfile(device) && !options?.forceProfileRefresh) {
      setPreviewState({
        deviceId: device.id,
        phase: "ready",
        message: null,
        requestedAt: null,
      });
      return;
    }

    if (device.connectionStatus !== "ONLINE") {
      setPreviewState({
        deviceId: device.id,
        phase: "error",
        message:
          "Tablet nie ma jeszcze zapisanego profilu ekranu i nie jest aktualnie online.",
        requestedAt: null,
      });
      return;
    }

    setPreviewState({
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
        setPreviewState({
          deviceId: device.id,
          phase: "error",
          message: "Tablet nie odpowiedział na prośbę o przesłanie profilu ekranu.",
          requestedAt: null,
        });
      }
    } catch (error) {
      setPreviewState({
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

  const handleDeviceDisplaySettingsUpdate = async (
    deviceId: number,
    payload: Partial<Pick<Device, "displayTheme" | "forceBlackScreen">>,
  ) => {
    const response = await fetch(`/api/devices/${deviceId}/display-settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || "Nie udało się zapisać ustawień tabletu.");
    }

    if (data.device) {
      const nextDevice = data.device as Device;
      setDevices((current) =>
        current.map((device) => (device.id === nextDevice.id ? nextDevice : device)),
      );
    }

    return data;
  };

  const handleDeviceThemeChange = async (
    device: Device,
    displayTheme: Device["displayTheme"],
  ) => {
    if (displayTheme === device.displayTheme) {
      return;
    }

    try {
      setThemeMutationDeviceId(device.id);
      await handleDeviceDisplaySettingsUpdate(device.id, { displayTheme });
      pushToast(
        `Zmieniono motyw tabletu ${getDeviceDisplayName(device)} na ${
          displayTheme === "light" ? "jasny" : "ciemny"
        }.`,
        "success",
      );
    } catch (error) {
      pushToast(
        error instanceof Error ? error.message : "Nie udało się zmienić motywu tabletu.",
        "danger",
      );
    } finally {
      setThemeMutationDeviceId(null);
    }
  };

  const handleBatchThemeUpdate = async () => {
    const selectedDevices = pairedDevices.filter((device) =>
      selectedDeviceIds.includes(device.id),
    );

    if (selectedDevices.length === 0) {
      pushToast("Zaznacz co najmniej jeden tablet.", "danger");
      return;
    }

    try {
      setBatchThemeLoading(true);
      const response = await fetch("/api/devices/display-settings/batch", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceIds: selectedDevices.map((device) => device.id),
          displayTheme: batchThemeValue,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || "Nie udało się zapisać motywu dla zaznaczonych tabletów.");
      }

      const updatedDevices = Array.isArray(data.devices) ? (data.devices as Device[]) : [];
      if (updatedDevices.length > 0) {
        const updatedDeviceMap = new Map(updatedDevices.map((device) => [device.id, device]));
        setDevices((current) =>
          current.map((device) => updatedDeviceMap.get(device.id) ?? device),
        );
      }

      pushToast(
        `Zmieniono motyw ${updatedDevices.length || selectedDevices.length} tabletów na ${
          batchThemeValue === "light" ? "jasny" : "ciemny"
        }.`,
        "success",
      );
    } catch (error) {
      pushToast(
        error instanceof Error
          ? error.message
          : "Nie udało się zmienić motywu zaznaczonych tabletów.",
        "danger",
      );
    } finally {
      setBatchThemeLoading(false);
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
    if (currentView !== "tablet-preview") {
      return;
    }

    if (activeDevices.length === 0) {
      if (previewDeviceId !== null) {
        setTabletPreviewSearchParams(null);
      }
      return;
    }

    if (previewDevice) {
      if (!previewState || previewState.deviceId !== previewDevice.id) {
        void openDevicePreview(previewDevice);
      }
      return;
    }

    void openDevicePreview(activeDevices[0]);
  }, [activeDevices, currentView, previewDevice, previewDeviceId, previewState]);

  useEffect(() => {
    if (previewState?.phase !== "loading-profile" || previewState.requestedAt === null) {
      return;
    }

    let cancelled = false;
    const deadlineAt = previewState.requestedAt + 10_000;
    const requestedPreviewDeviceId = previewState.deviceId;

    const pollForProfile = async () => {
      try {
        const response = await fetch(`/api/devices/${requestedPreviewDeviceId}`);
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
          setPreviewState((current) =>
            current && current.deviceId === requestedPreviewDeviceId
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
        setPreviewState((current) =>
          current && current.deviceId === requestedPreviewDeviceId
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
  }, [previewState]);

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
        throw new Error(data.message || "Nie udało się dodać administratora.");
      }

      setNewAdminUsername("");
      setAdminFeedback(data.message || "Dodano administratora.");
      setAdminFeedbackTone("success");
      await fetchAdmins();
    } catch (error) {
      console.error("Error adding admin:", error);
      setAdminFeedback(
        error instanceof Error ? error.message : "Nie udało się dodać administratora.",
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
    closeDrawer();
    setPairingReturnMode("none");
    setPairingScannerOpen(true);
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

  const lookupPendingDeviceByCode = async (rawDeviceId: string) => {
    const normalizedDeviceId = sanitizePairingDeviceId(rawDeviceId);

    if (!/^\d{6}$/.test(normalizedDeviceId)) {
      return {
        ok: false as const,
        message: PAIRING_MESSAGE.codeInvalid,
      };
    }

    try {
      const response = await fetch(
        `/api/devices/pending/by-code?deviceId=${encodeURIComponent(normalizedDeviceId)}`,
      );
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        return {
          ok: false as const,
          message:
            response.status === 400
              ? PAIRING_MESSAGE.codeInvalid
              : response.status === 404
                ? PAIRING_MESSAGE.codeNotFound
                : PAIRING_MESSAGE.lookupError,
        };
      }

      const device = data as Device;
      setDevices((current) => {
        const exists = current.some((currentDevice) => currentDevice.id === device.id);
        return exists
          ? current.map((currentDevice) =>
              currentDevice.id === device.id ? device : currentDevice,
            )
          : [...current, device];
      });

      return { ok: true as const, device };
    } catch (error) {
      console.error("Error looking up pending device:", error);
      return {
        ok: false as const,
        message: PAIRING_MESSAGE.lookupConnectionError,
      };
    }
  };

  const selectPendingPairingDevice = (device: Device) => {
    if (currentView !== "devices") {
      setSearchParams({});
    }

    closeDrawer();
    setPairingScannerOpen(false);
    resetPairingRoomSearch();
    setPairingCode(formatPairingDeviceId(device.deviceId));
    setPairingDeviceId(device.id);
    setPairingRoom("");
    setPairingCodeTone("success");
    setPairingRoomTone("neutral");
    setPairingFeedback(PAIRING_MESSAGE.found);
    setPairingFeedbackTone("success");
  };

  const handleLookupPendingPairingDevice = async (rawDeviceId?: string) => {
    const deviceId = rawDeviceId ?? pairingCode;

    setPairingLookingUp(true);
    setPairingCodeTone("neutral");
    setPairingFeedback(null);
    setPairingFeedbackTone("neutral");

    const result = await lookupPendingDeviceByCode(deviceId);

    if (!result.ok) {
      setPairingCodeTone("danger");
      setPairingFeedback(result.message);
      setPairingFeedbackTone("danger");
      setPairingLookingUp(false);
      return result;
    }

    selectPendingPairingDevice(result.device);
    setPairingLookingUp(false);

    return { ok: true as const };
  };

  const handlePairingLookup = async (deviceId: string) => {
    const result = await lookupPendingDeviceByCode(deviceId);
    if (!result.ok) {
      return result;
    }

    setPairingScannerOpen(false);
    setPairingReturnMode("after-save");
    openDeviceEditor(result.device);

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
        device.deviceClassroom || formatPairingDeviceId(device.deviceId);
      const result = await updateDeviceRoomAssignment(device.id, sanitizedRoom);
      if (!result.ok) {
        setRoomError(result.message);
        return;
      }

      const shouldReturnToScanner = pairingReturnMode === "after-save";
      setPairingReturnMode("none");
      closeDrawer();
      pushToast(`Zapisano zmiany dla tabletu ${deviceLabel}.`, "success");
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

  const handleAssignPendingDevice = async () => {
    const device = pairingDevice;
    const sanitizedRoom = sanitizeRoomValue(pairingRoom);

    if (!device || !sanitizedRoom) {
      setPairingRoomTone("danger");
      setPairingFeedback(PAIRING_MESSAGE.roomRequired);
      setPairingFeedbackTone("danger");
      return;
    }

    resetPairingRoomSearch();

    const normalizedRoom = normalizeRoomValue(sanitizedRoom);
    const isValid =
      (pairingSelectedSuggestion !== null &&
        normalizeRoomValue(pairingSelectedSuggestion) === normalizedRoom) ||
      (await validateRoom(sanitizedRoom));

    if (!isValid) {
      setPairingRoomTone("danger");
      setPairingFeedback(PAIRING_MESSAGE.roomInvalid);
      setPairingFeedbackTone("danger");
      return;
    }

    try {
      setPairingAssigning(true);
      setPairingRoomTone("success");
      setPairingFeedback(null);
      setPairingFeedbackTone("neutral");
      const result = await updateDeviceRoomAssignment(device.id, sanitizedRoom);
      if (!result.ok) {
        setPairingRoomTone("danger");
        setPairingFeedback(PAIRING_MESSAGE.assignError);
        setPairingFeedbackTone("danger");
        return;
      }

      resetPairingSelection();
      setPairingFeedback(PAIRING_MESSAGE.assigned);
      setPairingFeedbackTone("success");
      await fetchDevices();
    } catch (error) {
      console.error("Error assigning pending device:", error);
      setPairingRoomTone("danger");
      setPairingFeedback(PAIRING_MESSAGE.assignError);
      setPairingFeedbackTone("danger");
    } finally {
      setPairingAssigning(false);
    }
  };

  const handlePairingCodeChange = (value: string) => {
    setPairingCode(formatPairingDeviceInput(value));
    setPairingCodeTone("neutral");
    setPairingFeedback(null);
    setPairingFeedbackTone("neutral");
  };

  const handlePairingRoomChange = (value: string) => {
    setPairingRoom(value);
    setPairingSelectedSuggestion(null);
    setPairingRoomTone("neutral");
    setPairingShowRoomSuggestions(true);
    setPairingFeedback(null);
    setPairingFeedbackTone("neutral");
  };

  const handleResetPairing = () => {
    resetPairingSelection();
  };

  const handlePairingSuggestionSelect = (device: Device) => {
    setPairingCode(formatPairingDeviceId(device.deviceId));
    void handleLookupPendingPairingDevice(device.deviceId);
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
        device.deviceClassroom || formatPairingDeviceId(device.deviceId);
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
      if (previewDeviceId === device.id) {
        setPreviewState(null);
        setTabletPreviewSearchParams(null);
      }
      if (pairingDeviceId === device.id) {
        resetPairingSelection();
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
        if (previewDeviceId !== null && selectedDeviceIds.includes(previewDeviceId)) {
          setPreviewState(null);
          setTabletPreviewSearchParams(null);
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
    setPairingReturnMode("none");
    setPairingScannerOpen(false);

    if (view === "devices") {
      setSearchParams({});
      return;
    }

    if (view === "tablet-preview") {
      if (previewDevice) {
        void openDevicePreview(previewDevice);
        return;
      }

      if (activeDevices.length > 0) {
        void openDevicePreview(activeDevices[0]);
        return;
      }

      setTabletPreviewSearchParams(null);
      return;
    }

    setSearchParams({ view });
  };

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
    {
      key: "lecturer-preview",
      label: "Podgląd dydaktyka",
      icon: "fas fa-user-tie",
      active: false,
    },
  ];

  const handleNavigationSelect = (key: AdminNavigationKey) => {
    closeMobilePanels();

    if (key === "pairing") {
      openPairingScanner();
      return;
    }

    if (key === "lecturer-preview") {
      navigate("/lecturerPlan?mode=admin-preview");
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
              pendingDevices={allPendingDevices}
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
              batchThemeUpdating={batchThemeLoading}
              themeMutationDeviceId={themeMutationDeviceId}
              batchThemeValue={batchThemeValue}
              selectedDeviceIds={selectedDeviceIds}
              searchTerm={searchTerm}
              sortState={deviceSort}
              pairingCode={pairingCode}
              pairingSuggestions={pairingSuggestions}
              pairingDevice={pairingDevice}
              pairingRoom={pairingRoom}
              pairingRoomSuggestions={pairingRoomSuggestions}
              pairingShowRoomSuggestions={pairingShowRoomSuggestions}
              pairingLookingUp={pairingLookingUp}
              pairingAssigning={pairingAssigning}
              pairingSearchingRooms={pairingSearchingRooms}
              pairingCodeTone={pairingCodeTone}
              pairingRoomTone={pairingRoomTone}
              pairingFeedback={pairingFeedback}
              pairingFeedbackTone={pairingFeedbackTone}
              onSearchTermChange={setSearchTerm}
              onSortColumn={(column) => {
                setDeviceSort((currentSort) => getNextDeviceSortState(currentSort, column));
              }}
              onDeleteSelectedDevices={() => void handleDeleteSelectedDevices()}
              onBatchThemeValueChange={setBatchThemeValue}
              onApplyBatchTheme={() => void handleBatchThemeUpdate()}
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
              onDeviceThemeChange={(device, theme) => {
                void handleDeviceThemeChange(device, theme);
              }}
              onDeleteDevice={handleDeleteDevice}
              onPairingCodeChange={handlePairingCodeChange}
              onPairingSuggestionSelect={handlePairingSuggestionSelect}
              onLookupPairingDevice={() => {
                void handleLookupPendingPairingDevice();
              }}
              onResetPairing={handleResetPairing}
              onPairingRoomChange={handlePairingRoomChange}
              onPairingRoomSuggestionSelect={(room) => {
                setPairingRoom(room);
                setPairingSelectedSuggestion(room);
                setPairingRoomTone("success");
                setPairingFeedback(null);
                setPairingFeedbackTone("neutral");
                setPairingShowRoomSuggestions(false);
                setPairingRoomSuggestions([]);
              }}
              onAssignPairingDevice={() => {
                void handleAssignPendingDevice();
              }}
            />
          ) : null}

          {currentView === "tablet-preview" ? (
            <TabletPreviewView
              activeDevices={pairedDevices}
              device={previewDevice}
              state={
                previewState && previewDeviceId !== null && previewState.deviceId === previewDeviceId
                  ? {
                      phase: previewState.phase,
                      message: previewState.message,
                    }
                  : null
              }
              onSelectDevice={(deviceId) => {
                const nextDevice = pairedDevices.find((device) => device.id === deviceId);
                if (nextDevice) {
                  void openDevicePreview(nextDevice);
                }
              }}
              onRetryProfile={handlePreviewRetry}
              onUpdateDeviceDisplaySettings={handleDeviceDisplaySettingsUpdate}
              onToast={pushToast}
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
            setPairingReturnMode("none");
            setPairingScannerOpen(false);
          }}
          onPair={handlePairingLookup}
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
