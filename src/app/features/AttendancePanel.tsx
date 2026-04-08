import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa";
import LessonAttendancePanel from "./attendance/LessonAttendancePanel";
import {
  createAttendanceDraft,
  createManualAttendanceRow,
  type AttendanceDraft,
} from "./attendance/attendanceDrafts";
import { useTheme } from "../../context/ThemeContext";

export default function AttendancePanel() {
  const { lessonId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const room =
    new URLSearchParams(location.search).get("room") || "Nieznana sala";
  const [draft, setDraft] = useState<AttendanceDraft>(() =>
    createAttendanceDraft(lessonId, room),
  );

  useEffect(() => {
    setDraft(createAttendanceDraft(lessonId, room));
  }, [lessonId, room]);

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
          onOpenList={() =>
            setDraft((current) => ({ ...current, status: "open", sentAt: null }))
          }
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
