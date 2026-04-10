export interface Device {
  id: number;
  deviceName: string | null;
  deviceClassroom: string | null;
  deviceURL: string | null;
  deviceId: string;
  status: "PENDING" | "ACTIVE";
  displayTheme: "light" | "dark";
  forceBlackScreen: boolean;
  connectionStatus: "PENDING" | "ONLINE" | "OFFLINE";
  isConnected: boolean;
  lastSeen: string;
  ipAddress?: string;
  deviceModel?: string;
  userAgent?: string;
  macAddress?: string;
  viewportWidthPx?: number | null;
  viewportHeightPx?: number | null;
  screenWidthPx?: number | null;
  screenHeightPx?: number | null;
  devicePixelRatio?: number | null;
  screenOrientation?: string | null;
  displayProfileReportedAt?: string | null;
}

export interface NightModeSettings {
  enabled: boolean;
  startTime: string;
  endTime: string;
  blackScreenAfterScheduleEnd: boolean;
}

export interface AdminRecord {
  id: string;
  username: string;
  adminSource: "database" | "panel";
  createdAt: string | null;
  updatedAt: string | null;
  isCurrentUser: boolean;
  canBeRemovedFromPanel: boolean;
}

export type AdminPanelView = "devices" | "tablet-preview" | "admins" | "schedule";
export type AdminPanelTheme = "light" | "dark";
export type DeviceSortOption = "name" | "status" | "lastSeen";

export type Tone = "neutral" | "success" | "warning" | "danger";
