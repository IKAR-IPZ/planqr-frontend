import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import timeGridPlugin from "@fullcalendar/timegrid";
import plLocale from "@fullcalendar/core/locales/pl";
import type {
  EventApi,
  EventClickArg,
  EventContentArg,
} from "@fullcalendar/core";
import tippy from "tippy.js";
import "tippy.js/dist/tippy.css";
import {
  FaEdit,
  FaPaperPlane,
  FaSyncAlt,
  FaTimes,
  FaTrash,
  FaUserShield,
} from "react-icons/fa";
import * as leoProfanity from "leo-profanity";
import logo from "../../assets/ZUT_Logo.png";
import polishBadWords from "../../assets/badWords";
import { useTheme } from "../../context/ThemeContext";
import AdminPanelThemeToggle from "../features/Registry/adminPanel/AdminPanelThemeToggle";
import "../features/Registry/AdminRegistry.css";
import LessonAttendancePanel from "../features/attendance/LessonAttendancePanel";
import {
  createAttendanceDraft,
  createManualAttendanceRow,
  hasAttendanceScanner,
  type AttendanceDraft,
} from "../features/attendance/attendanceDrafts";
import {
  createMessage,
  deleteMessage,
  fetchMessages,
  updateMessage,
  type MessagePayload,
  type MessageRecord,
} from "../services/messageService";
import {
  fetchSession,
  logout,
  type SessionInfo,
} from "../services/authService";
import "./LecturerCalendar.css";

leoProfanity.loadDictionary("en");
leoProfanity.add(polishBadWords);

const LECTURER_SCROLL_ROOT_CLASS = "lecturer-console-scroll-root";
const AUTO_DAY_VIEW_MIN_WIDTH = 1100;
const TRIPLE_DOCKED_MIN_WIDTH = 1680;
const TRIPLE_DOCKED_MIN_HEIGHT = 860;
const DOUBLE_DOCKED_MIN_WIDTH = 1280;
const DOUBLE_DOCKED_MIN_HEIGHT = 760;
const FULLSCREEN_DRAWER_MAX_WIDTH = 720;
const TOAST_DURATION_MS = 4500;

type CalendarView = "timeGridDay" | "timeGridWeek" | "dayGridMonth";
type LecturerToastTone = "success" | "warning" | "danger" | "neutral";
type WorkspaceMode =
  | "triple-docked"
  | "double-docked"
  | "drawer"
  | "fullscreen-drawer";

interface LessonEvent {
  id: string;
  title: string;
  start?: string;
  end?: string;
  room?: string;
  login?: string;
  group_name?: string;
  worker_title?: string;
  lesson_form?: string;
  color?: string;
}

interface LecturerToast {
  id: number;
  message: string;
  tone: LecturerToastTone;
}

