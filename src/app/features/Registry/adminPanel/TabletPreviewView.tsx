import { useEffect, useMemo, useRef, useState } from "react";
import "../../../layout/LecturerCalendar.css";
import AdminPanelSection from "./AdminPanelSection";
import {
  formatDevicePixelRatio,
  formatDisplayDimensions,
  formatLastSeen,
  formatPairingDeviceId,
  getConnectionLabel,
  getConnectionTone,
  getDeviceDisplayName,
} from "./helpers";
import {
  deleteMessage,
  fetchMessages,
  updateMessage,
  type MessageRecord,
} from "../../../services/messageService";
import type { Device, Tone } from "./types";

type PreviewPhase = "loading-profile" | "ready" | "error";

interface PreviewState {
  phase: PreviewPhase;
  message: string | null;
}

interface PreviewLesson {
  id: string;
  title: string;
  timeLabel: string;
  room: string;
  lecturer: string;
  groupName: string;
  messages: MessageRecord[];
}

interface ScheduleApiEvent {
  id: string;
  start?: string;
  end?: string;
  title?: string;
  subject?: string;
  worker_title?: string;
  room?: string;
  group_name?: string;
}

interface TabletPreviewViewProps {
  activeDevices: Device[];
  device: Device | null;
  state: PreviewState | null;
  onSelectDevice: (deviceId: number) => void;
  onRetryProfile: () => void;
  onUpdateDeviceDisplaySettings: (
    deviceId: number,
    payload: Partial<Pick<Device, "displayTheme" | "forceBlackScreen">>,
  ) => Promise<void>;
  onToast: (message: string, tone: Tone) => void;
}

const buildPreviewHref = (device: Device) => {
  if (!device.deviceClassroom || !device.deviceURL) {
    return null;
  }

  return `/tablet/${encodeURIComponent(device.deviceClassroom)}/${encodeURIComponent(
    device.deviceURL,
  )}?preview=1&deviceId=${device.id}`;
};

