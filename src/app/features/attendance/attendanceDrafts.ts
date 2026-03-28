export type AttendanceSource = "scanner" | "manual";
export type AttendanceDraftStatus = "idle" | "open" | "closed" | "sent";

export interface AttendanceRow {
  id: string;
  albumNumber: string;
  enteredAt: string | null;
  source: AttendanceSource;
}

export interface AttendanceDraft {
  status: AttendanceDraftStatus;
  rows: AttendanceRow[];
  sentAt?: string | null;
}

const MOCK_SCANNER_LINKS: Record<string, string> = {
  admin: "KT-ADM-01",
  rafikg: "KT-LAB-12",
  default: "KT-DEMO-01",
};

const normalizeKey = (value?: string | number | null) =>
  String(value ?? "").trim().toLowerCase();

const hashSeed = (value: string) =>
  value.split("").reduce((sum, char, index) => sum + char.charCodeAt(0) * (index + 1), 0);

const buildRowId = (prefix: string, seed: string, index = 0) =>
  `${prefix}-${hashSeed(`${seed}-${index}`)}-${index}`;

const buildSeedRows = (lessonId?: string | number | null, room?: string | null) => {
  const seed = `${normalizeKey(lessonId)}-${normalizeKey(room)}`;
  const base = 55700 + (hashSeed(seed) % 120);
  const minuteOffset = hashSeed(`${seed}-time`) % 7;

  return [
    {
      id: buildRowId("scanner", seed, 0),
      albumNumber: String(base),
      enteredAt: `08:0${minuteOffset}`,
      source: "scanner" as const,
    },
    {
      id: buildRowId("scanner", seed, 1),
      albumNumber: String(base + 2),
      enteredAt: `08:1${(minuteOffset + 2) % 10}`,
      source: "scanner" as const,
    },
    {
      id: buildRowId("manual", seed, 2),
      albumNumber: String(base + 5),
      enteredAt: null,
      source: "manual" as const,
    },
  ];
};

export const getAttendanceScannerLink = (login?: string | null) => {
  const normalizedLogin = normalizeKey(login);

  if (!normalizedLogin) {
    return null;
  }

  return (
    MOCK_SCANNER_LINKS[normalizedLogin] ??
    MOCK_SCANNER_LINKS.default ??
    null
  );
};

export const hasAttendanceScanner = (login?: string | null) =>
  Boolean(getAttendanceScannerLink(login));

export const createAttendanceDraft = (
  lessonId?: string | number | null,
  room?: string | null,
): AttendanceDraft => ({
  status: "idle",
  rows: buildSeedRows(lessonId, room),
  sentAt: null,
});

export const createManualAttendanceRow = (
  albumNumber: string,
  enteredAt: string | null,
): AttendanceRow => ({
  id: buildRowId("manual", `${albumNumber}-${enteredAt ?? "none"}-${Date.now()}`),
  albumNumber,
  enteredAt,
  source: "manual",
});
