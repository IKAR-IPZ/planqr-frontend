import { useEffect, useMemo, useRef, useState } from "react";
import "../../../layout/LecturerCalendar.css";
import AdminPanelSection from "./AdminPanelSection";
import {
  ROOM_SEARCH_DEBOUNCE_MS,
  ROOM_SEARCH_MIN_LENGTH,
  formatDevicePixelRatio,
  formatDisplayDimensions,
  formatLastSeen,
  formatPairingDeviceId,
  getConnectionLabel,
  getConnectionTone,
  getDeviceDisplayName,
  sanitizeRoomValue,
  splitDeviceClassroom,
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
  onEditDevice: (device: Device) => void;
  onDeleteDevice: (device: Device) => void;
  onUpdateDeviceDisplaySettings: (
    deviceId: number,
    payload: Partial<Pick<Device, "displayTheme" | "blackScreenMode">>,
  ) => Promise<void>;
  onToast: (message: string, tone: Tone) => void;
}

const PREVIEW_NOTIFICATIONS_REFRESH_MS = 15000;

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

const getBlackScreenStatusLabel = (device: Device) => {
  if (device.blackScreenMode === "follow") {
    return device.scheduledBlackScreen ? "Harmonogram włączony" : "Harmonogram wyłączony";
  }

  return device.blackScreenMode === "on" ? "Ręcznie włączony" : "Ręcznie wyłączony";
};

