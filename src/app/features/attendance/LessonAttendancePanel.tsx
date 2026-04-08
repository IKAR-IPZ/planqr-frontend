import { useEffect, useState } from "react";
import { FaFileExport, FaPlus, FaTimes, FaTrash } from "react-icons/fa";
import "../Registry/AdminRegistry.css";
import type {
  AttendanceDraft,
  AttendanceDraftStatus,
} from "./attendanceDrafts";
import "./LessonAttendancePanel.css";

interface LessonAttendancePanelProps {
  lessonId?: string | number | null;
  draft?: AttendanceDraft | null;
  layout?: "panel" | "page";
  onOpenList?: () => void;
  onCloseList?: () => void;
  onSendList?: () => void;
  onAddRow?: (albumNumber: string, enteredAt: string | null) => void;
  onRemoveRow?: (rowId: string) => void;
  onClosePanel?: () => void;
}

const getDraftStatusLabel = (status: AttendanceDraftStatus) => {
  switch (status) {
    case "open":
      return "Lista otwarta";
    case "closed":
      return "Lista zamknięta";
    case "sent":
      return "Lista wysłana";
    case "idle":
    default:
      return "Gotowa do otwarcia";
  }
};

const formatSentAt = (value?: string | null) => {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("pl-PL", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(value));
};

const buildCurrentTime = () =>
  new Intl.DateTimeFormat("pl-PL", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date());

export default function LessonAttendancePanel({
  lessonId,
  draft,
  layout = "panel",
  onOpenList,
  onCloseList,
  onSendList,
  onAddRow,
  onRemoveRow,
  onClosePanel,
}: LessonAttendancePanelProps) {
  const [albumInput, setAlbumInput] = useState("");
  const [timeInput, setTimeInput] = useState("");

  useEffect(() => {
    setAlbumInput("");
    setTimeInput(buildCurrentTime());
  }, [lessonId]);

  if (!lessonId || !draft) {
    return (
      <section
        className={`lesson-attendance lesson-attendance--empty lesson-attendance--${layout}`}
      >
        <div className="lesson-attendance__empty">
          <h2>Wybierz zajęcia</h2>
          <p>Panel obecności otwiera się z prawej strony.</p>
        </div>
      </section>
    );
  }

  const isOpen = draft.status === "open";
  const canReopen = draft.status !== "open" && draft.status !== "sent";
  const canClose = draft.status === "open";
  const canSend = draft.status === "closed";
  const addDisabled = !isOpen || albumInput.trim().length === 0;

  return (
    <section className={`lesson-attendance lesson-attendance--${layout}`}>
      <header className="lesson-attendance__header">
        <strong>Lista obecności</strong>

        <div className="lesson-attendance__header-actions">
          <div className="lesson-attendance__status">
            <strong>{getDraftStatusLabel(draft.status)}</strong>
          </div>

          {onClosePanel ? (
            <button
              type="button"
              className="admin-icon-button"
              onClick={onClosePanel}
              aria-label="Zamknij panel obecności"
            >
              <FaTimes />
            </button>
          ) : null}
        </div>
      </header>

      <div className="lesson-attendance__composer">
        <input
          type="text"
          value={albumInput}
          placeholder="Numer albumu"
          onChange={(event) => setAlbumInput(event.target.value)}
          disabled={!isOpen}
        />

        <input
          type="time"
          value={timeInput}
          onChange={(event) => setTimeInput(event.target.value)}
          disabled={!isOpen}
        />

        <button
          type="button"
          className="admin-button admin-button--primary admin-button--small"
          disabled={addDisabled}
          onClick={() => {
            if (!onAddRow || addDisabled) {
              return;
            }

            onAddRow(albumInput.trim(), timeInput || null);
            setAlbumInput("");
            setTimeInput(buildCurrentTime());
          }}
        >
          <FaPlus />
          Dodaj
        </button>
      </div>

      <div className="lesson-attendance__list-shell">
        {draft.rows.length === 0 ? (
          <div className="lesson-attendance__empty-inline">Brak wpisów.</div>
        ) : (
          <ul className="lesson-attendance__list">
            {draft.rows.map((row) => (
              <li key={row.id} className="lesson-attendance__line">
                <div className="lesson-attendance__line-main">
                  <strong>{row.albumNumber}</strong>
                  <span className="lesson-attendance__separator">—</span>
                  <span>{row.enteredAt || "--:--"}</span>
                  <span className="lesson-attendance__source">
                    {row.source === "scanner" ? "skaner" : "ręczny"}
                  </span>
                </div>

                <button
                  type="button"
                  className="admin-button admin-button--ghost admin-button--small"
                  disabled={!isOpen}
                  onClick={() => onRemoveRow?.(row.id)}
                >
                  <FaTrash />
                  Usuń
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <footer className="lesson-attendance__footer">
        <div className="lesson-attendance__footer-note">
          {draft.sentAt ? `Wysłano ${formatSentAt(draft.sentAt)}` : ""}
        </div>

        <div className="lesson-attendance__footer-actions">
          <button
            type="button"
            className="admin-button admin-button--secondary admin-button--small"
            disabled={!canReopen}
            onClick={onOpenList}
          >
            Otwórz listę
          </button>
          <button
            type="button"
            className="admin-button admin-button--ghost admin-button--small"
            disabled={!canClose}
            onClick={onCloseList}
          >
            Zamknij listę
          </button>
          <button
            type="button"
            className="admin-button admin-button--primary admin-button--small"
            disabled={!canSend}
            onClick={onSendList}
          >
            <FaFileExport />
            Wyślij listę
          </button>
        </div>
      </footer>
    </section>
  );
}
