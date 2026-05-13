import type {
  AttendanceListStatus,
  AttendanceStudentSource,
  LessonAttendanceList,
  LessonAttendanceStudent,
} from "../../services/attendanceService";

export type AttendanceSource = "scanner" | "manual";
export type AttendanceDraftStatus = "idle" | "open" | "closed" | "sent";

export interface AttendanceRow {
  id: string;
  userId?: number;
  albumNumber: string;
  username?: string;
  cardHex?: string;
  enteredAt: string | null;
  source: AttendanceSource;
  firstScannedAt?: string;
  lastScannedAt?: string;
  lastAccess?: string;
  status?: string;
  scanCount?: number;
}

export interface AttendanceDraft {
  status: AttendanceDraftStatus;
  sessionId?: number | null;
  lessonId?: string | null;
  rows: AttendanceRow[];
  sentAt?: string | null;
  loadedAt?: string | null;
  doorId?: string | null;
  lecturerUsername?: string | null;
  lecturerCardHex?: string | null;
  openedAt?: string | null;
  closedAt?: string | null;
  totalScans?: number;
  totalPresent?: number;
  truncated?: boolean;
}

const MOCK_SCANNER_LINKS: Record<string, string> = {
  admin: "KT-ADM-01",
  rafikg: "KT-LAB-12",
};

const normalizeKey = (value?: string | number | null) =>
  String(value ?? "").trim().toLowerCase();

const hashSeed = (value: string) =>
  value.split("").reduce((sum, char, index) => sum + char.charCodeAt(0) * (index + 1), 0);

const buildRowId = (prefix: string, seed: string, index = 0) =>
  `${prefix}-${hashSeed(`${seed}-${index}`)}-${index}`;

export const resolveAttendanceDoorId = (
  login?: string | null,
  room?: string | null,
) => {
  const normalizedLogin = normalizeKey(login);
  const mappedDoorId = normalizedLogin ? MOCK_SCANNER_LINKS[normalizedLogin] : null;

  return mappedDoorId ?? room?.trim() ?? null;
};

export const getAttendanceScannerLink = resolveAttendanceDoorId;

export const hasAttendanceScanner = (
  login?: string | null,
  room?: string | null,
) => Boolean(resolveAttendanceDoorId(login, room));

export const createAttendanceDraft = (
  lessonId?: string | number | null,
  room?: string | null,
): AttendanceDraft => {
  const normalizedLessonId = normalizeKey(lessonId);

  return {
    status: "idle",
    sessionId: null,
    lessonId: normalizedLessonId || null,
    rows: [],
    sentAt: null,
    loadedAt: null,
    doorId: room?.trim() || null,
    lecturerUsername: null,
    lecturerCardHex: null,
    openedAt: null,
    closedAt: null,
    totalScans: 0,
    totalPresent: 0,
    truncated: false,
  };
};

const resolveDraftStatus = (status: AttendanceListStatus): AttendanceDraftStatus => {
  if (status === "closed" || status === "sent") {
    return status;
  }

  return "open";
};

const resolveRowSource = (source: AttendanceStudentSource): AttendanceSource =>
  source === "manual" ? "manual" : "scanner";

export const createScannerAttendanceRows = (
  students: LessonAttendanceStudent[],
): AttendanceRow[] =>
  students.map((student, index) => ({
    id: buildRowId(
      student.source,
      `${student.id}-${student.studentId}-${student.firstScannedAt}-${student.lastScannedAt}`,
      index,
    ),
    userId: student.userId,
    albumNumber: student.albumNumber || student.studentId,
    username: student.username,
    cardHex: student.cardHex,
    enteredAt: student.enteredAt,
    source: resolveRowSource(student.source),
    firstScannedAt: student.firstScannedAt,
    lastScannedAt: student.lastScannedAt,
    lastAccess: student.lastAccess,
    status: student.status,
    scanCount: student.scanCount,
  }));

export const createManualAttendanceRow = (
  albumNumber: string,
  enteredAt: string | null,
): AttendanceRow => ({
  id: buildRowId("manual", `${albumNumber}-${enteredAt ?? "none"}-${Date.now()}`),
  albumNumber,
  enteredAt,
  source: "manual",
});

export const applyAttendanceListToDraft = (
  current: AttendanceDraft,
  attendanceList: LessonAttendanceList,
): AttendanceDraft => ({
  ...current,
  status: resolveDraftStatus(attendanceList.status),
  sessionId: attendanceList.sessionId,
  rows: createScannerAttendanceRows(attendanceList.students),
  loadedAt: attendanceList.generatedAt,
  sentAt: attendanceList.status === "sent"
    ? attendanceList.closedAt ?? attendanceList.generatedAt
    : current.sentAt,
  doorId: attendanceList.doorId,
  lecturerUsername: attendanceList.lecturerUsername,
  lecturerCardHex: attendanceList.lecturerCardHex,
  openedAt: attendanceList.openedAt,
  closedAt: attendanceList.closedAt,
  totalScans: attendanceList.totalScans,
  totalPresent: attendanceList.totalPresent,
  truncated: attendanceList.truncated,
});
