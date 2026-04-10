import { useEffect, useRef, useState } from "react";
import {
  formatDevicePixelRatio,
  formatDisplayDimensions,
  formatLastSeen,
  getDeviceDisplayName,
  hasDeviceDisplayProfile,
} from "./helpers";
import type { Device } from "./types";

type PreviewPhase = "loading-profile" | "ready" | "error";

interface DevicePreviewModalProps {
  device: Device;
  phase: PreviewPhase;
  message: string | null;
  onClose: () => void;
  onRetry: () => void;
}

const buildPreviewHref = (device: Device) => {
  if (!device.deviceClassroom || !device.deviceURL) {
    return null;
  }

  return `/tablet/${encodeURIComponent(device.deviceClassroom)}/${encodeURIComponent(
    device.deviceURL,
  )}?preview=1`;
};

const DevicePreviewModal = ({
  device,
  phase,
  message,
  onClose,
  onRetry,
}: DevicePreviewModalProps) => {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);
  const displayName = getDeviceDisplayName(device);
  const previewHref = buildPreviewHref(device);
  const hasProfile = hasDeviceDisplayProfile(device);
  const viewportWidth = device.viewportWidthPx ?? 0;
  const viewportHeight = device.viewportHeightPx ?? 0;

  useEffect(() => {
    if (!hasProfile || !stageRef.current) {
      setScale(1);
      return;
    }

    const stageElement = stageRef.current;

    const updateScale = () => {
      const nextScale = Math.min(
        (stageElement.clientWidth - 24) / viewportWidth,
        (stageElement.clientHeight - 24) / viewportHeight,
        1,
      );

      setScale(Number.isFinite(nextScale) && nextScale > 0 ? nextScale : 1);
    };

    updateScale();

    const resizeObserver = new ResizeObserver(() => {
      updateScale();
    });

    resizeObserver.observe(stageElement);
    window.addEventListener("resize", updateScale);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateScale);
    };
  }, [hasProfile, viewportHeight, viewportWidth]);

  const canRenderPreview =
    phase === "ready" && hasProfile && Boolean(previewHref) && viewportWidth > 0 && viewportHeight > 0;

  return (
    <div className="admin-preview__overlay" onClick={onClose}>
      <section
        className="admin-preview__dialog"
        onClick={(event) => event.stopPropagation()}
        aria-modal="true"
        role="dialog"
        aria-label={`Podgląd tabletu ${displayName}`}
      >
        <header className="admin-preview__header">
          <div>
            <h2 className="admin-preview__title">Podgląd tabletu</h2>
            <p className="admin-preview__subtitle">{displayName}</p>
          </div>
          <button
            type="button"
            className="admin-icon-button"
            onClick={onClose}
            aria-label="Zamknij podgląd"
          >
            <i className="fas fa-times" aria-hidden="true" />
          </button>
        </header>

        <div className="admin-preview__body">
          <aside className="admin-preview__meta">
            <div className="admin-detail-list">
              <div className="admin-detail-list__row">
                <span>Ostatni heartbeat</span>
                <strong>{formatLastSeen(device.lastSeen)}</strong>
              </div>
              <div className="admin-detail-list__row">
                <span>Model</span>
                <strong>{device.deviceModel || "brak danych"}</strong>
              </div>
              <div className="admin-detail-list__row">
                <span>Adres IP</span>
                <strong>{device.ipAddress || "brak danych"}</strong>
              </div>
              <div className="admin-detail-list__row">
                <span>Viewport</span>
                <strong>
                  {formatDisplayDimensions(device.viewportWidthPx, device.viewportHeightPx)}
                </strong>
              </div>
              <div className="admin-detail-list__row">
                <span>Ekran fizyczny</span>
                <strong>{formatDisplayDimensions(device.screenWidthPx, device.screenHeightPx)}</strong>
              </div>
              <div className="admin-detail-list__row">
                <span>Device pixel ratio</span>
                <strong>{formatDevicePixelRatio(device.devicePixelRatio)}</strong>
              </div>
              <div className="admin-detail-list__row">
                <span>Orientacja</span>
                <strong>{device.screenOrientation || "brak danych"}</strong>
              </div>
              <div className="admin-detail-list__row">
                <span>Raport profilu</span>
                <strong>{formatLastSeen(device.displayProfileReportedAt ?? undefined)}</strong>
              </div>
              <div className="admin-detail-list__row">
                <span>Status</span>
                <strong>{device.connectionStatus === "ONLINE" ? "Online" : "Offline"}</strong>
              </div>
            </div>

            <div className="admin-preview__note">
              Podgląd renderuje ten sam widok webowy co tablet i skaluje go do zapisanych
              wymiarów viewportu.
            </div>
          </aside>

          <div className="admin-preview__canvas" ref={stageRef}>
            {canRenderPreview && previewHref ? (
              <div
                className="admin-preview__frame-shell"
                style={{
                  width: `${viewportWidth}px`,
                  height: `${viewportHeight}px`,
                  transform: `scale(${scale})`,
                }}
              >
                <iframe
                  className="admin-preview__frame"
                  src={previewHref}
                  title={`Podgląd ${displayName}`}
                />
              </div>
            ) : (
              <div className={`admin-preview__state admin-preview__state--${phase}`}>
                {phase === "loading-profile" ? (
                  <i className="fas fa-spinner fa-spin" aria-hidden="true" />
                ) : (
                  <i className="fas fa-tablet-alt" aria-hidden="true" />
                )}
                <p>{message || "Brak danych do wygenerowania podglądu."}</p>
                {phase === "error" ? (
                  <button
                    type="button"
                    className="admin-button admin-button--secondary"
                    onClick={onRetry}
                  >
                    Ponów
                  </button>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default DevicePreviewModal;
