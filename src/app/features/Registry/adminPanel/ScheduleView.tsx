import AdminPanelSection from "./AdminPanelSection";
import type { EmergencyAlertSettings, NightModeSettings, Tone } from "./types";

interface ScheduleViewProps {
  settings: NightModeSettings;
  emergencyAlert: EmergencyAlertSettings;
  loading: boolean;
  saving: boolean;
  emergencySaving: boolean;
  feedback: string | null;
  feedbackTone: Tone;
  emergencyFeedback: string | null;
  emergencyFeedbackTone: Tone;
  onRefresh: () => void;
  onSettingChange: (next: NightModeSettings) => void;
  onEmergencyAlertChange: (next: EmergencyAlertSettings) => void;
  onSave: () => void;
  onEmergencyAlertSave: () => void;
}

const ScheduleView = ({
  settings,
  emergencyAlert,
  loading,
  saving,
  emergencySaving,
  feedback,
  feedbackTone,
  emergencyFeedback,
  emergencyFeedbackTone,
  onRefresh,
  onSettingChange,
  onEmergencyAlertChange,
  onSave,
  onEmergencyAlertSave,
}: ScheduleViewProps) => (
  <>
    <AdminPanelSection
      title="Alarm ewakuacyjny"
      actions={
        <button
          type="button"
          className="admin-button admin-button--secondary admin-button--small"
          onClick={onRefresh}
          disabled={loading || saving || emergencySaving}
        >
          <i className={`fas fa-sync-alt ${loading ? "fa-spin" : ""}`} aria-hidden="true" />
          {loading ? "Odświeżanie" : "Odśwież"}
        </button>
      }
    >
      <div className={`admin-emergency-card${emergencyAlert.enabled ? " is-active" : ""}`}>
        <div className="admin-emergency-card__copy">
          <span className="admin-emergency-card__eyebrow">
            {emergencyAlert.enabled ? "Aktywny alarm" : "Alarm wyłączony"}
          </span>
          <strong>Ekran ewakuacyjny na wszystkich tabletach</strong>
          <p>
            Po włączeniu tablet pokazuje pełnoekranowy komunikat PL/EN. Audio jest
            osobnym przełącznikiem.
          </p>
        </div>

        <div className="admin-settings-stack">
          <label className="admin-switch">
            <input
              type="checkbox"
              checked={emergencyAlert.enabled}
              onChange={(event) =>
                onEmergencyAlertChange({
                  ...emergencyAlert,
                  enabled: event.target.checked,
                })
              }
              disabled={loading || emergencySaving}
            />
            <span>Włącz alarm ewakuacyjny</span>
          </label>

          <label className="admin-switch">
            <input
              type="checkbox"
              checked={emergencyAlert.audioEnabled}
              onChange={(event) =>
                onEmergencyAlertChange({
                  ...emergencyAlert,
                  audioEnabled: event.target.checked,
                })
              }
              disabled={loading || emergencySaving}
            />
            <span>Odtwarzaj komunikat głosowy</span>
          </label>
        </div>
      </div>

      <div className="admin-emergency-preview">
        <div>
          <span>PL</span>
          <p>{emergencyAlert.messagePl}</p>
        </div>
        <div>
          <span>EN</span>
          <p>{emergencyAlert.messageEn}</p>
        </div>
      </div>

      <div className="admin-toolbar__actions">
        <button
          type="button"
          className={`admin-button ${
            emergencyAlert.enabled ? "admin-button--danger" : "admin-button--primary"
          }`}
          onClick={onEmergencyAlertSave}
          disabled={loading || emergencySaving}
        >
          <i className={`fas fa-exclamation-triangle ${emergencySaving ? "fa-spin" : ""}`} aria-hidden="true" />
          {emergencySaving
            ? "Zapisywanie"
            : emergencyAlert.enabled
              ? "Zapisz i włącz alarm"
              : "Zapisz i wyłącz alarm"}
        </button>
      </div>

      {emergencyFeedback ? (
        <p className={`admin-feedback admin-feedback--${emergencyFeedbackTone}`}>
          {emergencyFeedback}
        </p>
      ) : null}
    </AdminPanelSection>

    <AdminPanelSection title="Czarny ekran">
      <div className="admin-form-grid">
        <div className="admin-settings-stack">
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

          <label className="admin-switch">
            <input
              type="checkbox"
              checked={settings.blackScreenAfterScheduleEnd}
              onChange={(event) =>
                onSettingChange({
                  ...settings,
                  blackScreenAfterScheduleEnd: event.target.checked,
                })
              }
              disabled={loading || saving}
            />
            <span>Po zajęciach pokazuj czarny ekran</span>
          </label>
        </div>

        <div className="admin-status-inline">
          <span>Status</span>
          <strong>{settings.enabled ? "Aktywny" : "Wyłączony"}</strong>
          <span>
            {settings.startTime} - {settings.endTime}
          </span>
          <span>
            Po zajęciach:{" "}
            <strong>{settings.blackScreenAfterScheduleEnd ? "włączony" : "wyłączony"}</strong>
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
  </>
);

export default ScheduleView;
