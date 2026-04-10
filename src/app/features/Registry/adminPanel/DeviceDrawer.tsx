import { useEffect, useState, type CSSProperties } from "react";
import {
  formatDevicePixelRatio,
  formatDisplayDimensions,
  formatLastSeen,
  formatPairingDeviceId,
  getConnectionLabel,
  getConnectionTone,
  getDeviceDisplayName,
  hasDeviceDisplayProfile,
} from "./helpers";
import type { Device } from "./types";

const getViewportStyle = (): CSSProperties | undefined => {
  if (typeof window === "undefined" || !window.visualViewport) {
    return undefined;
  }

  return {
    height: `${Math.round(window.visualViewport.height)}px`,
    top: `${Math.max(0, Math.round(window.visualViewport.offsetTop))}px`,
  };
};

interface DeviceDrawerProps {
  mode: "details" | "edit";
  device: Device;
  formClassroom: string;
  roomError: string;
  suggestions: string[];
  showSuggestions: boolean;
  isSearching: boolean;
  onClose: () => void;
  onStartEdit: () => void;
  onPreview: () => void;
  onFormChange: (value: string) => void;
  onSuggestionSelect: (room: string) => void;
  onSave: () => void;
  onDelete: () => void;
}

const DeviceDrawer = ({
  mode,
  device,
  formClassroom,
  roomError,
  suggestions,
  showSuggestions,
  isSearching,
  onClose,
  onStartEdit,
  onPreview,
  onFormChange,
  onSuggestionSelect,
  onSave,
  onDelete,
}: DeviceDrawerProps) => {
  const [viewportStyle, setViewportStyle] = useState<CSSProperties | undefined>(() =>
    getViewportStyle(),
  );
  const displayName = getDeviceDisplayName(device);
  const isPending = device.status === "PENDING";
  const hasDisplayProfile = hasDeviceDisplayProfile(device);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) {
      return;
    }

    const syncViewport = () => {
      const nextStyle = getViewportStyle();

      setViewportStyle((currentStyle) => {
        if (
          currentStyle?.height === nextStyle?.height &&
          currentStyle?.top === nextStyle?.top
        ) {
          return currentStyle;
        }

        return nextStyle;
      });
    };

    syncViewport();
    viewport.addEventListener("resize", syncViewport);
    viewport.addEventListener("scroll", syncViewport);
    window.addEventListener("orientationchange", syncViewport);

    return () => {
      viewport.removeEventListener("resize", syncViewport);
      viewport.removeEventListener("scroll", syncViewport);
      window.removeEventListener("orientationchange", syncViewport);
    };
  }, []);

  return (
    <div className="admin-drawer__overlay" onClick={onClose}>
      <aside
        className="admin-drawer"
        style={viewportStyle}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="admin-drawer__header">
          <div className="admin-drawer__title-wrap">
            <h2 className="admin-drawer__title">
              {mode === "edit"
                ? isPending
                  ? "Autoryzuj tablet"
                  : "Edytuj tablet"
                : displayName}
            </h2>
            <div className="admin-drawer__meta">
              <span className="admin-table__meta-code">
                {formatPairingDeviceId(device.deviceId)}
              </span>
              <span
                className={`admin-status-pill admin-status-pill--${getConnectionTone(device)}`}
              >
                {getConnectionLabel(device)}
              </span>
            </div>
          </div>
          <button
            type="button"
            className="admin-icon-button"
            onClick={onClose}
            aria-label="Zamknij panel"
          >
            <i className="fas fa-times" aria-hidden="true" />
          </button>
        </header>

        <div className="admin-drawer__body">
          {mode === "details" ? (
            <>
              <div className="admin-drawer__summary">
                <strong>{displayName}</strong>
              </div>

              <div className="admin-detail-list">
                <div className="admin-detail-list__row">
                  <span>Sala</span>
                  <strong>{device.deviceClassroom || "-"}</strong>
                </div>
                <div className="admin-detail-list__row">
                  <span>Ostatni heartbeat</span>
                  <strong>{formatLastSeen(device.lastSeen)}</strong>
                </div>
                <div className="admin-detail-list__row">
                  <span>Viewport</span>
                  <strong>
                    {formatDisplayDimensions(device.viewportWidthPx, device.viewportHeightPx)}
                  </strong>
                </div>
                <div className="admin-detail-list__row">
                  <span>Ekran fizyczny</span>
                  <strong>
                    {formatDisplayDimensions(device.screenWidthPx, device.screenHeightPx)}
                  </strong>
                </div>
                <div className="admin-detail-list__row">
                  <span>Device pixel ratio</span>
                  <strong>{formatDevicePixelRatio(device.devicePixelRatio)}</strong>
                </div>
                <div className="admin-detail-list__row">
                  <span>Orientacja</span>
                  <strong>{device.screenOrientation || "-"}</strong>
                </div>
                <div className="admin-detail-list__row">
                  <span>Raport profilu</span>
                  <strong>{formatLastSeen(device.displayProfileReportedAt ?? undefined)}</strong>
                </div>
              </div>

              {!hasDisplayProfile ? (
                <p className="admin-feedback">
                  Profil ekranu zapisze się automatycznie, gdy tablet zgłosi swoje parametry.
                </p>
              ) : null}
            </>
          ) : (
            <>
              <div className="admin-drawer__summary">
                <strong>{displayName}</strong>
                <span className="admin-table__secondary">
                  {isPending ? "Przypisz salę przed zapisaniem." : "Zmień przypisaną salę."}
                </span>
              </div>

              <label className="admin-form-field">
                <span className="admin-form-field__label">Sala</span>
                <div className="admin-autocomplete">
                  <input
                    className="admin-form-field__input"
                    placeholder="np. WI WI1-308"
                    value={formClassroom}
                    onChange={(event) => onFormChange(event.target.value)}
                    autoFocus
                  />
                  {isSearching ? (
                    <span className="admin-autocomplete__loading">
                      <i className="fas fa-spinner fa-spin" aria-hidden="true" />
                    </span>
                  ) : null}
                  {showSuggestions && suggestions.length > 0 ? (
                    <div className="admin-autocomplete__list">
                      {suggestions.map((room) => (
                        <button
                          key={room}
                          type="button"
                          className="admin-autocomplete__item"
                          onClick={() => onSuggestionSelect(room)}
                        >
                          {room}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </label>

              {roomError ? (
                <p className="admin-feedback admin-feedback--danger">{roomError}</p>
              ) : null}
            </>
          )}
        </div>

        <footer className="admin-drawer__footer">
          {mode === "details" ? (
            <>
              <div className="admin-drawer__actions">
                <button
                  type="button"
                  className="admin-button admin-button--secondary"
                  onClick={onStartEdit}
                >
                  {isPending ? "Autoryzuj" : "Edytuj"}
                </button>
                {!isPending ? (
                  <button
                    type="button"
                    className="admin-button admin-button--ghost"
                    onClick={onPreview}
                  >
                    Podgląd
                  </button>
                ) : null}
                <button
                  type="button"
                  className="admin-button admin-button--danger"
                  onClick={onDelete}
                >
                  {isPending ? "Odrzuć" : "Usuń"}
                </button>
              </div>
              <button
                type="button"
                className="admin-button admin-button--ghost"
                onClick={onClose}
              >
                Zamknij
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="admin-button admin-button--danger"
                onClick={onDelete}
              >
                {isPending ? "Odrzuć" : "Usuń"}
              </button>
              <div className="admin-drawer__actions">
                <button
                  type="button"
                  className="admin-button admin-button--ghost"
                  onClick={onClose}
                >
                  Anuluj
                </button>
                <button
                  type="button"
                  className="admin-button admin-button--primary"
                  onClick={onSave}
                  disabled={!formClassroom.trim()}
                >
                  {isPending ? "Dodaj" : "Zapisz"}
                </button>
              </div>
            </>
          )}
        </footer>
      </aside>
    </div>
  );
};

export default DeviceDrawer;
