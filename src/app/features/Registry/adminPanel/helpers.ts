import type {
  AdminPanelView,
  AdminPanelTheme,
  AdminRecord,
  Device,
  DeviceSortOption,
  NightModeSettings,
  Tone,
} from "./types";

export const ROOM_SEARCH_DEBOUNCE_MS = 350;
export const ROOM_SEARCH_MIN_LENGTH = 2;
const PAIRING_QR_TYPE = "planqr-pairing";

export const sanitizeRoomValue = (value: string) =>
  value.trim().replace(/\s+/g, " ");

export const sanitizePairingDeviceId = (value: string) => value.replace(/\s+/g, "").trim();

export const formatPairingDeviceId = (value: string) => {
  const normalizedValue = sanitizePairingDeviceId(value);
  const match = normalizedValue.match(/^(\d{3})(\d{3})$/);

  if (!match) {
    return value.trim();
  }

  return `${match[1]} ${match[2]}`;
};

export const normalizeRoomValue = (value: string) =>
  sanitizeRoomValue(value).toUpperCase();

export const buildPairingQrValue = (deviceId: string) =>
  JSON.stringify({
    type: PAIRING_QR_TYPE,
    deviceId: sanitizePairingDeviceId(deviceId),
  });

export const extractPairingDeviceId = (value: string) => {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmedValue) as { type?: unknown; deviceId?: unknown };
    if (parsed?.type === PAIRING_QR_TYPE && typeof parsed.deviceId === "string") {
      return sanitizePairingDeviceId(parsed.deviceId) || null;
    }
  } catch {
    // Ignore invalid JSON and continue with fallback formats.
  }

  try {
    const parsedUrl = new URL(trimmedValue);
    const deviceId = parsedUrl.searchParams.get("deviceId");
    if (deviceId) {
      return sanitizePairingDeviceId(deviceId) || null;
    }
  } catch {
    // Ignore invalid URLs and continue with fallback formats.
  }

  const prefixedValueMatch = trimmedValue.match(/^planqr(?:-device)?:([A-Za-z0-9_-]+)$/i);
  if (prefixedValueMatch) {
    return sanitizePairingDeviceId(prefixedValueMatch[1]) || null;
  }

  return sanitizePairingDeviceId(trimmedValue) || null;
};

export const defaultNightModeSettings: NightModeSettings = {
  enabled: false,
  startTime: "22:00",
  endTime: "06:00",
  blackScreenAfterScheduleEnd: false,
};

export const defaultAdminPanelTheme: AdminPanelTheme = "light";

export const adminViewMeta: Record<
  AdminPanelView,
  { label: string; title: string; icon: string }
> = {
  devices: {
    label: "Tablety",
    title: "Tablety",
    icon: "fas fa-tablet-alt",
  },
  admins: {
    label: "Administratorzy",
    title: "Administratorzy",
    icon: "fas fa-user-shield",
  },
  schedule: {
    label: "Czarny ekran",
    title: "Czarny ekran",
    icon: "fas fa-moon",
  },
};

const collator = new Intl.Collator("pl", {
  numeric: true,
  sensitivity: "base",
});

export const formatAdminDate = (value?: string | null) => {
  if (!value) {
    return null;
  }

  return new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
};

export const formatLastSeen = (value?: string) => {
  if (!value) {
    return "brak danych";
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return "brak danych";
  }

  return new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(parsedDate);
};

export const formatDisplayDimensions = (
  width?: number | null,
  height?: number | null,
) => {
  if (!width || !height) {
    return "brak danych";
  }

  return `${width} × ${height} px`;
};

export const formatDevicePixelRatio = (value?: number | null) => {
  if (!value) {
    return "brak danych";
  }

  return `${value.toFixed(value % 1 === 0 ? 0 : 2)}x`;
};

export const hasDeviceDisplayProfile = (device: Device) =>
  Boolean(
    device.viewportWidthPx &&
      device.viewportHeightPx &&
      device.screenWidthPx &&
      device.screenHeightPx &&
      device.devicePixelRatio,
  );

export const getAdminSourceLabel = (source: AdminRecord["adminSource"]) =>
  source === "panel" ? "Panel administracyjny" : "Baza danych";

export const getConnectionLabel = (device: Device) => {
  if (device.status !== "ACTIVE") {
    return "Oczekuje na akceptację";
  }

  return device.connectionStatus === "ONLINE" ? "Online" : "Offline";
};

export const getConnectionTone = (device: Device): Tone => {
  if (device.status !== "ACTIVE") {
    return "warning";
  }

  return device.connectionStatus === "ONLINE" ? "success" : "danger";
};

export const getDeviceDisplayName = (device: Device) =>
  device.deviceClassroom || device.deviceName || "Nieprzypisany tablet";

export const getDeviceSecondaryName = (device: Device) => {
  const displayName = getDeviceDisplayName(device);
  const secondary =
    device.deviceClassroom && device.deviceClassroom !== displayName
      ? device.deviceClassroom
      : device.deviceName && device.deviceName !== displayName
        ? device.deviceName
        : null;

  if (!secondary) {
    return null;
  }

  return secondary;
};

const getConnectionRank = (device: Device) => {
  if (device.status !== "ACTIVE") {
    return 2;
  }

  return device.connectionStatus === "ONLINE" ? 0 : 1;
};

export const matchesDeviceSearch = (device: Device, term: string) => {
  const normalizedTerm = term.trim().toLowerCase();

  if (!normalizedTerm) {
    return true;
  }

  const searchable = [
    device.deviceClassroom,
    device.deviceName,
    device.deviceId,
    formatPairingDeviceId(device.deviceId),
    getConnectionLabel(device),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return searchable.includes(normalizedTerm);
};

export const sortDevices = (devices: Device[], sortBy: DeviceSortOption) =>
  [...devices].sort((left, right) => {
    if (sortBy === "status") {
      const rankDiff = getConnectionRank(left) - getConnectionRank(right);
      if (rankDiff !== 0) {
        return rankDiff;
      }
    }

    if (sortBy === "lastSeen") {
      const timeDiff =
        new Date(right.lastSeen).getTime() - new Date(left.lastSeen).getTime();
      if (timeDiff !== 0) {
        return timeDiff;
      }
    }

    return collator.compare(getDeviceDisplayName(left), getDeviceDisplayName(right));
  });