const matchesDevicePickerQuery = (device: Device, rawQuery: string) => {
  const query = sanitizeRoomValue(rawQuery).toLowerCase();
  if (!query) {
    return true;
  }

  const roomParts = splitDeviceClassroom(device.deviceClassroom);
  const searchIndex = [
    getDeviceDisplayName(device),
    roomParts.fullLabel,
    roomParts.roomLabel,
    roomParts.facultyCode,
    formatPairingDeviceId(device.deviceId),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return searchIndex.includes(query);
};

const getDevicePickerLabel = (device: Device) => {
  const roomParts = splitDeviceClassroom(device.deviceClassroom);
  return roomParts.roomLabel || getDeviceDisplayName(device);
};

const fetchRoomMatches = async (query: string, signal?: AbortSignal) => {
  const sanitizedQuery = sanitizeRoomValue(query);
  if (!sanitizedQuery) {
    return [];
  }

  const response = await fetch(
    `/schedule.php?kind=room&query=${encodeURIComponent(sanitizedQuery)}`,
    { signal },
  );

  if (!response.ok) {
    return [];
  }

  const data = await response.json();
  return Array.isArray(data)
    ? Array.from(
        new Set(
          data
            .filter((item: { item?: unknown }) => typeof item?.item === "string")
            .map((item: { item: string }) => sanitizeRoomValue(item.item))
            .filter(Boolean),
        ),
      )
    : [];
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
            key={`${device.id}:${device.displayTheme}:${device.blackScreenMode}:${device.effectiveBlackScreen}:${state?.phase}`}
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
  onEditDevice,
  onDeleteDevice,
  onUpdateDeviceDisplaySettings,
  onToast,
}: TabletPreviewViewProps) => {
  const [lessons, setLessons] = useState<PreviewLesson[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [editingMessageBody, setEditingMessageBody] = useState("");
  const [editingMessageRoom, setEditingMessageRoom] = useState("");
  const [editingRoomSuggestions, setEditingRoomSuggestions] = useState<string[]>([]);
  const [showEditingRoomSuggestions, setShowEditingRoomSuggestions] = useState(false);
  const [searchingEditingRooms, setSearchingEditingRooms] = useState(false);
  const [messageMutationId, setMessageMutationId] = useState<number | null>(null);
  const [settingsMutationKey, setSettingsMutationKey] = useState<
    "theme" | "black-screen" | null
  >(null);
  const [deviceQuery, setDeviceQuery] = useState("");
  const [showDeviceSuggestions, setShowDeviceSuggestions] = useState(false);
  const editingRoomSearchAbortRef = useRef<AbortController | null>(null);
  const editingRoomSearchRequestIdRef = useRef(0);
  const pauseNotificationsRefreshRef = useRef(false);

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
  const filteredDevices = useMemo(
    () =>
      sortedDevices
        .filter((activeDevice) => matchesDevicePickerQuery(activeDevice, deviceQuery))
        .slice(0, 8),
    [deviceQuery, sortedDevices],
  );

  useEffect(() => {
    setDeviceQuery(device ? getDevicePickerLabel(device) : "");
  }, [device?.id, device?.deviceClassroom, device?.deviceId]);

  useEffect(() => {
    pauseNotificationsRefreshRef.current =
      editingMessageId !== null || messageMutationId !== null;
  }, [editingMessageId, messageMutationId]);

  useEffect(() => {
    const query = sanitizeRoomValue(editingMessageRoom);

    if (!showEditingRoomSuggestions) {
      editingRoomSearchAbortRef.current?.abort();
      editingRoomSearchAbortRef.current = null;
      editingRoomSearchRequestIdRef.current += 1;
      setEditingRoomSuggestions([]);
      setSearchingEditingRooms(false);
      return;
    }

    if (query.length < ROOM_SEARCH_MIN_LENGTH) {
      editingRoomSearchAbortRef.current?.abort();
      editingRoomSearchAbortRef.current = null;
      editingRoomSearchRequestIdRef.current += 1;
      setEditingRoomSuggestions([]);
      setSearchingEditingRooms(false);
      return;
    }

    const timer = window.setTimeout(() => {
      editingRoomSearchAbortRef.current?.abort();
      const controller = new AbortController();
      editingRoomSearchAbortRef.current = controller;
      const requestId = editingRoomSearchRequestIdRef.current + 1;
      editingRoomSearchRequestIdRef.current = requestId;

      setSearchingEditingRooms(true);

      void fetchRoomMatches(query, controller.signal)
        .then((rooms) => {
          if (
            !controller.signal.aborted &&
            requestId === editingRoomSearchRequestIdRef.current
          ) {
            setEditingRoomSuggestions(rooms);
          }
        })
        .catch((error) => {
          if (!(error instanceof DOMException && error.name === "AbortError")) {
            console.error("Error searching message rooms:", error);
          }

          if (requestId === editingRoomSearchRequestIdRef.current) {
            setEditingRoomSuggestions([]);
          }
        })
        .finally(() => {
          if (requestId === editingRoomSearchRequestIdRef.current) {
            setSearchingEditingRooms(false);
          }
        });
    }, ROOM_SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [editingMessageRoom, showEditingRoomSuggestions]);

  useEffect(() => {
    if (!device?.deviceClassroom) {
      setLessons([]);
      setNotificationsError(null);
      setLoadingNotifications(false);
      return;
    }

    let cancelled = false;
    let isRefreshing = false;

    const loadNotifications = async ({ showLoader }: { showLoader: boolean }) => {
      if (isRefreshing || pauseNotificationsRefreshRef.current) {
        return;
      }

      isRefreshing = true;

      if (showLoader) {
        setLoadingNotifications(true);
      }

      setNotificationsError(null);

      try {
        const { todayLocal, start, end } = getScheduleRange();
        const roomId = getRoomScheduleId(device.deviceClassroom || "");

        const response = await fetch(
          `/api/schedule?kind=room&id=${encodeURIComponent(roomId)}&start=${start}&end=${end}`,
          {
            cache: "no-store",
          },
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
          setLessons(nextLessons.filter((lesson) => lesson.messages.length > 0));
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
          if (showLoader) {
            setLoadingNotifications(false);
          }
        }

        isRefreshing = false;
      }
    };

    void loadNotifications({ showLoader: true });
    const intervalId = window.setInterval(() => {
      void loadNotifications({ showLoader: false });
    }, PREVIEW_NOTIFICATIONS_REFRESH_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [device?.deviceClassroom, device?.id]);

  useEffect(() => {
    setEditingMessageId(null);
    setEditingMessageBody("");
    setEditingMessageRoom("");
    setEditingRoomSuggestions([]);
    setShowEditingRoomSuggestions(false);
    setSearchingEditingRooms(false);
    setMessageMutationId(null);
  }, [device?.id]);

  const updateLessons = (
    updater: (currentLessons: PreviewLesson[]) => PreviewLesson[],
  ) => {
    setLessons((currentLessons) => updater(currentLessons));
  };

  const resetMessageEditing = () => {
    editingRoomSearchAbortRef.current?.abort();
    editingRoomSearchAbortRef.current = null;
    editingRoomSearchRequestIdRef.current += 1;
    setEditingMessageId(null);
    setEditingMessageBody("");
    setEditingMessageRoom("");
    setEditingRoomSuggestions([]);
    setShowEditingRoomSuggestions(false);
    setSearchingEditingRooms(false);
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

  const handleBlackScreenModeChange = async (nextBlackScreenMode: Device["blackScreenMode"]) => {
    if (!device || nextBlackScreenMode === device.blackScreenMode) {
      return;
    }

    try {
      setSettingsMutationKey("black-screen");
      await onUpdateDeviceDisplaySettings(device.id, {
        blackScreenMode: nextBlackScreenMode,
      });
      onToast(
        nextBlackScreenMode === "follow"
          ? `Tablet ${getDeviceDisplayName(device)} wrócił do harmonogramu czarnego ekranu.`
          : nextBlackScreenMode === "on"
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
        currentLessons
          .map((lesson) => ({
            ...lesson,
            messages: lesson.messages.filter((message) => message.id !== messageId),
          }))
          .filter((lesson) => lesson.messages.length > 0),
      );
      if (editingMessageId === messageId) {
        resetMessageEditing();
      }
      onToast("Usunięto powiadomienie.", "success");
    } catch (error) {
      onToast("Nie udało się usunąć powiadomienia.", "danger");
    } finally {
      setMessageMutationId(null);
    }
  };

  const handleSaveMessage = async (message: MessageRecord) => {
    const nextBody = editingMessageBody.trim();
    const nextRoom = sanitizeRoomValue(editingMessageRoom);
    const isRoomChange = Boolean(message.isRoomChange);

    if (!isRoomChange && !nextBody) {
      return;
    }

    if (isRoomChange && !nextRoom) {
      return;
    }

    setMessageMutationId(message.id);

    try {
      const updatedMessage = await updateMessage(
        message.id,
        isRoomChange ? { newRoom: nextRoom } : { body: nextBody },
      );
      updateLessons((currentLessons) =>
        currentLessons.map((lesson) => ({
          ...lesson,
          messages: lesson.messages.map((message) =>
            message.id === updatedMessage.id ? updatedMessage : message,
          ),
        })),
      );
      resetMessageEditing();
      onToast("Zapisano zmiany w powiadomieniu.", "success");
    } catch (error) {
      onToast("Nie udało się zapisać zmian w powiadomieniu.", "danger");
    } finally {
      setMessageMutationId(null);
    }
  };

  const handleDeviceSuggestionSelect = (nextDevice: Device) => {
    setDeviceQuery(getDevicePickerLabel(nextDevice));
    setShowDeviceSuggestions(false);
    onSelectDevice(nextDevice.id);
  };

  const handleEditingRoomSuggestionSelect = (room: string) => {
    setEditingMessageRoom(room);
    setShowEditingRoomSuggestions(false);
  };

  return (
    <div className="tablet-preview-view">
      <div className="tablet-preview-view__main">
        <AdminPanelSection
          title="Podgląd tabletu"
          actions={
            <label className="admin-form-field admin-form-field--compact tablet-preview-view__select">
              <span className="admin-form-field__label">Tablet</span>
              <div className="admin-autocomplete">
                <input
                  className="admin-form-field__input"
                  placeholder={
                    sortedDevices.length === 0
                      ? "Brak sparowanych tabletów"
                      : "Wpisz salę"
                  }
                  value={deviceQuery}
                  onChange={(event) => {
                    setDeviceQuery(event.target.value);
                    setShowDeviceSuggestions(true);
                  }}
                  onFocus={() => {
                    if (sortedDevices.length > 0) {
                      setShowDeviceSuggestions(true);
                    }
                  }}
                  onBlur={() => {
                    window.setTimeout(() => setShowDeviceSuggestions(false), 120);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      setShowDeviceSuggestions(false);
                    }

                    if (event.key === "Enter" && filteredDevices.length > 0) {
                      event.preventDefault();
                      handleDeviceSuggestionSelect(filteredDevices[0]);
                    }
                  }}
                  disabled={sortedDevices.length === 0}
                  aria-label="Wybierz tablet po sali"
                />
                {showDeviceSuggestions && filteredDevices.length > 0 ? (
                  <div className="admin-autocomplete__list">
                    {filteredDevices.map((activeDevice) => (
                      <button
                        key={activeDevice.id}
                        type="button"
                        className="admin-autocomplete__item"
                        onMouseDown={(event) => {
                          event.preventDefault();
                          handleDeviceSuggestionSelect(activeDevice);
                        }}
                      >
                        {getDevicePickerLabel(activeDevice)}
                        {` · ID ${formatPairingDeviceId(activeDevice.deviceId)}`}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
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
                <div className="tablet-preview-view__summary-primary">
                  <strong>{getDeviceDisplayName(device)}</strong>
                  <span className="admin-table__secondary">
                    ID: {formatPairingDeviceId(device.deviceId)}
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
                <div className="tablet-preview-view__actions">
                  <button
                    type="button"
                    className="admin-button admin-button--secondary admin-button--small"
                    onClick={() => onEditDevice(device)}
                  >
                    Zmień salę
                  </button>
                  <button
                    type="button"
                    className="admin-button admin-button--danger admin-button--small"
                    onClick={() => void onDeleteDevice(device)}
                  >
                    Usuń tablet
                  </button>
                </div>

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

                <label className="admin-form-field">
                  <span className="admin-form-field__label">Czarny ekran</span>
                  <select
                    className="admin-form-field__input admin-table__mode-select"
                    value={device.blackScreenMode}
                    onChange={(event) =>
                      void handleBlackScreenModeChange(
                        event.target.value as Device["blackScreenMode"],
                      )
                    }
                    disabled={settingsMutationKey !== null}
                  >
                    <option value="on">Włączony</option>
                    <option value="off">Wyłączony</option>
                    <option value="follow">Harmonogram</option>
                  </select>
                </label>
                <span className="admin-table__secondary">
                  {getBlackScreenStatusLabel(device)}
                </span>
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
              <h3>Brak powiadomień</h3>
              <p>Dla dzisiejszego planu sali nie znaleziono żadnych aktywnych powiadomień.</p>
            </div>
          ) : (
            <div className="tablet-preview-view__lessons">
              {lessons.map((lesson) => (
                <section key={lesson.id} className="tablet-preview-view__lesson">
                  <header className="tablet-preview-view__lesson-header">
                    <div className="tablet-preview-view__lesson-heading">
                      <h3>{lesson.title}</h3>
                      <p className="tablet-preview-view__lesson-meta">
                        {lesson.timeLabel}
                        {lesson.groupName ? ` · ${lesson.groupName}` : ""}
                      </p>
                      {lesson.lecturer ? (
                        <p className="tablet-preview-view__lesson-meta">{lesson.lecturer}</p>
                      ) : null}
                    </div>
                  </header>

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
                              isRoomChange ? (
                                <div className="admin-autocomplete">
                                  <input
                                    className="admin-form-field__input"
                                    value={editingMessageRoom}
                                    onChange={(event) => {
                                      setEditingMessageRoom(event.target.value);
                                      setShowEditingRoomSuggestions(true);
                                    }}
                                    onFocus={() => setShowEditingRoomSuggestions(true)}
                                    onBlur={() => {
                                      window.setTimeout(
                                        () => setShowEditingRoomSuggestions(false),
                                        120,
                                      );
                                    }}
                                    onKeyDown={(event) => {
                                      if (event.key === "Escape") {
                                        setShowEditingRoomSuggestions(false);
                                      }

                                      if (
                                        event.key === "Enter" &&
                                        editingRoomSuggestions.length > 0
                                      ) {
                                        event.preventDefault();
                                        handleEditingRoomSuggestionSelect(
                                          editingRoomSuggestions[0],
                                        );
                                      }
                                    }}
                                    placeholder="Wpisz nową salę"
                                  />
                                  {searchingEditingRooms ? (
                                    <span className="admin-autocomplete__loading">
                                      <i
                                        className="fas fa-spinner fa-spin"
                                        aria-hidden="true"
                                      />
                                    </span>
                                  ) : null}
                                  {showEditingRoomSuggestions &&
                                  editingRoomSuggestions.length > 0 ? (
                                    <div className="admin-autocomplete__list">
                                      {editingRoomSuggestions.map((room) => (
                                        <button
                                          key={room}
                                          type="button"
                                          className="admin-autocomplete__item"
                                          onMouseDown={(event) => {
                                            event.preventDefault();
                                            handleEditingRoomSuggestionSelect(room);
                                          }}
                                        >
                                          {room}
                                        </button>
                                      ))}
                                    </div>
                                  ) : null}
                                </div>
                              ) : (
                                <textarea
                                  className="lecturer-console__message-editor"
                                  rows={3}
                                  value={editingMessageBody}
                                  onChange={(event) =>
                                    setEditingMessageBody(event.target.value)
                                  }
                                />
                              )
                            ) : (
                              <p className="lecturer-console__message-text">
                                {isRoomChange
                                  ? `Zmiana sali: ${message.newRoom || "-"}`
                                  : message.body}
                              </p>
                            )}

                            <div className="lecturer-console__message-actions">
                              {isEditing ? (
                                <>
                                  <button
                                    type="button"
                                    className="admin-button admin-button--primary admin-button--small"
                                    disabled={
                                      isBusy ||
                                      (isRoomChange
                                        ? !sanitizeRoomValue(editingMessageRoom)
                                        : !editingMessageBody.trim())
                                    }
                                    onClick={() => void handleSaveMessage(message)}
                                  >
                                    Zapisz
                                  </button>
                                  <button
                                    type="button"
                                    className="admin-button admin-button--ghost admin-button--small"
                                    disabled={isBusy}
                                    onClick={resetMessageEditing}
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
                                      setEditingMessageRoom(message.newRoom || "");
                                      setShowEditingRoomSuggestions(false);
                                      setEditingRoomSuggestions([]);
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
