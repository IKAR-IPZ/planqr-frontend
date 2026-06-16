export interface Device {
  id: number;
  deviceClassroom: string | null;
  deviceURL: string | null;
  deviceId: string;
  status: "PENDING" | "ACTIVE";
  displayTheme: "light" | "dark";
  blackScreenMode: "follow" | "on" | "off";
  scheduledBlackScreen: boolean;
  effectiveBlackScreen: boolean;
  connectionStatus: "PENDING" | "ONLINE" | "OFFLINE";
  isConnected: boolean;
  lastSeen: string;
  lastIpAddress?: string | null;
  macAddress?: string;
  viewportWidthPx?: number | null;
  viewportHeightPx?: number | null;
  screenWidthPx?: number | null;
  screenHeightPx?: number | null;
  devicePixelRatio?: number | null;
  screenOrientation?: string | null;
  displayProfileReportedAt?: string | null;
  priorityMessage?: TabletPriorityMessage;
}

export interface NightModeSettings {
  enabled: boolean;
  startTime: string;
  endTime: string;
  blackScreenAfterScheduleEnd: boolean;
}

export interface PriorityMessageTemplate {
  id: string;
  name: string;
  imageUrl: string;
  mediaType: "image" | "gif";
  isBuiltin: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface TabletPriorityMessage {
  enabled: boolean;
  template: PriorityMessageTemplate | null;
  updatedAt: string | null;
  updatedBy: string | null;
}

export type PriorityMessageScheduleTargetType = "devices" | "faculty";

export interface PriorityMessageScheduleDevice {
  id: number;
  deviceId: string;
  room: string | null;
  facultyCode: string | null;
}

export interface PriorityMessageSchedule {
  id: string;
  template: PriorityMessageTemplate;
  priority: number;
  targetType: PriorityMessageScheduleTargetType;
  facultyCode: string | null;
  deviceIds: number[];
  devices: PriorityMessageScheduleDevice[];
  startsAt: string;
  endsAt: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  status: "scheduled" | "active";
}

export interface PriorityMessageScheduleCollision {
  scheduleId: string;
  templateName: string;
  priority: number;
  startsAt: string;
  endsAt: string;
  deviceIds: number[];
  winnerScheduleId: string;
}

export interface PriorityMessageSchedulePayload {
  templateId: string;
  priority: number;
  targetType: PriorityMessageScheduleTargetType;
  facultyCode: string | null;
  deviceIds: number[];
  startsAt: string;
  endsAt: string;
}

export interface PriorityMessagePreset {
  id: string;
  name: string;
  template: PriorityMessageTemplate;
  priority: number;
  startOffsetDays: number;
  durationDays: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PriorityMessagePresetPayload {
  name: string;
  templateId: string;
  priority: number;
  startOffsetDays: number;
  durationDays: number;
}

export interface AdminRecord {
  id: string;
  username: string;
  adminSource: "database" | "panel" | "env";
  createdAt: string | null;
  updatedAt: string | null;
  isCurrentUser: boolean;
  canBeRemovedFromPanel: boolean;
}

export type AdminPanelView =
  | "devices"
  | "pending-tablets"
  | "tablet-preview"
  | "priority-gallery"
  | "admins"
  | "schedule";
export type AdminPanelTheme = "light" | "dark";
export type DeviceSortColumn =
  | "room"
  | "faculty"
  | "deviceId"
  | "status"
  | "lastSeen"
  | "displayTheme"
  | "blackScreen";

export interface DeviceSortState {
  column: DeviceSortColumn | null;
  direction: "asc" | "desc" | null;
}

export type Tone = "neutral" | "success" | "warning" | "danger";
