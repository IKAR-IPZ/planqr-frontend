export interface Device {
  id: number;
  deviceName: string | null;
  deviceClassroom: string | null;
  deviceURL: string | null;
  deviceId: string;
  status: "PENDING" | "ACTIVE";
  connectionStatus: "PENDING" | "ONLINE" | "OFFLINE";
  isConnected: boolean;
  lastSeen: string;
  ipAddress?: string;
  deviceModel?: string;
  userAgent?: string;
  macAddress?: string;
}

export interface NightModeSettings {
  enabled: boolean;
  startTime: string;
  endTime: string;
}

export interface AdminRecord {
  id: string;
  username: string;
  role: string;
  adminSource: "database" | "panel";
  createdAt: string | null;
  updatedAt: string | null;
  isCurrentUser: boolean;
  canBeRemovedFromPanel: boolean;
}

export type AdminPanelView = "devices" | "admins" | "schedule";
export type AdminPanelTheme = "light" | "dark";
export type DeviceSortOption = "name" | "status" | "lastSeen";

export type Tone = "neutral" | "success" | "warning" | "danger";
