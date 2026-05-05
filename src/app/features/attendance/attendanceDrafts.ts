export type AttendanceSource = "scanner" | "manual";
export type AttendanceDraftStatus = "idle" | "open" | "closed" | "sent";

export interface AttendanceRow {
  id: string;
  albumNumber: string;
  enteredAt: string | null;
  source: AttendanceSource;
  firstScannedAt?: string;
  lastScannedAt?: string;
  scanCount?: number;
  attendanceLogIds?: number[];
}

export interface AttendanceDraft {
  status: AttendanceDraftStatus;
  lessonId?: string | null;
  rows: AttendanceRow[];
  sentAt?: string | null;
  loadedAt?: string | null;
  doorId?: string | null;
  totalScans?: number;
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

interface ScannerAttendanceRowSource {
  studentId: string;
  albumNumber: string;
  enteredAt: string;
  firstScannedAt: string;
  lastScannedAt: string;
  scanCount: number;
  attendanceLogIds: number[];
}

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
    lessonId: normalizedLessonId || null,
    rows: [],
    sentAt: null,
    loadedAt: null,
    doorId: room?.trim() || null,
    totalScans: 0,
    truncated: false,
  };
};

export const createScannerAttendanceRows = (
  students: ScannerAttendanceRowSource[],
): AttendanceRow[] =>
  students.map((student, index) => ({
    id: buildRowId(
      "scanner",
      `${student.studentId}-${student.firstScannedAt}-${student.lastScannedAt}`,
      index,
    ),
    albumNumber: student.albumNumber || student.studentId,
    enteredAt: student.enteredAt,
    source: "scanner",
    firstScannedAt: student.firstScannedAt,
    lastScannedAt: student.lastScannedAt,
    scanCount: student.scanCount,
    attendanceLogIds: student.attendanceLogIds,
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
