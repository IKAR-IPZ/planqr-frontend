import AdminPanelSection from "./AdminPanelSection";
import {
  formatLastSeen,
  formatPairingDeviceId,
  getDeviceDisplayName,
  getDeviceSecondaryName,
} from "./helpers";
import type { Device, Tone } from "./types";

interface PendingDeviceAssignmentSectionProps {
  pendingDevicesCount: number;
  codeValue: string;
  codeSuggestions: Device[];
  selectedDevice: Device | null;
  roomValue: string;
  roomError: string;
  roomSuggestions: string[];
  showRoomSuggestions: boolean;
  isLookingUp: boolean;
  isAssigning: boolean;
  isSearchingRooms: boolean;
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
  roomError,
  roomSuggestions,
  showRoomSuggestions,
  isLookingUp,
  isAssigning,
  isSearchingRooms,
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
  const deviceDisplayName = selectedDevice ? getDeviceDisplayName(selectedDevice) : null;
  const deviceSecondaryName = selectedDevice ? getDeviceSecondaryName(selectedDevice) : null;
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
                  className="admin-form-field__input admin-device-assignment__code-input"
                  inputMode="numeric"
                  placeholder="np. 123 456"
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
                        <span className="admin-device-assignment__suggestion-code">
                          {formatPairingDeviceId(device.deviceId)}
                        </span>
                        <span className="admin-device-assignment__suggestion-copy">
                          {formatLastSeen(device.lastSeen)}
                        </span>
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

          {feedback ? (
            <p className={`admin-feedback admin-feedback--${feedbackTone}`}>
              {feedback}
            </p>
          ) : null}

          {selectedDevice ? (
            <div className="admin-device-assignment__summary">
              <div className="admin-device-assignment__summary-copy">
                <strong>{`Tablet ${formatPairingDeviceId(selectedDevice.deviceId)}`}</strong>
                <span>
                  {deviceSecondaryName
                    ? `${deviceDisplayName} • ${deviceSecondaryName}`
                    : deviceDisplayName}
                </span>
              </div>
              <div className="admin-device-assignment__summary-meta">
                <span>Ostatni heartbeat: {formatLastSeen(selectedDevice.lastSeen)}</span>
                <span>Model: {selectedDevice.deviceModel || "brak danych"}</span>
              </div>
            </div>
          ) : null}

          <div className="admin-device-assignment__room-row">
            <label className="admin-form-field admin-form-field--grow">
              <span className="admin-form-field__label">Sala</span>
              <div className="admin-autocomplete">
                <input
                  className="admin-form-field__input"
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

          {roomError ? (
            <p className="admin-feedback admin-feedback--danger">{roomError}</p>
          ) : null}
        </div>
      </div>
    </AdminPanelSection>
  );
};

export default PendingDeviceAssignmentSection;
