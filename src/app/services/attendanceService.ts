export type AttendanceListStatus = "open" | "closed" | "sent" | string;
export type AttendanceStudentSource = "scanner" | "manual";

export interface LessonAttendanceStudent {
  id: number;
  userId: number;
  studentId: string;
  albumNumber: string;
  username: string;
  cardHex: string;
  present: true;
  source: AttendanceStudentSource;
  status: string;
  firstScannedAt: string;
  lastScannedAt: string;
  lastAccess: string;
  enteredAt: string;
  scanCount: number;
}

export interface LessonAttendanceList {
  status: AttendanceListStatus;
  sessionId: number;
  dydaktykId: number;
  lecturerId: string | null;
  lecturerUsername: string;
  lecturerCardHex: string;
  doorId: string | null;
  openedAt: string;
  closedAt: string | null;
  from: string;
  to: string;
  generatedAt: string;
  totalScans: number;
  totalPresent: number;
  truncated: boolean;
  students: LessonAttendanceStudent[];
}

interface FetchLessonAttendanceListParams {
  doorId?: string | null;
  sessionId?: number | null;
  from?: string | null;
  to?: string | null;
}

interface AddAttendanceSessionUserParams {
  username: string;
  cardHex?: string | null;
  enteredAt?: string | null;
  lastAccess?: string | null;
}

const getErrorText = async (response: Response) => {
  const errorText = await response.text();
  return `${response.status} ${errorText}`;
};

export const fetchLessonAttendanceList = async ({
  doorId,
  sessionId,
  from,
  to,
}: FetchLessonAttendanceListParams): Promise<LessonAttendanceList> => {
  const params = new URLSearchParams();

  if (sessionId) {
    params.set("session_id", String(sessionId));
  }

  if (doorId) {
    params.set("door_id", doorId);
  }

  if (from) {
    params.set("from", from);
  }

  if (to) {
    params.set("to", to);
  }

  const response = await fetch(
    `/api/attendance/list?${params.toString()}`,
    {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch attendance list: ${await getErrorText(response)}`);
  }

  return response.json();
};

export const closeAttendanceSession = async (
  sessionId: number,
): Promise<LessonAttendanceList> => {
  const response = await fetch(`/api/attendance/sessions/${sessionId}/close`, {
    method: "POST",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`Failed to close attendance session: ${await getErrorText(response)}`);
  }

  return response.json();
};

export const sendAttendanceSession = async (
  sessionId: number,
): Promise<LessonAttendanceList> => {
  const response = await fetch(`/api/attendance/sessions/${sessionId}/send`, {
    method: "POST",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`Failed to send attendance session: ${await getErrorText(response)}`);
  }

  return response.json();
};

export const addAttendanceSessionUser = async (
  sessionId: number,
  { username, cardHex, enteredAt, lastAccess }: AddAttendanceSessionUserParams,
): Promise<LessonAttendanceStudent> => {
  const response = await fetch(`/api/attendance/sessions/${sessionId}/users`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username,
      card_hex: cardHex || username,
      entered_at: enteredAt || undefined,
      last_access: lastAccess || undefined,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to add attendance user: ${await getErrorText(response)}`);
  }

  const payload = await response.json();
  return payload.user;
};

export const removeAttendanceSessionUser = async (
  sessionId: number,
  userId: number,
) => {
  const response = await fetch(`/api/attendance/sessions/${sessionId}/users/${userId}`, {
    method: "DELETE",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`Failed to remove attendance user: ${await getErrorText(response)}`);
  }
};