const detailDateFormatter = new Intl.DateTimeFormat("pl-PL", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

const timeFormatter = new Intl.DateTimeFormat("pl-PL", {
  hour: "2-digit",
  minute: "2-digit",
});

const messageTimeFormatter = new Intl.DateTimeFormat("pl-PL", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

const resolveWorkspaceMode = (
  width: number,
  height: number,
): WorkspaceMode => {
  if (width <= FULLSCREEN_DRAWER_MAX_WIDTH) {
    return "fullscreen-drawer";
  }

  if (width >= TRIPLE_DOCKED_MIN_WIDTH && height >= TRIPLE_DOCKED_MIN_HEIGHT) {
    return "triple-docked";
  }

  if (width >= DOUBLE_DOCKED_MIN_WIDTH && height >= DOUBLE_DOCKED_MIN_HEIGHT) {
    return "double-docked";
  }

  return "drawer";
};

const normalizeLessonEvent = (
  event: Record<string, unknown>,
  fallbackTeacher: string,
): LessonEvent => ({
  id: String(
    event.id ??
      event.lessonId ??
      `${String(event.title ?? "zajecia")}-${String(event.start ?? "")}`,
  ),
  title: String(event.title ?? "Zajęcia"),
  start: typeof event.start === "string" ? event.start : undefined,
  end: typeof event.end === "string" ? event.end : undefined,
  room: typeof event.room === "string" ? event.room : "",
  login: typeof event.login === "string" ? event.login : "",
  group_name: typeof event.group_name === "string" ? event.group_name : "",
  worker_title:
    typeof event.worker_title === "string"
      ? event.worker_title
      : fallbackTeacher,
  lesson_form:
    typeof event.lesson_form === "string"
      ? event.lesson_form
      : typeof event.lesson_form_short === "string"
        ? event.lesson_form_short
        : "",
  color: typeof event.color === "string" ? event.color : undefined,
});

const mapCalendarEvent = (event: EventApi): LessonEvent => ({
  id: event.id,
  title: event.title,
  start: event.start?.toISOString(),
  end: event.end?.toISOString(),
  room:
    typeof event.extendedProps.room === "string" ? event.extendedProps.room : "",
  login:
    typeof event.extendedProps.login === "string" ? event.extendedProps.login : "",
  group_name:
    typeof event.extendedProps.group_name === "string"
      ? event.extendedProps.group_name
      : "",
  worker_title:
    typeof event.extendedProps.worker_title === "string"
      ? event.extendedProps.worker_title
      : "",
  lesson_form:
    typeof event.extendedProps.lesson_form === "string"
      ? event.extendedProps.lesson_form
      : "",
  color:
    typeof event.backgroundColor === "string" ? event.backgroundColor : undefined,
});

const fetchLecturerEvents = async (
  startDate: string,
  endDate: string,
  targetTeacher: string,
) => {
  const response = await fetch(
    `/api/schedule?kind=worker&id=${encodeURIComponent(targetTeacher)}&start=${startDate}&end=${endDate}`,
    { credentials: "include" },
  );

  if (!response.ok) {
    throw new Error("Failed to fetch events");
  }

  const data = await response.json();

  if (!Array.isArray(data)) {
    return [];
  }

  return data
    .map((event) =>
      normalizeLessonEvent(event as Record<string, unknown>, targetTeacher),
    )
    .sort((first, second) => {
      const firstTime = first.start ? new Date(first.start).getTime() : 0;
      const secondTime = second.start ? new Date(second.start).getTime() : 0;
      return firstTime - secondTime;
    });
};

const formatLessonTiming = (lesson: LessonEvent | null) => {
  if (!lesson?.start) {
    return "Kliknij zajęcia w planie";
  }

  const start = new Date(lesson.start);
  const end = lesson.end ? new Date(lesson.end) : null;

  return `${detailDateFormatter.format(start)} · ${timeFormatter.format(start)}-${end ? timeFormatter.format(end) : "--:--"}`;
};

const getLessonState = (lesson: LessonEvent | null) => {
  if (!lesson?.start) {
    return "Brak wyboru";
  }

  const now = Date.now();
  const start = new Date(lesson.start).getTime();
  const end = lesson.end ? new Date(lesson.end).getTime() : start;

  if (start <= now && end >= now) {
    return "Trwają";
  }

  if (start > now) {
    return "Zaplanowane";
  }

  return "Zakończone";
};

const getLessonStateTone = (
  lesson: LessonEvent | null,
): "accent" | "warning" | "neutral" => {
  const state = getLessonState(lesson);

  if (state === "Trwają") {
    return "accent";
  }

  if (state === "Zaplanowane") {
    return "warning";
  }

  return "neutral";
};

const formatMessageTimestamp = (value?: string) => {
  if (!value) {
    return "";
  }

  return messageTimeFormatter.format(new Date(value));
};

const hasMessageBeenEdited = (message: MessageRecord) => {
  if (!message.updatedAt) {
    return false;
  }

  return (
    new Date(message.updatedAt).getTime() - new Date(message.createdAt).getTime() >
    1000
  );
};

const getEventTextColor = (color?: string) => {
  if (!color || !color.startsWith("#")) {
    return "#f8fafc";
  }

  const normalized =
    color.length === 4
      ? `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`
      : color;

  if (normalized.length !== 7) {
    return "#f8fafc";
  }

  const red = Number.parseInt(normalized.slice(1, 3), 16);
  const green = Number.parseInt(normalized.slice(3, 5), 16);
  const blue = Number.parseInt(normalized.slice(5, 7), 16);

  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;
  return luminance > 0.66 ? "#0f1722" : "#f8fafc";
};

export default function LecturerCalendar() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const calendarRef = useRef<FullCalendar | null>(null);
  const calendarShellRef = useRef<HTMLElement | null>(null);
  const messageRequestIdRef = useRef(0);
  const calendarResizeFrameRef = useRef<number | null>(null);
  const calendarResizeTimeoutRef = useRef<number | null>(null);
  const toastIdRef = useRef(0);
  const toastTimeoutRef = useRef(new Map<number, number>());

  const [session, setSession] = useState<SessionInfo | null>(null);
  const [actualLogin, setActualLogin] = useState<string | null>(null);
  const [activeTeacher, setActiveTeacher] = useState<string | null>(null);
  const [events, setEvents] = useState<LessonEvent[]>([]);
  const [selectedLesson, setSelectedLesson] = useState<LessonEvent | null>(null);
  const [messages, setMessages] = useState<MessageRecord[]>([]);
  const [currentDates, setCurrentDates] = useState({ start: "", end: "" });
  const [calendarTitle, setCalendarTitle] = useState("");
  const [calendarWidth, setCalendarWidth] = useState(window.innerWidth);
  const [newMessage, setNewMessage] = useState("");
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [editingMessageBody, setEditingMessageBody] = useState("");
  const [messageMutationId, setMessageMutationId] = useState<number | null>(null);
  const [editedRoom, setEditedRoom] = useState("");
  const [isEditingRoom, setIsEditingRoom] = useState(false);
  const [isMessagesLoading, setIsMessagesLoading] = useState(false);
  const [isSyncingPlan, setIsSyncingPlan] = useState(false);
  const [isAttendancePanelOpen, setIsAttendancePanelOpen] = useState(false);
  const [attendanceDrafts, setAttendanceDrafts] = useState<
    Record<string, AttendanceDraft>
  >({});
  const [toasts, setToasts] = useState<LecturerToast[]>([]);
  const [viewport, setViewport] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));
  const [preferredCalendarView, setPreferredCalendarView] =
    useState<CalendarView>("timeGridWeek");
  const [effectiveCalendarView, setEffectiveCalendarView] =
    useState<CalendarView>(
      window.innerWidth >= AUTO_DAY_VIEW_MIN_WIDTH
        ? "timeGridWeek"
        : "timeGridDay",
    );

  const workspaceMode = resolveWorkspaceMode(viewport.width, viewport.height);
  const isTripleDocked = workspaceMode === "triple-docked";
  const isDoubleDocked = workspaceMode === "double-docked";
  const isDockedLayout = isTripleDocked || isDoubleDocked;
  const isFullScreenDrawer = workspaceMode === "fullscreen-drawer";
  const canUseAttendance = Boolean(
    selectedLesson && hasAttendanceScanner(actualLogin),
  );
  const isAttendanceVisible = Boolean(
    selectedLesson && canUseAttendance && isAttendancePanelOpen,
  );

  const lessonMeta = selectedLesson
    ? [
        selectedLesson.group_name || "",
        selectedLesson.room ? `Sala ${selectedLesson.room}` : "",
        selectedLesson.lesson_form || "",
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  const currentAttendanceDraft = selectedLesson
    ? attendanceDrafts[selectedLesson.id] ?? null
    : null;

  const scheduleCalendarResize = () => {
    const calendarApi = calendarRef.current?.getApi();

    if (calendarResizeFrameRef.current !== null) {
      window.cancelAnimationFrame(calendarResizeFrameRef.current);
      calendarResizeFrameRef.current = null;
    }

    if (calendarResizeTimeoutRef.current !== null) {
      window.clearTimeout(calendarResizeTimeoutRef.current);
      calendarResizeTimeoutRef.current = null;
    }

    if (!calendarApi) {
      return;
    }

    calendarApi.updateSize();

    calendarResizeFrameRef.current = window.requestAnimationFrame(() => {
      calendarResizeFrameRef.current = window.requestAnimationFrame(() => {
        calendarApi.updateSize();
      });
    });

    calendarResizeTimeoutRef.current = window.setTimeout(() => {
      calendarApi.updateSize();
      calendarResizeTimeoutRef.current = null;
    }, 180);
  };

  const dismissToast = (toastId: number) => {
    const timeoutId = toastTimeoutRef.current.get(toastId);

    if (timeoutId) {
      window.clearTimeout(timeoutId);
      toastTimeoutRef.current.delete(toastId);
    }

    setToasts((current) => current.filter((toast) => toast.id !== toastId));
  };

  const pushToast = (message: string, tone: LecturerToastTone) => {
    const nextToastId = toastIdRef.current + 1;
    toastIdRef.current = nextToastId;

    setToasts((current) => [...current, { id: nextToastId, message, tone }]);

    const timeoutId = window.setTimeout(() => {
      dismissToast(nextToastId);
    }, TOAST_DURATION_MS);

    toastTimeoutRef.current.set(nextToastId, timeoutId);
  };

  const loadMessagesForLesson = async (lessonId: string) => {
    const requestId = messageRequestIdRef.current + 1;
    messageRequestIdRef.current = requestId;
    setIsMessagesLoading(true);

    try {
      const nextMessages = await fetchMessages(lessonId);
      if (requestId === messageRequestIdRef.current) {
        setMessages(nextMessages);
      }
    } catch (error) {
      console.error("Error fetching lesson messages:", error);
      if (requestId === messageRequestIdRef.current) {
        setMessages([]);
      }
    } finally {
      if (requestId === messageRequestIdRef.current) {
        setIsMessagesLoading(false);
      }
    }
  };

  useEffect(() => {
    const activeTimeouts = toastTimeoutRef.current;

    return () => {
      if (calendarResizeFrameRef.current !== null) {
        window.cancelAnimationFrame(calendarResizeFrameRef.current);
      }

      if (calendarResizeTimeoutRef.current !== null) {
        window.clearTimeout(calendarResizeTimeoutRef.current);
      }

      for (const timeoutId of activeTimeouts.values()) {
        window.clearTimeout(timeoutId);
      }

      activeTimeouts.clear();
    };
  }, []);

  useEffect(() => {
    const shouldLockScroll = isDockedLayout;

    if (shouldLockScroll) {
      document.documentElement.classList.add(LECTURER_SCROLL_ROOT_CLASS);
      document.body.classList.add(LECTURER_SCROLL_ROOT_CLASS);
    } else {
      document.documentElement.classList.remove(LECTURER_SCROLL_ROOT_CLASS);
      document.body.classList.remove(LECTURER_SCROLL_ROOT_CLASS);
    }

    return () => {
      document.documentElement.classList.remove(LECTURER_SCROLL_ROOT_CLASS);
      document.body.classList.remove(LECTURER_SCROLL_ROOT_CLASS);
    };
  }, [isDockedLayout]);

  useEffect(() => {
    const handleResize = () => {
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const target = calendarShellRef.current;

    if (!target || typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const nextWidth = entries[0]?.contentRect.width ?? target.clientWidth;
      setCalendarWidth(nextWidth);
      scheduleCalendarResize();
    });

    setCalendarWidth(target.getBoundingClientRect().width);
    observer.observe(target);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (
      preferredCalendarView === "timeGridWeek" &&
      calendarWidth < AUTO_DAY_VIEW_MIN_WIDTH
    ) {
      setEffectiveCalendarView("timeGridDay");
      return;
    }

    setEffectiveCalendarView(preferredCalendarView);
  }, [calendarWidth, preferredCalendarView]);

  useEffect(() => {
    const calendarApi = calendarRef.current?.getApi();

    if (!calendarApi) {
      return;
    }

    if (calendarApi.view.type !== effectiveCalendarView) {
      calendarApi.changeView(effectiveCalendarView);
    }

    scheduleCalendarResize();
  }, [effectiveCalendarView]);

  useEffect(() => {
    scheduleCalendarResize();
  }, [workspaceMode, selectedLesson?.id, isAttendanceVisible, calendarWidth]);

  useEffect(() => {
    let isMounted = true;

    const loadSession = async () => {
      const currentSession = await fetchSession();

      if (!isMounted) {
        return;
      }

      if (!currentSession || !currentSession.access.canAccessLecturerPlan) {
        navigate("/access-denied", {
          replace: true,
          state: { reason: "lecturer" },
        });
        return;
      }

      const fullName =
        currentSession.displayName ||
        `${currentSession.surname} ${currentSession.givenName}`.trim();

      if (!fullName) {
        navigate("/access-denied", {
          replace: true,
          state: { reason: "lecturer" },
        });
        return;
      }

      setSession(currentSession);
      setActualLogin(currentSession.login);
      setActiveTeacher(fullName);
    };

    void loadSession();

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  useEffect(() => {
    if (activeTeacher) {
      document.title = `Plan prowadzącego - ${activeTeacher}`;
    }
  }, [activeTeacher]);

  useEffect(() => {
    let isCancelled = false;

    const syncSchedule = async () => {
      if (!currentDates.start || !currentDates.end || !activeTeacher) {
        return;
      }

      setIsSyncingPlan(true);

      try {
        const fetchedEvents = await fetchLecturerEvents(
          currentDates.start,
          currentDates.end,
          activeTeacher,
        );

        if (!isCancelled) {
          setEvents(fetchedEvents);
        }
      } catch (error) {
        console.error("Error fetching lecturer plan:", error);

        if (!isCancelled) {
          setEvents([]);
        }
      } finally {
        if (!isCancelled) {
          setIsSyncingPlan(false);
        }
      }
    };

    void syncSchedule();
    const intervalId = window.setInterval(() => {
      void syncSchedule();
    }, 15 * 60 * 1000);

    return () => {
      isCancelled = true;
      window.clearInterval(intervalId);
    };
  }, [activeTeacher, currentDates.end, currentDates.start]);

  useEffect(() => {
    setSelectedLesson((current) => {
      if (!current) {
        return null;
      }

      return events.find((event) => event.id === current.id) ?? null;
    });
  }, [events]);

  useEffect(() => {
    if (!selectedLesson?.id) {
      messageRequestIdRef.current += 1;
      setMessages([]);
      setIsMessagesLoading(false);
      return;
    }

    void loadMessagesForLesson(selectedLesson.id);
  }, [selectedLesson?.id]);

  useEffect(() => {
    setIsEditingRoom(false);
    setEditedRoom(selectedLesson?.room || "");
    setIsAttendancePanelOpen(false);
    setNewMessage("");
    setEditingMessageId(null);
    setEditingMessageBody("");
    setMessageMutationId(null);
  }, [selectedLesson?.id, selectedLesson?.room]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/");
    } catch (error) {
      console.error("Error during logout:", error);
      window.alert("Nie udało się wylogować.");
    }
  };

  const applyTheme = (nextTheme: "light" | "dark") => {
    if (theme !== nextTheme) {
      toggleTheme();
    }
  };

  const handleRefreshPlan = async () => {
    if (!currentDates.start || !currentDates.end || !activeTeacher) {
      return;
    }

    setIsSyncingPlan(true);

    try {
      const fetchedEvents = await fetchLecturerEvents(
        currentDates.start,
        currentDates.end,
        activeTeacher,
      );
      setEvents(fetchedEvents);
    } catch (error) {
      console.error("Error refreshing lecturer plan:", error);
      pushToast("Nie udało się odświeżyć planu zajęć.", "danger");
    } finally {
      setIsSyncingPlan(false);
    }
  };

  const clearLessonSelection = () => {
    setSelectedLesson(null);
    setMessages([]);
    setNewMessage("");
    setEditingMessageId(null);
    setEditingMessageBody("");
    setIsEditingRoom(false);
    setIsAttendancePanelOpen(false);
  };

  const handleEventClick = (info: EventClickArg) => {
    setSelectedLesson(mapCalendarEvent(info.event));
  };

  const handleSendMessage = async () => {
    if (!selectedLesson?.id || !newMessage.trim()) {
      return;
    }

    const messagePayload: MessagePayload = {
      body: leoProfanity.clean(newMessage.trim()),
      lecturer: selectedLesson.worker_title || activeTeacher || "Prowadzący",
      login: actualLogin || "unknown",
      room: selectedLesson.room || "Nieznana sala",
      lessonId: selectedLesson.id,
      group: selectedLesson.group_name || "Nieznana grupa",
      createdAt: new Date(),
    };

    try {
      await createMessage(messagePayload);
      await loadMessagesForLesson(selectedLesson.id);
      setNewMessage("");
    } catch (error) {
      console.error("Error sending message:", error);
      pushToast("Nie udało się wysłać powiadomienia.", "danger");
    }
  };

  const handleDeleteMessage = async (messageId: number) => {
    setMessageMutationId(messageId);

    try {
      await deleteMessage(messageId);
      setMessages((current) =>
        current.filter((message) => message.id !== messageId),
      );
      if (editingMessageId === messageId) {
        setEditingMessageId(null);
        setEditingMessageBody("");
      }
    } catch (error) {
      console.error("Error deleting message:", error);
      pushToast("Nie udało się usunąć powiadomienia.", "danger");
    } finally {
      setMessageMutationId(null);
    }
  };

  const handleStartMessageEdit = (message: MessageRecord) => {
    setEditingMessageId(message.id);
    setEditingMessageBody(message.body);
  };

  const handleCancelMessageEdit = () => {
    setEditingMessageId(null);
    setEditingMessageBody("");
  };

  const handleSaveEditedMessage = async (messageId: number) => {
    const nextBody = leoProfanity.clean(editingMessageBody.trim());

    if (!nextBody) {
      return;
    }

    setMessageMutationId(messageId);

    try {
      const updated = await updateMessage(messageId, { body: nextBody });
      setMessages((current) =>
        current.map((message) => (message.id === messageId ? updated : message)),
      );
      setEditingMessageId(null);
      setEditingMessageBody("");
    } catch (error) {
      console.error("Error updating message:", error);
      pushToast("Nie udało się zapisać zmian w powiadomieniu.", "danger");
    } finally {
      setMessageMutationId(null);
    }
  };

  const handleSaveRoom = async () => {
    if (!selectedLesson) {
      return;
    }

    const previousRoom = selectedLesson.room || "";
    const nextRoom = editedRoom.trim();

    if (!nextRoom || nextRoom === previousRoom) {
      setIsEditingRoom(false);
      return;
    }

    const roomChangePayload: MessagePayload = {
      body: `Zajęcia przeniesione do sali: ${nextRoom}`,
      lecturer: selectedLesson.worker_title || activeTeacher || "Prowadzący",
      login: actualLogin || "unknown",
      room: previousRoom,
      lessonId: selectedLesson.id,
      group: selectedLesson.group_name || "Nieznana grupa",
      createdAt: new Date(),
      isRoomChange: true,
      newRoom: nextRoom,
    };

    try {
      await createMessage(roomChangePayload);
      await loadMessagesForLesson(selectedLesson.id);
      setEvents((current) =>
        current.map((event) =>
          event.id === selectedLesson.id ? { ...event, room: nextRoom } : event,
        ),
      );
      setSelectedLesson((current) =>
        current ? { ...current, room: nextRoom } : current,
      );
      setEditedRoom(nextRoom);
      setIsEditingRoom(false);
      pushToast(`Sala została zmieniona na ${nextRoom}.`, "success");
    } catch (error) {
      console.error("Error sending room change message:", error);
      pushToast("Nie udało się zapisać zmiany sali.", "danger");
    }
  };

  const ensureAttendanceDraft = () => {
    if (!selectedLesson) {
      return;
    }

    setAttendanceDrafts((current) => {
      if (current[selectedLesson.id]) {
        return current;
      }

      return {
        ...current,
        [selectedLesson.id]: createAttendanceDraft(
          selectedLesson.id,
          selectedLesson.room,
        ),
      };
    });
  };

  const updateAttendanceDraft = (
    updater: (currentDraft: AttendanceDraft) => AttendanceDraft,
  ) => {
    if (!selectedLesson) {
      return;
    }

    setAttendanceDrafts((current) => {
      const baseDraft =
        current[selectedLesson.id] ??
        createAttendanceDraft(selectedLesson.id, selectedLesson.room);

      return {
        ...current,
        [selectedLesson.id]: updater(baseDraft),
      };
    });
  };

  const handleOpenAttendancePanel = () => {
    if (!selectedLesson || !hasAttendanceScanner(actualLogin)) {
      return;
    }

    ensureAttendanceDraft();
    setIsAttendancePanelOpen(true);
  };

  const handleAttendanceSendList = () => {
    updateAttendanceDraft((current) => ({
      ...current,
      status: "sent",
      sentAt: new Date().toISOString(),
    }));
    pushToast("Lista obecności została wysłana w trybie demonstracyjnym.", "success");
  };

  const handleCalendarMove = (direction: "prev" | "next" | "today") => {
    const calendarApi = calendarRef.current?.getApi();

    if (!calendarApi) {
      return;
    }

    if (direction === "prev") {
      calendarApi.prev();
      return;
    }

    if (direction === "next") {
      calendarApi.next();
      return;
    }

    calendarApi.today();
  };

  const dayHeaderFormat =
    effectiveCalendarView === "timeGridDay"
      ? ({ weekday: "long", day: "numeric", month: "long" } as const)
      : effectiveCalendarView === "dayGridMonth"
        ? ({ weekday: "short" } as const)
        : ({ weekday: "short", day: "numeric" } as const);

  const calendarEvents = events.map((event) => ({
    ...event,
    color: event.color,
    backgroundColor: event.color,
    borderColor: event.color,
    textColor: getEventTextColor(event.color),
    classNames: [
      "lecturer-console__calendar-event",
      selectedLesson?.id === event.id
        ? "lecturer-console__calendar-event--selected"
        : "",
    ].filter(Boolean),
  }));

  const renderEventContent = (content: EventContentArg) => (
    <div className="lecturer-console__event">
      <span className="lecturer-console__event-time">{content.timeText}</span>
      <span className="lecturer-console__event-title">{content.event.title}</span>
      {content.event.extendedProps.room ? (
        <span className="lecturer-console__event-room">
          Sala {String(content.event.extendedProps.room)}
        </span>
      ) : null}
    </div>
  );

  const lessonInspector = selectedLesson ? (
    <section className="lecturer-console__panel lecturer-console__panel--details">
      <header className="lecturer-console__panel-header">
        <div className="lecturer-console__panel-header-copy">
          <h2>{selectedLesson.title}</h2>
          <p>{formatLessonTiming(selectedLesson)}</p>
          {lessonMeta ? (
            <div className="lecturer-console__panel-meta">{lessonMeta}</div>
          ) : null}
        </div>

        <div className="lecturer-console__panel-header-actions">
          <span
            className={`lecturer-console__panel-state lecturer-console__panel-state--${getLessonStateTone(
              selectedLesson,
            )}`}
          >
            {getLessonState(selectedLesson)}
          </span>
          <button
            type="button"
            className="admin-icon-button"
            onClick={clearLessonSelection}
            aria-label="Zamknij panel zajęć"
          >
            <FaTimes />
          </button>
        </div>
      </header>

      <div className="lecturer-console__panel-strip">
        {!isEditingRoom ? (
          <>
            <div className="lecturer-console__room-inline">
              {selectedLesson.room ? `Sala ${selectedLesson.room}` : "Sala nieustawiona"}
            </div>

            <button
              type="button"
              className="admin-button admin-button--ghost admin-button--small"
              onClick={() => setIsEditingRoom(true)}
            >
              <FaEdit />
              Zmień salę
            </button>
          </>
        ) : (
          <div className="lecturer-console__room-editor">
            <input
              className="lecturer-console__inline-input"
              type="text"
              value={editedRoom}
              onChange={(event) => setEditedRoom(event.target.value)}
              autoFocus
            />

            <div className="lecturer-console__row-actions">
              <button
                type="button"
                className="admin-button admin-button--primary admin-button--small"
                onClick={() => void handleSaveRoom()}
              >
                Zapisz
              </button>
              <button
                type="button"
                className="admin-button admin-button--ghost admin-button--small"
                onClick={() => {
                  setEditedRoom(selectedLesson.room || "");
                  setIsEditingRoom(false);
                }}
              >
                Anuluj
              </button>
            </div>
          </div>
        )}
      </div>

      <section className="lecturer-console__panel-section lecturer-console__panel-section--notifications">
        <div className="lecturer-console__messages">
          {isMessagesLoading && messages.length === 0 ? (
            <div className="lecturer-console__messages-empty">Ładowanie...</div>
          ) : messages.length === 0 ? (
            <div className="lecturer-console__messages-empty">Brak powiadomień.</div>
          ) : (
            messages.map((message) => {
              const canManageMessage = Boolean(
                session?.access.isAdmin || message.login === actualLogin,
              );
              const isEditing = editingMessageId === message.id;
              const isBusy = messageMutationId === message.id;
              const isRoomChange = Boolean(message.isRoomChange);

              return (
                <article
                  key={message.id}
                  className={`lecturer-console__message${
                    isRoomChange ? " lecturer-console__message--room-change" : ""
                  }`}
                >
                  <div className="lecturer-console__message-head">
                    <div className="lecturer-console__message-flags">
                      {isRoomChange ? (
                        <span className="lecturer-console__message-chip">Zmiana sali</span>
                      ) : null}
                      {hasMessageBeenEdited(message) ? (
                        <span className="lecturer-console__message-chip">Edytowano</span>
                      ) : null}
                    </div>
                    <span>{formatMessageTimestamp(message.createdAt)}</span>
                  </div>

                  {isEditing ? (
                    <textarea
                      className="lecturer-console__message-editor"
                      rows={3}
                      value={editingMessageBody}
                      onChange={(event) => setEditingMessageBody(event.target.value)}
                    />
                  ) : (
                    <p className="lecturer-console__message-text">
                      {isRoomChange
                        ? `Zmiana sali: ${message.newRoom || "-"}`
                        : message.body}
                    </p>
                  )}

                  {!isRoomChange && canManageMessage ? (
                    <div className="lecturer-console__message-actions">
                      {isEditing ? (
                        <>
                          <button
                            type="button"
                            className="admin-button admin-button--primary admin-button--small"
                            disabled={isBusy || !editingMessageBody.trim()}
                            onClick={() => void handleSaveEditedMessage(message.id)}
                          >
                            Zapisz
                          </button>
                          <button
                            type="button"
                            className="admin-button admin-button--ghost admin-button--small"
                            disabled={isBusy}
                            onClick={handleCancelMessageEdit}
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
                            onClick={() => handleStartMessageEdit(message)}
                          >
                            <FaEdit />
                            Edytuj
                          </button>
                          <button
                            type="button"
                            className="admin-button admin-button--ghost admin-button--small"
                            disabled={isBusy}
                            onClick={() => void handleDeleteMessage(message.id)}
                          >
                            <FaTrash />
                            Usuń
                          </button>
                        </>
                      )}
                    </div>
                  ) : null}
                </article>
              );
            })
          )}
        </div>

        <div className="lecturer-console__composer">
          <textarea
            className="lecturer-console__composer-input"
            rows={3}
            value={newMessage}
            placeholder="Nowe powiadomienie"
            onChange={(event) => setNewMessage(event.target.value)}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                event.preventDefault();
                void handleSendMessage();
              }
            }}
          />

          <button
            type="button"
            className="admin-button admin-button--primary admin-button--small"
            disabled={!newMessage.trim()}
            onClick={() => void handleSendMessage()}
          >
            <FaPaperPlane />
            Wyślij
          </button>
        </div>
      </section>

      <footer className="lecturer-console__panel-footer">
        {!canUseAttendance ? (
          <span className="lecturer-console__muted-copy">
            Brak powiązanego skanera.
          </span>
        ) : (
          <span className="lecturer-console__muted-copy" />
        )}

        <button
          type="button"
          className="admin-button admin-button--primary admin-button--small"
          onClick={handleOpenAttendancePanel}
          disabled={!canUseAttendance}
        >
          Panel obecności
        </button>
      </footer>
    </section>
  ) : null;

  const attendancePanel = selectedLesson ? (
    <LessonAttendancePanel
      layout="panel"
      lessonId={selectedLesson.id}
      draft={
        currentAttendanceDraft ??
        createAttendanceDraft(selectedLesson.id, selectedLesson.room)
      }
      onOpenList={() =>
        updateAttendanceDraft((current) => ({
          ...current,
          status: "open",
          sentAt: null,
        }))
      }
      onCloseList={() =>
        updateAttendanceDraft((current) => ({
          ...current,
          status: "closed",
        }))
      }
      onSendList={handleAttendanceSendList}
      onAddRow={(albumNumber, enteredAt) =>
        updateAttendanceDraft((current) => ({
          ...current,
          rows: [
            ...current.rows,
            createManualAttendanceRow(albumNumber, enteredAt),
          ],
        }))
      }
      onRemoveRow={(rowId) =>
        updateAttendanceDraft((current) => ({
          ...current,
          rows: current.rows.filter((row) => row.id !== rowId),
        }))
      }
      onClosePanel={() => setIsAttendancePanelOpen(false)}
    />
  ) : null;

  if (!activeTeacher) {
    return (
      <div className="admin-console lecturer-console" data-admin-theme={theme}>
        <div className="lecturer-console__loading">Ładowanie...</div>
      </div>
    );
  }

  return (
    <div
      className="admin-console lecturer-console"
      data-admin-theme={theme}
      data-workspace-mode={workspaceMode}
    >
      <header className="admin-console__appbar lecturer-console__appbar">
        <div className="admin-console__brand">
          <img className="admin-console__brand-logo" src={logo} alt="ZUT" />
          <div className="admin-console__brand-copy">
            <strong>Plan prowadzącego</strong>
            <span className="admin-console__brand-user">
              {activeTeacher}
              {session?.login ? ` · ${session.login}` : ""}
            </span>
          </div>
        </div>

        <div className="admin-console__appbar-actions lecturer-console__appbar-actions">
          <AdminPanelThemeToggle
            theme={theme}
            onChange={(nextTheme) => applyTheme(nextTheme)}
          />

          {session?.access.isAdmin ? (
            <button
              type="button"
              className="admin-button admin-button--ghost admin-button--small"
              onClick={() => navigate("/adminpanel")}
            >
              <FaUserShield />
              Admin panel
            </button>
          ) : null}

          <button
            type="button"
            className="admin-button admin-button--ghost admin-button--small"
            onClick={handleLogout}
          >
            Wyloguj
          </button>
        </div>
      </header>

      <div className="lecturer-console__shell">
        <main className="lecturer-console__workspace">
          <div
            className={[
              "lecturer-console__dock",
              `lecturer-console__dock--${workspaceMode}`,
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <section
              className="lecturer-console__calendar-shell"
              ref={calendarShellRef}
            >
              <header className="lecturer-console__surface-header">
                <div className="lecturer-console__surface-title">
                  <h1>Plan zajęć</h1>
                  <span>{calendarTitle}</span>
                </div>

                <div className="lecturer-console__surface-actions">
                  <div className="lecturer-console__calendar-nav">
                    <button
                      type="button"
                      className="admin-button admin-button--ghost admin-button--small"
                      onClick={() => handleCalendarMove("prev")}
                    >
                      Wstecz
                    </button>
                    <button
                      type="button"
                      className="admin-button admin-button--ghost admin-button--small"
                      onClick={() => handleCalendarMove("today")}
                    >
                      Dzisiaj
                    </button>
                    <button
                      type="button"
                      className="admin-button admin-button--ghost admin-button--small"
                      onClick={() => handleCalendarMove("next")}
                    >
                      Dalej
                    </button>
                  </div>

                  <div className="lecturer-console__view-toggle">
                    {[
                      ["timeGridDay", "Dzień"],
                      ["timeGridWeek", "Tydzień"],
                      ["dayGridMonth", "Miesiąc"],
                    ].map(([view, label]) => (
                      <button
                        key={view}
                        type="button"
                        className={`lecturer-console__view-button${
                          effectiveCalendarView === view
                            ? " lecturer-console__view-button--active"
                            : ""
                        }`}
                        onClick={() => setPreferredCalendarView(view as CalendarView)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    className="admin-button admin-button--secondary admin-button--small"
                    onClick={() => void handleRefreshPlan()}
                  >
                    <FaSyncAlt />
                    {isSyncingPlan ? "Ładowanie..." : "Odśwież"}
                  </button>
                </div>
              </header>

              <div className="lecturer-console__calendar-frame">
                <FullCalendar
                  ref={calendarRef}
                  plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                  initialView={effectiveCalendarView}
                  headerToolbar={false}
                  events={calendarEvents}
                  locale={plLocale}
                  firstDay={1}
                  height="100%"
                  allDaySlot={false}
                  nowIndicator
                  dayMaxEvents
                  slotMinTime="07:00:00"
                  slotMaxTime="21:00:00"
                  eventTimeFormat={{
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  }}
                  slotLabelFormat={{
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  }}
                  dayHeaderFormat={dayHeaderFormat}
                  eventClick={handleEventClick}
                  eventContent={renderEventContent}
                  datesSet={(info) => {
                    setCalendarTitle(info.view.title);
                    setCurrentDates((current) => {
                      if (
                        current.start === info.startStr &&
                        current.end === info.endStr
                      ) {
                        return current;
                      }

                      return { start: info.startStr, end: info.endStr };
                    });
                  }}
                  eventDidMount={(info) => {
                    const isTouch = "ontouchstart" in window;

                    if (!isTouch) {
                      tippy(info.el, {
                        content: `${info.event.title} • Sala ${String(info.event.extendedProps.room || "-")}`,
                        placement: "top",
                        theme: "light-border",
                      });
                    }
                  }}
                />
              </div>
            </section>

            {isDockedLayout ? (
              <>
                <aside
                  className={`lecturer-console__panel-shell lecturer-console__panel-shell--details${
                    selectedLesson ? " lecturer-console__panel-shell--open" : ""
                  }`}
                >
                  {lessonInspector}
                </aside>

                {isTripleDocked ? (
                  <aside
                    className={`lecturer-console__panel-shell lecturer-console__panel-shell--attendance${
                      isAttendanceVisible
                        ? " lecturer-console__panel-shell--open"
                        : ""
                    }`}
                  >
                    {isAttendanceVisible ? attendancePanel : null}
                  </aside>
                ) : null}
              </>
            ) : null}
          </div>
        </main>

        {isDoubleDocked && isAttendanceVisible ? (
          <>
            <button
              type="button"
              className="lecturer-console__backdrop"
              aria-label="Zamknij panel obecności"
              onClick={() => setIsAttendancePanelOpen(false)}
            />

            <aside className="lecturer-console__floating-panel">
              {attendancePanel}
            </aside>
          </>
        ) : null}

        {!isDockedLayout && selectedLesson ? (
          <>
            <button
              type="button"
              className="lecturer-console__backdrop"
              aria-label="Zamknij panele"
              onClick={() => {
                if (isAttendanceVisible) {
                  setIsAttendancePanelOpen(false);
                  return;
                }

                clearLessonSelection();
              }}
            />

            {!isFullScreenDrawer ? (
              <aside
                className={`lecturer-console__drawer lecturer-console__drawer--details${
                  isAttendanceVisible
                    ? " lecturer-console__drawer--details-stacked"
                    : ""
                }`}
              >
                {lessonInspector}
              </aside>
            ) : !isAttendanceVisible ? (
              <aside className="lecturer-console__drawer lecturer-console__drawer--fullscreen">
                {lessonInspector}
              </aside>
            ) : null}

            {isAttendanceVisible ? (
              <aside
                className={`lecturer-console__drawer lecturer-console__drawer--attendance${
                  isFullScreenDrawer
                    ? " lecturer-console__drawer--fullscreen"
                    : ""
                }`}
              >
                {attendancePanel}
              </aside>
            ) : null}
          </>
        ) : null}
      </div>

      {toasts.length > 0 ? (
        <div className="admin-toast-stack lecturer-console__toast-stack" aria-live="polite">
          {toasts.map((toast) => (
            <div key={toast.id} className={`admin-toast admin-toast--${toast.tone}`}>
              <p className="admin-toast__message">{toast.message}</p>
              <button
                type="button"
                className="admin-toast__close"
                onClick={() => dismissToast(toast.id)}
                aria-label="Zamknij komunikat"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
