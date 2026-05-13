import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa";
import LessonAttendancePanel from "./attendance/LessonAttendancePanel";
import {
  applyAttendanceListToDraft,
  createAttendanceDraft,
  type AttendanceDraft,
} from "./attendance/attendanceDrafts";
import { useTheme } from "../../context/ThemeContext";
import {
  addAttendanceSessionUser,
  closeAttendanceSession,
  fetchLessonAttendanceList,
  removeAttendanceSessionUser,
  sendAttendanceSession,
} from "../services/attendanceService";

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

  const applyAttendanceList = (attendanceList: Awaited<ReturnType<typeof fetchLessonAttendanceList>>) => {
    setDraft((current) => applyAttendanceListToDraft(current, attendanceList));
  };

  const loadAttendance = async (sessionIdOverride?: number | null) => {
    const sessionId = sessionIdOverride === undefined ? draft.sessionId : sessionIdOverride;

    if (!lessonId || (!doorId && !sessionId)) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const attendanceList = await fetchLessonAttendanceList({
        doorId,
        sessionId,
        from,
        to,
      });

      applyAttendanceList(attendanceList);
    } catch (loadError) {
      console.error("Error loading attendance list:", loadError);
      setError("Nie udało się pobrać aktywnej sesji obecności.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setDraft(createAttendanceDraft(lessonId, room));
    void loadAttendance(null);
  }, [lessonId, room, doorId, from, to]);

  const closeCurrentSession = async () => {
    if (!draft.sessionId) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      applyAttendanceList(await closeAttendanceSession(draft.sessionId));
    } catch (closeError) {
      console.error("Error closing attendance session:", closeError);
      setError("Nie udało się zamknąć sesji obecności.");
    } finally {
      setIsLoading(false);
    }
  };

  const sendCurrentSession = async () => {
    if (!draft.sessionId) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      applyAttendanceList(await sendAttendanceSession(draft.sessionId));
    } catch (sendError) {
      console.error("Error sending attendance session:", sendError);
      setError("Nie udało się przygotować JSON listy obecności.");
    } finally {
      setIsLoading(false);
    }
  };

  const addCurrentSessionUser = async (albumNumber: string, enteredAt: string | null) => {
    if (!draft.sessionId) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await addAttendanceSessionUser(draft.sessionId, {
        username: albumNumber,
        cardHex: albumNumber,
        enteredAt,
      });
      await loadAttendance(draft.sessionId);
    } catch (addError) {
      console.error("Error adding attendance user:", addError);
      setError("Nie udało się dodać wpisu do sesji obecności.");
    } finally {
      setIsLoading(false);
    }
  };

  const removeCurrentSessionUser = async (rowId: string, userId?: number) => {
    if (!draft.sessionId || !userId) {
      setDraft((current) => ({
        ...current,
        rows: current.rows.filter((row) => row.id !== rowId),
      }));
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await removeAttendanceSessionUser(draft.sessionId, userId);
      await loadAttendance(draft.sessionId);
    } catch (removeError) {
      console.error("Error removing attendance user:", removeError);
      setError("Nie udało się usunąć wpisu z sesji obecności.");
    } finally {
      setIsLoading(false);
    }
  };

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
            void loadAttendance(draft.status === "open" ? draft.sessionId : null);
          }}
          onCloseList={() => void closeCurrentSession()}
          onSendList={() => void sendCurrentSession()}
          onRefresh={() => void loadAttendance(draft.sessionId)}
          onAddRow={(albumNumber, enteredAt) => void addCurrentSessionUser(albumNumber, enteredAt)}
          onRemoveRow={(rowId, userId) => void removeCurrentSessionUser(rowId, userId)}
        />
      </div>
    </div>
  );
}
