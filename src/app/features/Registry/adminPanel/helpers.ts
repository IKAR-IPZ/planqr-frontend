import type {
  AdminPanelView,
  AdminPanelTheme,
  AdminRecord,
  Device,
  DeviceSortState,
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

export const formatPairingDeviceInput = (value: string) => {
  const normalizedValue = sanitizePairingDeviceId(value).slice(0, 6);

  if (!normalizedValue) {
    return "";
  }

  return normalizedValue.replace(/(\d{3})(?=\d)/g, "$1 ").trim();
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
  "tablet-preview": {
    label: "Podgląd tabletu",
    title: "Podgląd tabletu",
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
  device.deviceClassroom || formatPairingDeviceId(device.deviceId) || "Nieprzypisany tablet";

export const getDeviceSecondaryName = (_device: Device) => null;

export const splitDeviceClassroom = (value?: string | null) => {
  const normalizedValue = sanitizeRoomValue(value || "");

  if (!normalizedValue) {
    return {
      facultyCode: "",
      roomLabel: "",
      fullLabel: "",
    };
  }

  const separatorIndex = normalizedValue.indexOf(" ");
  if (separatorIndex === -1) {
    return {
      facultyCode: "",
      roomLabel: normalizedValue,
      fullLabel: normalizedValue,
    };
  }

  return {
    facultyCode: normalizedValue.slice(0, separatorIndex),
    roomLabel: normalizedValue.slice(separatorIndex + 1).trim(),
    fullLabel: normalizedValue,
  };
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
    device.deviceId,
    formatPairingDeviceId(device.deviceId),
    getConnectionLabel(device),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return searchable.includes(normalizedTerm);
};

export const defaultDeviceSortState: DeviceSortState = {
  column: null,
  direction: null,
};

export const getNextDeviceSortState = (
  currentSort: DeviceSortState,
  column: NonNullable<DeviceSortState["column"]>,
): DeviceSortState => {
  if (currentSort.column !== column) {
    return {
      column,
      direction: "desc",
    };
  }

  if (currentSort.direction === "desc") {
    return {
      column,
      direction: "asc",
    };
  }

  return defaultDeviceSortState;
};

const compareDeviceRooms = (left: Device, right: Device) => {
  const leftRoom = splitDeviceClassroom(left.deviceClassroom);
  const rightRoom = splitDeviceClassroom(right.deviceClassroom);

  return (
    collator.compare(leftRoom.roomLabel, rightRoom.roomLabel) ||
    collator.compare(leftRoom.facultyCode, rightRoom.facultyCode) ||
    collator.compare(leftRoom.fullLabel, rightRoom.fullLabel) ||
    collator.compare(left.deviceId, right.deviceId)
  );
};

const compareDeviceFaculties = (left: Device, right: Device) => {
  const leftRoom = splitDeviceClassroom(left.deviceClassroom);
  const rightRoom = splitDeviceClassroom(right.deviceClassroom);

  return (
    collator.compare(leftRoom.facultyCode, rightRoom.facultyCode) ||
    compareDeviceRooms(left, right)
  );
};

const compareDeviceValues = (left: Device, right: Device, sortState: DeviceSortState) => {
  const { column, direction } = sortState;

  if (!column || !direction) {
    return compareDeviceRooms(left, right);
  }

  let comparison = 0;

  if (column === "room") {
    comparison = compareDeviceRooms(left, right);
  }

  if (column === "faculty") {
    comparison = compareDeviceFaculties(left, right);
  }

  if (column === "deviceId") {
    comparison = collator.compare(left.deviceId, right.deviceId);
  }

  if (column === "status") {
    comparison = getConnectionRank(left) - getConnectionRank(right);
  }

  if (column === "lastSeen") {
    comparison = new Date(left.lastSeen).getTime() - new Date(right.lastSeen).getTime();
  }

  if (column === "displayTheme") {
    comparison = collator.compare(left.displayTheme, right.displayTheme);
  }

  if (column === "blackScreen") {
    comparison = Number(left.effectiveBlackScreen) - Number(right.effectiveBlackScreen);
  }

  if (comparison === 0) {
    comparison = compareDeviceRooms(left, right);
  }

  return direction === "desc" ? -comparison : comparison;
};

export const sortDevices = (devices: Device[], sortState: DeviceSortState) =>
  [...devices].sort((left, right) => {
    return compareDeviceValues(left, right, sortState);
  });
