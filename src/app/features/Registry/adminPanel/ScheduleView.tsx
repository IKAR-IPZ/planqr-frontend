import AdminPanelSection from "./AdminPanelSection";
import type { NightModeSettings } from "./types";

interface ScheduleViewProps {
  settings: NightModeSettings;
  loading: boolean;
  saving: boolean;
  feedback: string | null;
  onRefresh: () => void;
  onSettingChange: (next: NightModeSettings) => void;
  onSave: () => void;
}

const ScheduleView = ({
  settings,
  loading,
  saving,
  feedback,
  onRefresh,
  onSettingChange,
  onSave,
}: ScheduleViewProps) => (
  <>
    <AdminPanelSection
      eyebrow="Automatyzacja"
      title="Harmonogram czarnego ekranu"
      description="Konfiguracja godzin, w których tablety mają pokazywać całkowicie czarny ekran zamiast treści planu."
      actions={
        <button
          type="button"
          className="admin-button admin-button--secondary admin-button--small"
          onClick={onRefresh}
          disabled={loading || saving}
        >
          <i className={`fas fa-sync-alt ${loading ? "fa-spin" : ""}`} aria-hidden="true" />
          {loading ? "Odświeżanie..." : "Pobierz ustawienia"}
        </button>
      }
    >
      <div className="admin-schedule-grid">
        <div className="admin-card admin-card--form">
          <label className="admin-checkbox">
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(event) =>
                onSettingChange({
                  ...settings,
                  enabled: event.target.checked,
                })
              }
              disabled={loading || saving}
            />
            <span>Włącz harmonogram czarnego ekranu</span>
          </label>

          <div className="admin-time-grid">
            <label className="admin-form-field">
              <span className="admin-form-field__label">Start</span>
              <input
                className="admin-form-field__input"
                type="time"
                value={settings.startTime}
                onChange={(event) =>
                  onSettingChange({
                    ...settings,
                    startTime: event.target.value,
                  })
                }
                disabled={loading || saving}
              />
            </label>
            <label className="admin-form-field">
              <span className="admin-form-field__label">Koniec</span>
              <input
                className="admin-form-field__input"
                type="time"
                value={settings.endTime}
                onChange={(event) =>
                  onSettingChange({
                    ...settings,
                    endTime: event.target.value,
                  })
                }
                disabled={loading || saving}
              />
            </label>
          </div>

          <div className="admin-card__actions">
            <button
              type="button"
              className="admin-button admin-button--primary"
              onClick={onSave}
              disabled={loading || saving}
            >
              <i className={`fas fa-save ${saving ? "fa-spin" : ""}`} aria-hidden="true" />
              {saving ? "Zapisywanie..." : "Zapisz harmonogram"}
            </button>
          </div>

          {feedback ? <p className="admin-feedback">{feedback}</p> : null}
        </div>

        <div className="admin-card">
          <h3 className="admin-card__title">Jak działa harmonogram</h3>
          <ul className="admin-note-list">
            <li>Tablet przechodzi na czarny ekran w ustawionym przedziale czasowym.</li>
            <li>Po zakończeniu okna urządzenie wraca automatycznie do normalnego widoku.</li>
            <li>To ustawienie nie wyłącza fizycznie podświetlenia ekranu z poziomu przeglądarki.</li>
          </ul>
          <div className="admin-note-callout">
            <span className="admin-note-callout__label">Aktualny status</span>
            <strong>{settings.enabled ? "Aktywny" : "Wyłączony"}</strong>
            <span>
              Okno: {settings.startTime} - {settings.endTime}
            </span>
          </div>
        </div>
      </div>
    </AdminPanelSection>
  </>
);

export default ScheduleView;
