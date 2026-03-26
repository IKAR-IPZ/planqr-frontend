import AdminPanelSection from "./AdminPanelSection";
import type { NightModeSettings, Tone } from "./types";

interface ScheduleViewProps {
  settings: NightModeSettings;
  loading: boolean;
  saving: boolean;
  feedback: string | null;
  feedbackTone: Tone;
  onRefresh: () => void;
  onSettingChange: (next: NightModeSettings) => void;
  onSave: () => void;
}

const ScheduleView = ({
  settings,
  loading,
  saving,
  feedback,
  feedbackTone,
  onRefresh,
  onSettingChange,
  onSave,
}: ScheduleViewProps) => (
  <AdminPanelSection
    title="Czarny ekran"
    actions={
      <button
        type="button"
        className="admin-button admin-button--secondary admin-button--small"
        onClick={onRefresh}
        disabled={loading || saving}
      >
        <i className={`fas fa-sync-alt ${loading ? "fa-spin" : ""}`} aria-hidden="true" />
        {loading ? "Odświeżanie" : "Odśwież"}
      </button>
    }
  >
    <div className="admin-form-grid">
      <label className="admin-switch">
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
        <span>Włącz harmonogram</span>
      </label>

      <div className="admin-status-inline">
        <span>Status</span>
        <strong>{settings.enabled ? "Aktywny" : "Wyłączony"}</strong>
        <span>
          {settings.startTime} - {settings.endTime}
        </span>
      </div>
    </div>

    <div className="admin-form-grid admin-form-grid--times">
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
      <div className="admin-toolbar__actions">
        <button
          type="button"
          className="admin-button admin-button--primary"
          onClick={onSave}
          disabled={loading || saving}
        >
          <i className={`fas fa-save ${saving ? "fa-spin" : ""}`} aria-hidden="true" />
          {saving ? "Zapisywanie" : "Zapisz"}
        </button>
      </div>
    </div>

    {feedback ? (
      <p className={`admin-feedback admin-feedback--${feedbackTone}`}>{feedback}</p>
    ) : null}

    <p className="admin-note">
      WWW nie wyłącza fizycznie podświetlenia ekranu, tylko przełącza tablet na czarny widok.
    </p>
  </AdminPanelSection>
);

export default ScheduleView;
