export interface LessonAttendanceStudent {
  studentId: string;
  albumNumber: string;
  present: true;
  source: "scanner";
  firstScannedAt: string;
  lastScannedAt: string;
  enteredAt: string;
  scanCount: number;
  attendanceLogIds: number[];
}

export interface LessonAttendanceList {
  status: "success";
  doorId: string;
  lecturerId: string | null;
  from: string;
  to: string;
  generatedAt: string;
  totalScans: number;
  totalPresent: number;
  truncated: boolean;
  students: LessonAttendanceStudent[];
}

interface FetchLessonAttendanceListParams {
  doorId: string;
  from: string;
  to: string;
}

export const fetchLessonAttendanceList = async ({
  doorId,
  from,
  to,
}: FetchLessonAttendanceListParams): Promise<LessonAttendanceList> => {
  const params = new URLSearchParams({
    door_id: doorId,
    from,
    to,
  });

  const response = await fetch(
    `/api/attendance/list?${params.toString()}`,
    {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch attendance list: ${response.status} ${errorText}`);
  }

  return response.json();
};