const formatLessonTime = (start?: string, end?: string) => {
  if (!start) {
    return "Brak godziny";
  }

  const startLabel = new Date(start).toLocaleTimeString("pl-PL", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (!end) {
    return startLabel;
  }

  const endLabel = new Date(end).toLocaleTimeString("pl-PL", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return `${startLabel} - ${endLabel}`;
};

const getRoomScheduleId = (room: string) => {
  const normalizedRoom = room.trim();
  if (!normalizedRoom) {
    return "";
  }

  const buildingMatch = normalizedRoom.match(/^([A-Z]+)/);
  const building = buildingMatch ? buildingMatch[1] : "WI";

  return normalizedRoom.startsWith(building)
    ? normalizedRoom
    : `${building} ${normalizedRoom}`;
};

const getScheduleRange = () => {
  const targetDate = new Date();
  const dayBefore = new Date(targetDate);
  dayBefore.setDate(dayBefore.getDate() - 1);
  const twoDaysAfter = new Date(targetDate);
  twoDaysAfter.setDate(twoDaysAfter.getDate() + 2);

  const todayLocal = `${targetDate.getFullYear()}-${String(
    targetDate.getMonth() + 1,
  ).padStart(2, "0")}-${String(targetDate.getDate()).padStart(2, "0")}`;

  return {
    todayLocal,
    start: dayBefore.toISOString().split("T")[0],
    end: twoDaysAfter.toISOString().split("T")[0],
  };
};

const TabletPreviewCanvas = ({
  device,
  state,
  onRetry,
}: {
  device: Device | null;
  state: PreviewState | null;
  onRetry: () => void;
}) => {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);
  const previewHref = device ? buildPreviewHref(device) : null;
  const viewportWidth = device?.viewportWidthPx ?? 0;
  const viewportHeight = device?.viewportHeightPx ?? 0;
  const phase = state?.phase ?? "error";
  const message = state?.message ?? "Wybierz tablet do podglądu.";

  useEffect(() => {
    if (!device || viewportWidth <= 0 || viewportHeight <= 0 || !stageRef.current) {
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
  }, [device, viewportHeight, viewportWidth]);

  const canRenderPreview =
    device &&
    state?.phase === "ready" &&
    Boolean(previewHref) &&
    viewportWidth > 0 &&
    viewportHeight > 0;

  return (
    <div className="tablet-preview-view__canvas" ref={stageRef}>
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
            key={`${device.id}:${device.displayTheme}:${device.forceBlackScreen}:${state?.phase}`}
            className="admin-preview__frame"
            src={previewHref}
            title={`Podgląd ${getDeviceDisplayName(device)}`}
          />
        </div>
      ) : (
        <div className={`admin-preview__state admin-preview__state--${phase}`}>
          {phase === "loading-profile" ? (
            <i className="fas fa-spinner fa-spin" aria-hidden="true" />
          ) : (
            <i className="fas fa-tablet-alt" aria-hidden="true" />
          )}
          <p>{message}</p>
          {phase === "error" && device ? (
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
  );
};

const TabletPreviewView = ({
  activeDevices,
  device,
  state,
  onSelectDevice,
  onRetryProfile,
  onUpdateDeviceDisplaySettings,
  onToast,
}: TabletPreviewViewProps) => {
  const [lessons, setLessons] = useState<PreviewLesson[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [editingMessageBody, setEditingMessageBody] = useState("");
  const [messageMutationId, setMessageMutationId] = useState<number | null>(null);
  const [settingsMutationKey, setSettingsMutationKey] = useState<
    "theme" | "black-screen" | null
  >(null);

  const sortedDevices = useMemo(
    () =>
      [...activeDevices].sort((left, right) =>
        getDeviceDisplayName(left).localeCompare(getDeviceDisplayName(right), "pl", {
          numeric: true,
          sensitivity: "base",
        }),
      ),
    [activeDevices],
  );

  useEffect(() => {
    if (!device?.deviceClassroom) {
      setLessons([]);
      setNotificationsError(null);
      setLoadingNotifications(false);
      return;
    }

    let cancelled = false;

    const loadNotifications = async () => {
      setLoadingNotifications(true);
      setNotificationsError(null);

      try {
        const { todayLocal, start, end } = getScheduleRange();
        const roomId = getRoomScheduleId(device.deviceClassroom || "");

        const response = await fetch(
          `/api/schedule?kind=room&id=${encodeURIComponent(roomId)}&start=${start}&end=${end}`,
        );

        if (!response.ok) {
          throw new Error("Nie udało się pobrać planu sali.");
        }

        const data = (await response.json()) as ScheduleApiEvent[];
        const todayEvents = data
          .filter((event) => event.start && event.id && event.start.split("T")[0] === todayLocal)
          .sort((left, right) => {
            const leftTime = left.start ? new Date(left.start).getTime() : 0;
            const rightTime = right.start ? new Date(right.start).getTime() : 0;
            return leftTime - rightTime;
          });

        const nextLessons = await Promise.all(
          todayEvents.map(async (event) => ({
            id: event.id,
            title: event.subject || event.title || "Zajęcia",
            timeLabel: formatLessonTime(event.start, event.end),
            room: event.room || device.deviceClassroom || "",
            lecturer: event.worker_title || "Brak danych",
            groupName: event.group_name || "",
            messages: await fetchMessages(event.id),
          })),
        );

        if (!cancelled) {
          setLessons(nextLessons);
        }
      } catch (error) {
        if (!cancelled) {
          setLessons([]);
          setNotificationsError(
            error instanceof Error
              ? error.message
              : "Nie udało się pobrać powiadomień dla wybranego tabletu.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingNotifications(false);
        }
      }
    };

    void loadNotifications();

    return () => {
      cancelled = true;
    };
  }, [device?.deviceClassroom, device?.id]);

  useEffect(() => {
    setEditingMessageId(null);
    setEditingMessageBody("");
    setMessageMutationId(null);
  }, [device?.id]);

  const updateLessons = (
    updater: (currentLessons: PreviewLesson[]) => PreviewLesson[],
  ) => {
    setLessons((currentLessons) => updater(currentLessons));
  };

  const handleThemeChange = async (nextTheme: Device["displayTheme"]) => {
    if (!device || nextTheme === device.displayTheme) {
      return;
    }

    try {
      setSettingsMutationKey("theme");
      await onUpdateDeviceDisplaySettings(device.id, { displayTheme: nextTheme });
      onToast(
        `Zmieniono motyw tabletu ${getDeviceDisplayName(device)} na ${
          nextTheme === "light" ? "jasny" : "ciemny"
        }.`,
        "success",
      );
    } catch (error) {
      onToast(
        error instanceof Error ? error.message : "Nie udało się zmienić motywu tabletu.",
        "danger",
      );
    } finally {
      setSettingsMutationKey(null);
    }
  };

  const handleBlackScreenToggle = async (checked: boolean) => {
    if (!device || checked === device.forceBlackScreen) {
      return;
    }

    try {
      setSettingsMutationKey("black-screen");
      await onUpdateDeviceDisplaySettings(device.id, { forceBlackScreen: checked });
      onToast(
        checked
          ? `Włączono czarny ekran dla tabletu ${getDeviceDisplayName(device)}.`
          : `Wyłączono czarny ekran dla tabletu ${getDeviceDisplayName(device)}.`,
        "success",
      );
    } catch (error) {
      onToast(
        error instanceof Error
          ? error.message
          : "Nie udało się zmienić stanu czarnego ekranu.",
        "danger",
      );
    } finally {
      setSettingsMutationKey(null);
    }
  };

  const handleDeleteMessage = async (messageId: number) => {
    setMessageMutationId(messageId);

    try {
      await deleteMessage(messageId);
      updateLessons((currentLessons) =>
        currentLessons.map((lesson) => ({
          ...lesson,
          messages: lesson.messages.filter((message) => message.id !== messageId),
        })),
      );
      if (editingMessageId === messageId) {
        setEditingMessageId(null);
        setEditingMessageBody("");
      }
      onToast("Usunięto powiadomienie.", "success");
    } catch (error) {
      onToast("Nie udało się usunąć powiadomienia.", "danger");
    } finally {
      setMessageMutationId(null);
    }
  };

  const handleSaveMessage = async (messageId: number) => {
    const nextBody = editingMessageBody.trim();
    if (!nextBody) {
      return;
    }

    setMessageMutationId(messageId);

    try {
      const updatedMessage = await updateMessage(messageId, { body: nextBody });
      updateLessons((currentLessons) =>
        currentLessons.map((lesson) => ({
          ...lesson,
          messages: lesson.messages.map((message) =>
            message.id === messageId ? updatedMessage : message,
          ),
        })),
      );
      setEditingMessageId(null);
      setEditingMessageBody("");
      onToast("Zapisano zmiany w powiadomieniu.", "success");
    } catch (error) {
      onToast("Nie udało się zapisać zmian w powiadomieniu.", "danger");
    } finally {
      setMessageMutationId(null);
    }
  };

  const selectedDeviceId = device?.id ?? "";

  return (
    <div className="tablet-preview-view">
      <div className="tablet-preview-view__main">
        <AdminPanelSection
          title="Podgląd tabletu"
          actions={
            <label className="admin-form-field admin-form-field--compact tablet-preview-view__select">
              <span className="admin-form-field__label">Tablet</span>
              <select
                className="admin-form-field__input"
                value={selectedDeviceId}
                onChange={(event) => onSelectDevice(Number(event.target.value))}
                disabled={sortedDevices.length === 0}
              >
                {sortedDevices.length === 0 ? (
                  <option value="">Brak sparowanych tabletów</option>
                ) : null}
                {sortedDevices.map((activeDevice) => (
                  <option key={activeDevice.id} value={activeDevice.id}>
                    {getDeviceDisplayName(activeDevice)} · {formatPairingDeviceId(activeDevice.deviceId)}
                  </option>
                ))}
              </select>
            </label>
          }
        >
          <TabletPreviewCanvas
            device={device}
            state={state}
            onRetry={onRetryProfile}
          />
        </AdminPanelSection>
      </div>

      <div className="tablet-preview-view__sidebar">
        <AdminPanelSection title="Sterowanie i szczegóły">
          {device ? (
            <div className="tablet-preview-view__stack">
              <div className="tablet-preview-view__summary">
                <div>
                  <strong>{getDeviceDisplayName(device)}</strong>
                  <span className="admin-table__secondary">
                    {formatPairingDeviceId(device.deviceId)}
                  </span>
                </div>
                <span
                  className={`admin-status-pill admin-status-pill--${getConnectionTone(device)}`}
                >
                  {getConnectionLabel(device)}
                </span>
              </div>

              <div className="admin-detail-list">
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
                  <strong>{device.screenOrientation || "brak danych"}</strong>
                </div>
                <div className="admin-detail-list__row">
                  <span>Raport profilu</span>
                  <strong>{formatLastSeen(device.displayProfileReportedAt ?? undefined)}</strong>
                </div>
              </div>

              <div className="tablet-preview-view__controls">
                <label className="admin-form-field">
                  <span className="admin-form-field__label">Tryb tabletu</span>
                  <select
                    className="admin-form-field__input"
                    value={device.displayTheme}
                    onChange={(event) =>
                      void handleThemeChange(event.target.value as Device["displayTheme"])
                    }
                    disabled={settingsMutationKey !== null}
                  >
                    <option value="dark">Ciemny</option>
                    <option value="light">Jasny</option>
                  </select>
                </label>

                <label className="admin-switch">
                  <input
                    type="checkbox"
                    checked={device.forceBlackScreen}
                    onChange={(event) =>
                      void handleBlackScreenToggle(event.target.checked)
                    }
                    disabled={settingsMutationKey !== null}
                  />
                  <span>Włącz czarny ekran dla tego tabletu</span>
                </label>
              </div>
            </div>
          ) : (
            <div className="admin-empty-state">
              <h3>Brak wybranego tabletu</h3>
              <p>Wybierz sparowane urządzenie, aby otworzyć jego podgląd.</p>
            </div>
          )}
        </AdminPanelSection>

        <AdminPanelSection title="Aktualne powiadomienia">
          {loadingNotifications ? (
            <div className="admin-empty-state">
              <h3>Ładowanie</h3>
              <p>Pobieranie dzisiejszych powiadomień dla wybranego tabletu.</p>
            </div>
          ) : notificationsError ? (
            <p className="admin-feedback admin-feedback--danger">{notificationsError}</p>
          ) : lessons.length === 0 ? (
            <div className="admin-empty-state">
              <h3>Brak zajęć lub powiadomień</h3>
              <p>Dla dzisiejszego planu sali nie znaleziono żadnych wpisów.</p>
            </div>
          ) : (
            <div className="tablet-preview-view__lessons">
              {lessons.map((lesson) => (
                <section key={lesson.id} className="tablet-preview-view__lesson">
                  <header className="tablet-preview-view__lesson-header">
                    <div>
                      <h3>{lesson.title}</h3>
                      <p>
                        {lesson.timeLabel}
                        {lesson.groupName ? ` · ${lesson.groupName}` : ""}
                      </p>
                    </div>
                    <span className="admin-table__secondary">
                      {lesson.room || "Brak sali"}
                    </span>
                  </header>

                  <p className="tablet-preview-view__lesson-meta">{lesson.lecturer}</p>

                  {lesson.messages.length === 0 ? (
                    <div className="lecturer-console__messages-empty">
                      Brak powiadomień.
                    </div>
                  ) : (
                    <div className="tablet-preview-view__messages">
                      {lesson.messages.map((message) => {
                        const isEditing = editingMessageId === message.id;
                        const isBusy = messageMutationId === message.id;
                        const isRoomChange = Boolean(message.isRoomChange);

                        return (
                          <article
                            key={message.id}
                            className={`lecturer-console__message${
                              isRoomChange
                                ? " lecturer-console__message--room-change"
                                : ""
                            }`}
                          >
                            <div className="lecturer-console__message-head">
                              <div className="lecturer-console__message-flags">
                                {isRoomChange ? (
                                  <span className="lecturer-console__message-chip">
                                    Zmiana sali
                                  </span>
                                ) : null}
                              </div>
                              <span>{formatLastSeen(message.createdAt)}</span>
                            </div>

                            {isEditing ? (
                              <textarea
                                className="lecturer-console__message-editor"
                                rows={3}
                                value={editingMessageBody}
                                onChange={(event) =>
                                  setEditingMessageBody(event.target.value)
                                }
                              />
                            ) : (
                              <p className="lecturer-console__message-text">
                                {isRoomChange
                                  ? `Zmiana sali: ${message.newRoom || "-"}`
                                  : message.body}
                              </p>
                            )}

                            {!isRoomChange ? (
                              <div className="lecturer-console__message-actions">
                                {isEditing ? (
                                  <>
                                    <button
                                      type="button"
                                      className="admin-button admin-button--primary admin-button--small"
                                      disabled={isBusy || !editingMessageBody.trim()}
                                      onClick={() => void handleSaveMessage(message.id)}
                                    >
                                      Zapisz
                                    </button>
                                    <button
                                      type="button"
                                      className="admin-button admin-button--ghost admin-button--small"
                                      disabled={isBusy}
                                      onClick={() => {
                                        setEditingMessageId(null);
                                        setEditingMessageBody("");
                                      }}
                                    >
                                      Anuluj
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      className="admin-button admin-button--ghost admin-button--small"
                                      disabled={isBusy}
                                      onClick={() => {
                                        setEditingMessageId(message.id);
                                        setEditingMessageBody(message.body);
                                      }}
                                    >
                                      Edytuj
                                    </button>
                                    <button
                                      type="button"
                                      className="admin-button admin-button--ghost admin-button--small"
                                      disabled={isBusy}
                                      onClick={() => void handleDeleteMessage(message.id)}
                                    >
                                      Usuń
                                    </button>
                                  </>
                                )}
                              </div>
                            ) : null}
                          </article>
                        );
                      })}
                    </div>
                  )}
                </section>
              ))}
            </div>
          )}
        </AdminPanelSection>
      </div>
    </div>
  );
};

export default TabletPreviewView;
