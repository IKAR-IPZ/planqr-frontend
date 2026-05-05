import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa";
import LessonAttendancePanel from "./attendance/LessonAttendancePanel";
import {
  createAttendanceDraft,
  createManualAttendanceRow,
  createScannerAttendanceRows,
  type AttendanceDraft,
} from "./attendance/attendanceDrafts";
import { useTheme } from "../../context/ThemeContext";
import { fetchLessonAttendanceList } from "../services/attendanceService";

export default function AttendancePanel() {
  const { lessonId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const searchParams = new URLSearchParams(location.search);
  const room =
    searchParams.get("room") || "Nieznana sala";
  const doorId = searchParams.get("door_id") || room;
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const [draft, setDraft] = useState<AttendanceDraft>(() =>
    createAttendanceDraft(lessonId, room),
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAttendance = async () => {
    if (!lessonId || !doorId || !from || !to) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const attendanceList = await fetchLessonAttendanceList({
        lessonId,
        doorId,
        from,
        to,
      });

      setDraft((current) => ({
        ...current,
        rows: [
          ...createScannerAttendanceRows(attendanceList.students),
          ...current.rows.filter((row) => row.source === "manual"),
        ],
        loadedAt: attendanceList.generatedAt,
        doorId: attendanceList.doorId,
        totalScans: attendanceList.totalScans,
        truncated: attendanceList.truncated,
      }));
    } catch (loadError) {
      console.error("Error loading attendance list:", loadError);
      setError("Nie udało się pobrać wpisów z logów obecności.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setDraft(createAttendanceDraft(lessonId, room));
    void loadAttendance();
  }, [lessonId, room, doorId, from, to]);

  return (
    <div className="admin-console attendance-page" data-admin-theme={theme}>
      <div className="attendance-page__shell">
        <button
          type="button"
          className="attendance-page__back"
          onClick={() => navigate(-1)}
        >
          <FaArrowLeft />
          Wróć do planu zajęć
        </button>

        <LessonAttendancePanel
          layout="page"
          lessonId={lessonId}
          draft={draft}
          isLoading={isLoading}
          error={error}
          onOpenList={() => {
            setDraft((current) => ({ ...current, status: "open", sentAt: null }));
            void loadAttendance();
          }}
          onCloseList={() =>
            setDraft((current) => ({ ...current, status: "closed" }))
          }
          onSendList={() =>
            setDraft((current) => ({
              ...current,
              status: "sent",
              sentAt: new Date().toISOString(),
            }))
          }
          onRefresh={from && to ? () => void loadAttendance() : undefined}
          onAddRow={(albumNumber, enteredAt) =>
            setDraft((current) => ({
              ...current,
              rows: [
                ...current.rows,
                createManualAttendanceRow(albumNumber, enteredAt),
              ],
            }))
          }
          onRemoveRow={(rowId) =>
            setDraft((current) => ({
              ...current,
              rows: current.rows.filter((row) => row.id !== rowId),
            }))
          }
        />
      </div>
    </div>
  );
}
