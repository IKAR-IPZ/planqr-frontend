import AdminPanelSection from "./AdminPanelSection";
import { formatPairingDeviceId } from "./helpers";
import type { Device, Tone } from "./types";

interface PendingDeviceAssignmentSectionProps {
  pendingDevicesCount: number;
  codeValue: string;
  codeSuggestions: Device[];
  selectedDevice: Device | null;
  roomValue: string;
  roomSuggestions: string[];
  showRoomSuggestions: boolean;
  isLookingUp: boolean;
  isAssigning: boolean;
  isSearchingRooms: boolean;
  codeTone: Tone;
  roomTone: Tone;
  feedback: string | null;
  feedbackTone: Tone;
  onCodeChange: (value: string) => void;
  onCodeSuggestionSelect: (device: Device) => void;
  onLookup: () => void;
  onReset: () => void;
  onRoomChange: (value: string) => void;
  onRoomSuggestionSelect: (room: string) => void;
  onAssign: () => void;
}

const PendingDeviceAssignmentSection = ({
  pendingDevicesCount,
  codeValue,
  codeSuggestions,
  selectedDevice,
  roomValue,
  roomSuggestions,
  showRoomSuggestions,
  isLookingUp,
  isAssigning,
  isSearchingRooms,
  codeTone,
  roomTone,
  feedback,
  feedbackTone,
  onCodeChange,
  onCodeSuggestionSelect,
  onLookup,
  onReset,
  onRoomChange,
  onRoomSuggestionSelect,
  onAssign,
}: PendingDeviceAssignmentSectionProps) => {
  const hasCodeSuggestions = !selectedDevice && codeSuggestions.length > 0 && codeValue.trim();

  return (
    <AdminPanelSection
      title="Dodaj tablet"
      actions={
        <div className="admin-status-inline">
          <span>
            Oczekujące: <strong>{pendingDevicesCount}</strong>
          </span>
        </div>
      }
    >
      <div className="admin-device-assignment">
        <div className="admin-device-assignment__form">
          <div className="admin-device-assignment__code-row">
            <label className="admin-form-field admin-device-assignment__code-field">
              <span className="admin-form-field__label">Kod tabletu</span>
              <div className="admin-autocomplete">
                <input
                  className={[
                    "admin-form-field__input",
                    "admin-device-assignment__code-input",
                    codeTone !== "neutral" ? `admin-form-field__input--${codeTone}` : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  inputMode="numeric"
                  placeholder="123 456"
                  value={codeValue}
                  onChange={(event) => onCodeChange(event.target.value)}
                  disabled={selectedDevice !== null}
                />
                {hasCodeSuggestions ? (
                  <div className="admin-autocomplete__list">
                    {codeSuggestions.map((device) => (
                      <button
                        key={device.id}
                        type="button"
                        className="admin-autocomplete__item admin-device-assignment__suggestion"
                        onClick={() => onCodeSuggestionSelect(device)}
                      >
                        {formatPairingDeviceId(device.deviceId)}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </label>

            <button
              type="button"
              className="admin-button admin-button--primary"
              onClick={onLookup}
              disabled={selectedDevice !== null || isLookingUp || !codeValue.trim()}
            >
              {isLookingUp ? "Szukam..." : "Dodaj"}
            </button>

            <button
              type="button"
              className="admin-button admin-button--ghost"
              onClick={onReset}
              disabled={isLookingUp || isAssigning}
            >
              Zmień kod
            </button>
          </div>

          <div className="admin-device-assignment__room-row">
            <label className="admin-form-field admin-form-field--grow">
              <span className="admin-form-field__label">Sala</span>
              <div className="admin-autocomplete">
                <input
                  className={[
                    "admin-form-field__input",
                    roomTone !== "neutral" ? `admin-form-field__input--${roomTone}` : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  placeholder="np. WI WI1-308"
                  value={roomValue}
                  onChange={(event) => onRoomChange(event.target.value)}
                  disabled={selectedDevice === null}
                />
                {isSearchingRooms ? (
                  <span className="admin-autocomplete__loading">
                    <i className="fas fa-spinner fa-spin" aria-hidden="true" />
                  </span>
                ) : null}
                {showRoomSuggestions && roomSuggestions.length > 0 ? (
                  <div className="admin-autocomplete__list">
                    {roomSuggestions.map((room) => (
                      <button
                        key={room}
                        type="button"
                        className="admin-autocomplete__item"
                        onClick={() => onRoomSuggestionSelect(room)}
                      >
                        {room}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </label>

            <button
              type="button"
              className="admin-button admin-button--secondary"
              onClick={onAssign}
              disabled={selectedDevice === null || isAssigning || !roomValue.trim()}
            >
              {isAssigning ? "Przydzielanie..." : "Przydziel"}
            </button>
          </div>

          <div className="admin-device-assignment__status-slot" aria-live="polite">
            <p
              className={[
                "admin-feedback",
                "admin-device-assignment__status",
                feedback ? `admin-feedback--${feedbackTone}` : "admin-device-assignment__status--hidden",
              ].join(" ")}
            >
              {feedback ?? "\u00A0"}
            </p>
          </div>
        </div>
      </div>
    </AdminPanelSection>
  );
};

export default PendingDeviceAssignmentSection;
