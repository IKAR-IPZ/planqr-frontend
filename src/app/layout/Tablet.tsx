import { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import './Tablet.css';
import { fetchMessages } from '../services/messageService';
import { reportTabletDisplayProfile } from '../services/displayProfileService';
import { QRCodeCanvas } from 'qrcode.react';

import logo from '../../assets/ZUT_Logo.png';

interface ScheduleEvent {
  id: string;
  startTime: string;
  endTime: string;
  description: string;
  instructor: string;
  room: string;
  form: string;
  group_name: string;
  login: string;
  notifications: TabletMessageNotification[];
  color: string;
}

interface TabletMessageNotification {
  body: string;
  lecturer?: string;
  createdAt?: string;
  isRoomChange?: boolean;
  newRoom?: string;
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
  login?: string;
  color?: string;
  lesson_form_short?: string;
}


interface TabletNightModeConfig {
  enabled: boolean;
  startTime: string;
  endTime: string;
  blackScreenAfterScheduleEnd: boolean;
}

type TabletDisplayTheme = 'light' | 'dark';

interface DisplaySettingsResponse {
  nightMode?: TabletNightModeConfig | null;
}

interface PreviewDeviceResponse {
  displayTheme?: TabletDisplayTheme | null;
  forceBlackScreen?: boolean | null;
}

interface DeviceStatusResponse {
  status: string;
  config?: {
    room?: string | null;
    secretUrl?: string | null;
    nightMode?: TabletNightModeConfig | null;
    displayTheme?: TabletDisplayTheme | null;
    forceBlackScreen?: boolean | null;
  } | null;
}

interface TabletCommandPayload {
  type: 'connected' | 'config-updated' | 'reload' | 'registry-reset' | 'report-display-profile';
  hardReload?: boolean;
  path?: string;
  config?: DeviceStatusResponse['config'];
}

const TABLET_RELOAD_PARAM = '_tabletReload';
const TABLET_NIGHT_MODE_STORAGE_KEY = 'tablet_night_mode_config';
const TABLET_THEME_STORAGE_KEY = 'tablet_display_theme';
const TABLET_FORCE_BLACK_SCREEN_STORAGE_KEY = 'tablet_force_black_screen';
const TABLET_PREVIEW_PARAM = 'preview';
const DEFAULT_TABLET_DISPLAY_THEME: TabletDisplayTheme = 'dark';
const DEFAULT_TABLET_NIGHT_MODE_CONFIG: TabletNightModeConfig = {
  enabled: false,
  startTime: '22:00',
  endTime: '06:00',
  blackScreenAfterScheduleEnd: false,
};

const buildTabletPath = (room: string, secretUrl: string) =>
  `/tablet/${encodeURIComponent(room)}/${encodeURIComponent(secretUrl)}`;

const normalizeDisplayTheme = (theme?: string | null): TabletDisplayTheme =>
  theme === 'light' ? 'light' : DEFAULT_TABLET_DISPLAY_THEME;

const normalizeNightModeConfig = (
  nightMode?: TabletNightModeConfig | null
): TabletNightModeConfig => ({
  enabled:
    typeof nightMode?.enabled === 'boolean'
      ? nightMode.enabled
      : DEFAULT_TABLET_NIGHT_MODE_CONFIG.enabled,
  startTime:
    typeof nightMode?.startTime === 'string' && nightMode.startTime
      ? nightMode.startTime
      : DEFAULT_TABLET_NIGHT_MODE_CONFIG.startTime,
  endTime:
    typeof nightMode?.endTime === 'string' && nightMode.endTime
      ? nightMode.endTime
      : DEFAULT_TABLET_NIGHT_MODE_CONFIG.endTime,
  blackScreenAfterScheduleEnd:
    typeof nightMode?.blackScreenAfterScheduleEnd === 'boolean'
      ? nightMode.blackScreenAfterScheduleEnd
      : DEFAULT_TABLET_NIGHT_MODE_CONFIG.blackScreenAfterScheduleEnd,
});

const persistNightModeConfig = (nightMode: TabletNightModeConfig) => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(TABLET_NIGHT_MODE_STORAGE_KEY, JSON.stringify(nightMode));
};

const readStoredNightModeConfig = (): TabletNightModeConfig => {
  if (typeof window === 'undefined') {
    return DEFAULT_TABLET_NIGHT_MODE_CONFIG;
  }

  const rawValue = window.localStorage.getItem(TABLET_NIGHT_MODE_STORAGE_KEY);
  if (!rawValue) {
    return DEFAULT_TABLET_NIGHT_MODE_CONFIG;
  }

  try {
    return normalizeNightModeConfig(JSON.parse(rawValue) as TabletNightModeConfig);
  } catch {
    return DEFAULT_TABLET_NIGHT_MODE_CONFIG;
  }
};

const clearNightModeConfig = () => {
  persistNightModeConfig(DEFAULT_TABLET_NIGHT_MODE_CONFIG);
};

const persistDisplayTheme = (theme: TabletDisplayTheme) => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(TABLET_THEME_STORAGE_KEY, theme);
};

const readStoredDisplayTheme = (): TabletDisplayTheme => {
  if (typeof window === 'undefined') {
    return DEFAULT_TABLET_DISPLAY_THEME;
  }

  return normalizeDisplayTheme(window.localStorage.getItem(TABLET_THEME_STORAGE_KEY));
};

const persistForceBlackScreen = (forceBlackScreen: boolean) => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(
    TABLET_FORCE_BLACK_SCREEN_STORAGE_KEY,
    JSON.stringify(forceBlackScreen),
  );
};

const readStoredForceBlackScreen = () => {
  if (typeof window === 'undefined') {
    return false;
  }

  const rawValue = window.localStorage.getItem(TABLET_FORCE_BLACK_SCREEN_STORAGE_KEY);
  return rawValue === 'true';
};

const clearDeviceDisplaySettings = () => {
  persistDisplayTheme(DEFAULT_TABLET_DISPLAY_THEME);
  persistForceBlackScreen(false);
};

const parseNightModeTimeToMinutes = (time: string) => {
  const match = time.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!match) {
    return null;
  }

  return Number(match[1]) * 60 + Number(match[2]);
};

const isNightModeEnabledAt = (nightMode: TabletNightModeConfig, currentDate: Date) => {
  if (!nightMode.enabled) {
    return false;
  }

  const startMinutes = parseNightModeTimeToMinutes(nightMode.startTime);
  const endMinutes = parseNightModeTimeToMinutes(nightMode.endTime);

  if (startMinutes === null || endMinutes === null || startMinutes === endMinutes) {
    return false;
  }

  const currentMinutes = currentDate.getHours() * 60 + currentDate.getMinutes();

  if (startMinutes < endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }

  return currentMinutes >= startMinutes || currentMinutes < endMinutes;
};

const parseClockTimeToMinutes = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return null;
  }

  return hours * 60 + minutes;
};

const forceHardReload = (path?: string) => {
  const target = path ?? `${window.location.pathname}${window.location.search}`;
  const url = new URL(target, window.location.origin);
  url.searchParams.set(TABLET_RELOAD_PARAM, Date.now().toString());
  window.location.replace(url.toString());
};

const syncTabletRouteFromConfig = (
  currentRouteRoom: string,
  currentRouteSecret: string,
  config?: DeviceStatusResponse['config'],
  options?: { forceReload?: boolean; fallbackPath?: string }
) => {
  if (!config?.room || !config?.secretUrl) {
    forceHardReload(options?.fallbackPath ?? '/registry');
    return;
  }

  if (config.room !== currentRouteRoom || config.secretUrl !== currentRouteSecret) {
    forceHardReload(buildTabletPath(config.room, config.secretUrl));
    return;
  }

  if (options?.forceReload) {
    forceHardReload();
  }
};

export default function Tablet() {
  const params = useParams<{ room?: string; secretUrl?: string }>();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const isPreviewMode = searchParams.get(TABLET_PREVIEW_PARAM) === '1';
  const previewDeviceId = Number(searchParams.get('deviceId') || '');

  const currentRouteRoom = params.room ? decodeURIComponent(params.room) : '';
  const currentRouteSecret = params.secretUrl ? decodeURIComponent(params.secretUrl) : '';

  const [roomInfo, setRoomInfo] = useState({ building: "", room: "" });
  const [deviceId, setDeviceId] = useState('');
  const [displayTheme, setDisplayTheme] = useState<TabletDisplayTheme>(() =>
    isPreviewMode ? DEFAULT_TABLET_DISPLAY_THEME : readStoredDisplayTheme()
  );
  const [forceBlackScreen, setForceBlackScreen] = useState(() =>
    isPreviewMode ? false : readStoredForceBlackScreen()
  );
  const [nightModeConfig, setNightModeConfig] = useState<TabletNightModeConfig>(() =>
    isPreviewMode ? DEFAULT_TABLET_NIGHT_MODE_CONFIG : readStoredNightModeConfig()
  );

  // States
  const [currentDateTime, setCurrentDateTime] = useState({
    date: '', time: '', dayName: '', dayNumber: 0
  });
  const [scheduleItems, setScheduleItems] = useState<ScheduleEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Time metrics for calendar view
  const calendarStartHour = 7; // Fixed start hour
  const timeSlotsCount = 13; // 7:00 to 19:00

  useEffect(() => {
    if (isPreviewMode) {
      return;
    }

    const storedDeviceId = window.localStorage.getItem('tablet_uuid') || '';
    if (!storedDeviceId) {
      forceHardReload('/registry');
      return;
    }

    setDeviceId(storedDeviceId);
  }, [isPreviewMode]);

  useEffect(() => {
    document.documentElement.setAttribute('data-tablet-theme', displayTheme);
    document.body.setAttribute('data-tablet-theme', displayTheme);

    return () => {
      document.documentElement.removeAttribute('data-tablet-theme');
      document.body.removeAttribute('data-tablet-theme');
    };
  }, [displayTheme]);

  const applyNightModeConfig = useCallback((config?: DeviceStatusResponse['config']) => {
    const nextNightModeConfig = normalizeNightModeConfig(config?.nightMode);
    setNightModeConfig(nextNightModeConfig);
    if (!isPreviewMode) {
      persistNightModeConfig(nextNightModeConfig);
    }
  }, [isPreviewMode]);

  const applyDeviceDisplayConfig = useCallback((config?: DeviceStatusResponse['config']) => {
    const nextDisplayTheme = normalizeDisplayTheme(config?.displayTheme);
    const nextForceBlackScreen = typeof config?.forceBlackScreen === 'boolean'
      ? config.forceBlackScreen
      : false;

    setDisplayTheme(nextDisplayTheme);
    setForceBlackScreen(nextForceBlackScreen);

    if (!isPreviewMode) {
      persistDisplayTheme(nextDisplayTheme);
      persistForceBlackScreen(nextForceBlackScreen);
    }
  }, [isPreviewMode]);

  useEffect(() => {
    if (!isPreviewMode) {
      return;
    }

    let cancelled = false;

    const loadPreviewDisplayConfig = async () => {
      try {
        const nightModeResponse = await fetch('/api/devices/display-settings');
        if (!nightModeResponse.ok) {
          return;
        }

        const nightModeData = (await nightModeResponse.json()) as DisplaySettingsResponse;
        if (cancelled) {
          return;
        }

        const nextNightModeConfig = normalizeNightModeConfig(nightModeData.nightMode);
        setNightModeConfig(nextNightModeConfig);

        if (Number.isInteger(previewDeviceId) && previewDeviceId > 0) {
          const deviceResponse = await fetch(`/api/devices/${previewDeviceId}`);
          if (!deviceResponse.ok || cancelled) {
            return;
          }

          const deviceData = (await deviceResponse.json()) as PreviewDeviceResponse;
          setDisplayTheme(normalizeDisplayTheme(deviceData.displayTheme));
          setForceBlackScreen(Boolean(deviceData.forceBlackScreen));
        }
      } catch (error) {
        console.error('[Tablet] Failed to load preview display settings:', error);
      }
    };

    void loadPreviewDisplayConfig();

    return () => {
      cancelled = true;
    };
  }, [isPreviewMode, previewDeviceId]);

  // 1. Parse Room Info
  useEffect(() => {
    let roomPart = params.room ? decodeURIComponent(params.room) : '';
    if (!roomPart) {
      const pathParts = location.pathname.split('/');
      if (pathParts.length >= 3) roomPart = decodeURIComponent(pathParts[2]);
    }

    if (roomPart) {
      const buildingMatch = roomPart.match(/^([A-Z]+)/);
      const building = buildingMatch ? buildingMatch[1] : "WI";
      setRoomInfo({ building, room: roomPart });
    }
  }, [location.pathname, params]);

  useEffect(() => {
    if (isPreviewMode || !deviceId) return;

    let resizeTimeoutId: number | null = null;

    const sendDisplayProfile = async () => {
      try {
        await reportTabletDisplayProfile(deviceId);
      } catch (error) {
        console.error('[Tablet] Failed to report display profile:', error);
      }
    };

    const handleViewportChange = () => {
      if (resizeTimeoutId !== null) {
        window.clearTimeout(resizeTimeoutId);
      }

      resizeTimeoutId = window.setTimeout(() => {
        void sendDisplayProfile();
      }, 300);
    };

    void sendDisplayProfile();
    window.addEventListener('resize', handleViewportChange);
    window.screen.orientation?.addEventListener?.('change', handleViewportChange);

    return () => {
      if (resizeTimeoutId !== null) {
        window.clearTimeout(resizeTimeoutId);
      }

      window.removeEventListener('resize', handleViewportChange);
      window.screen.orientation?.removeEventListener?.('change', handleViewportChange);
    };
  }, [deviceId, isPreviewMode]);

  useEffect(() => {
    if (!deviceId) return;
    if (isPreviewMode) return;

    const eventSource = new EventSource(`/api/registry/stream/${encodeURIComponent(deviceId)}`);
    const handleTabletCommand = (event: MessageEvent<string>) => {
      try {
        const payload = JSON.parse(event.data) as TabletCommandPayload;

        if (payload.type === 'connected') {
          return;
        }

        if (payload.type === 'registry-reset') {
          clearNightModeConfig();
          clearDeviceDisplaySettings();
          setNightModeConfig(DEFAULT_TABLET_NIGHT_MODE_CONFIG);
          setDisplayTheme(DEFAULT_TABLET_DISPLAY_THEME);
          setForceBlackScreen(false);
          forceHardReload(payload.path || '/registry');
          return;
        }

        if (payload.type === 'config-updated') {
          applyNightModeConfig(payload.config);
          applyDeviceDisplayConfig(payload.config);
          syncTabletRouteFromConfig(currentRouteRoom, currentRouteSecret, payload.config, { forceReload: payload.hardReload });
          return;
        }

        if (payload.type === 'reload') {
          if (payload.config) {
            applyNightModeConfig(payload.config);
            applyDeviceDisplayConfig(payload.config);
            syncTabletRouteFromConfig(currentRouteRoom, currentRouteSecret, payload.config, { forceReload: true });
            return;
          }

          forceHardReload(payload.path);
          return;
        }

        if (payload.type === 'report-display-profile') {
          void reportTabletDisplayProfile(deviceId).catch((error) => {
            console.error('[Tablet] Failed to report display profile on demand:', error);
          });
        }
      } catch (error) {
        console.error('[Tablet] Failed to handle stream payload:', error);
      }
    };

    eventSource.addEventListener('tablet-command', handleTabletCommand as EventListener);
    eventSource.onerror = (error) => {
      console.error('[Tablet] Device stream error:', error);
    };

    return () => {
      eventSource.removeEventListener('tablet-command', handleTabletCommand as EventListener);
      eventSource.close();
    };
  }, [applyDeviceDisplayConfig, applyNightModeConfig, currentRouteRoom, currentRouteSecret, deviceId, isPreviewMode]);

  useEffect(() => {
    if (!deviceId) return;
    if (isPreviewMode) return;

    let cancelled = false;

    const syncDeviceStatus = async () => {
      try {
        const response = await fetch(`/api/registry/status/${encodeURIComponent(deviceId)}`);
        if (!response.ok) {
          if (response.status === 404 && !cancelled) {
            forceHardReload('/registry');
          }
          return;
        }

        const data: DeviceStatusResponse = await response.json();
        if (cancelled) {
          return;
        }

        if (data.status !== 'ACTIVE') {
          clearNightModeConfig();
          clearDeviceDisplaySettings();
          setNightModeConfig(DEFAULT_TABLET_NIGHT_MODE_CONFIG);
          setDisplayTheme(DEFAULT_TABLET_DISPLAY_THEME);
          setForceBlackScreen(false);
          forceHardReload('/registry');
          return;
        }

        applyNightModeConfig(data.config);
        applyDeviceDisplayConfig(data.config);
        syncTabletRouteFromConfig(currentRouteRoom, currentRouteSecret, data.config);
      } catch (error) {
        console.error('[Tablet] Device status sync error:', error);
      }
    };

    syncDeviceStatus();
    const intervalId = window.setInterval(syncDeviceStatus, 30000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [applyDeviceDisplayConfig, applyNightModeConfig, currentRouteRoom, currentRouteSecret, deviceId, isPreviewMode]);

  // 2. Clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentDateTime({
        date: now.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' }),
        time: now.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        dayName: now.toLocaleDateString('pl-PL', { weekday: 'long' }),
        dayNumber: now.getDate()
      });
    };
    updateTime();
    const intervalId = setInterval(updateTime, 1000);
    return () => clearInterval(intervalId);
  }, []);

  const isNightModeActive = useMemo(
    () => {
      const currentTime = currentDateTime.time.slice(0, 5);
      const currentDate = new Date();
      const parsedMinutes = parseClockTimeToMinutes(currentTime);

      if (parsedMinutes !== null) {
        currentDate.setHours(Math.floor(parsedMinutes / 60), parsedMinutes % 60, 0, 0);
      }

      return isNightModeEnabledAt(nightModeConfig, currentDate);
    },
    [currentDateTime.time, nightModeConfig]
  );

  const isBlackScreenAfterScheduleEndActive = useMemo(() => {
    if (!nightModeConfig.blackScreenAfterScheduleEnd || scheduleItems.length === 0) {
      return false;
    }

    const lastLessonEndMinutes = scheduleItems.reduce((latest, event) => {
      const endMinutes = parseClockTimeToMinutes(event.endTime);
      if (endMinutes === null) {
        return latest;
      }

      return Math.max(latest, endMinutes);
    }, -1);

    if (lastLessonEndMinutes < 0) {
      return false;
    }

    const currentMinutes =
      parseClockTimeToMinutes(currentDateTime.time.slice(0, 5)) ??
      new Date().getHours() * 60 + new Date().getMinutes();
    return currentMinutes >= lastLessonEndMinutes;
  }, [currentDateTime.time, nightModeConfig.blackScreenAfterScheduleEnd, scheduleItems]);

  // 3. Fetch Schedule & Messages
  useEffect(() => {
    const fetchSchedule = async () => {
      if (!roomInfo.building || !roomInfo.room) return;
      try {
        const targetDate = new Date();
        // Request an extra day before and after to handle ZUT API date offset quirk
        const dayBefore = new Date(targetDate);
        dayBefore.setDate(dayBefore.getDate() - 1);
        const dayBeforeFormatted = dayBefore.toISOString().split('T')[0];
        const twoDaysAfter = new Date(targetDate);
        twoDaysAfter.setDate(twoDaysAfter.getDate() + 2);
        const twoDaysAfterFormatted = twoDaysAfter.toISOString().split('T')[0];

        const fullId = roomInfo.room.startsWith(roomInfo.building)
          ? roomInfo.room
          : `${roomInfo.building} ${roomInfo.room}`;

        const url = `/api/schedule?kind=room&id=${encodeURIComponent(fullId)}&start=${dayBeforeFormatted}&end=${twoDaysAfterFormatted}`;
        console.log('[Tablet] Fetching schedule:', url);
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error('Nie udało się pobrać planu');
        }

        const data = (await response.json()) as ScheduleApiEvent[];
        console.log('[Tablet] Raw API response:', data.length, 'events');

        // Filter out invalid events (ZUT API returns empty first element) and match today's date
        // Use local YYYY-MM-DD comparison to avoid timezone issues
        const todayLocal = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;
        const targetEvents = data.filter((event) => {
          if (!event.start || !event.title) return false;
          const eventDate = event.start.split('T')[0];
          return eventDate === todayLocal;
        });
        console.log('[Tablet] Today:', todayLocal, '| Matching events:', targetEvents.length);

        const formattedEvents = await Promise.all(
          targetEvents.map(async (event) => {
            let messages: TabletMessageNotification[] = [];
            try {
              if (event.id) {
                messages = (await fetchMessages(event.id)) as TabletMessageNotification[];
              }
            } catch {
              messages = [];
            }

            return {
              id: event.id,
              startTime: new Date(event.start ?? '').toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }),
              endTime: new Date(event.end ?? event.start ?? '').toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }),
              description: event.subject || event.title,
              instructor: event.worker_title || 'Brak',
              room: event.room || '',
              group_name: event.group_name || '',
              login: event.login || '',
              notifications: messages,
              color: event.color || '#039be5',
              form: event.lesson_form_short || '',
            } as ScheduleEvent;
          })
        );

        setScheduleItems(formattedEvents);
        setIsLoading(false);
      } catch (error) {
        console.error('[Tablet] fetchSchedule API ERROR:', error);
        setScheduleItems([]);
        setIsLoading(false);
      }
    };

    if (roomInfo.room && !isNightModeActive && !forceBlackScreen) {
      fetchSchedule();
      // Production setting: refresh every minute (60000ms)
      const intervalId = setInterval(fetchSchedule, 60000);
      return () => clearInterval(intervalId);
    }
  }, [forceBlackScreen, isNightModeActive, roomInfo]);

  // View Helpers
  const parseTime = (timeStr: string) => {
    const [h, m] = timeStr.split(':').map(Number);
    return h + m / 60;
  };

  const now = new Date();
  const nowVal = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;

  const timelineViewportRef = useRef<HTMLDivElement>(null);
  const [timelineViewportHeight, setTimelineViewportHeight] = useState(0);

  useEffect(() => {
    const viewport = timelineViewportRef.current;
    if (!viewport) return;

    const updateViewportHeight = () => {
      setTimelineViewportHeight(viewport.clientHeight);
    };

    updateViewportHeight();

    const resizeObserver = new ResizeObserver(() => {
      updateViewportHeight();
    });

    resizeObserver.observe(viewport);
    window.addEventListener('resize', updateViewportHeight);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateViewportHeight);
    };
  }, []);

  // Layout calculations for right panel
  const slotHeight = 120; // 120px per hour
  const timelineMarkerOffset = 24;
  const timelineDayHeight = timeSlotsCount * slotHeight;
  const timelineContentHeight = timelineMarkerOffset + timelineDayHeight + timelineViewportHeight;
  const currentTimeOffset = (nowVal - calendarStartHour) * slotHeight;
  const activeTimelineEvent = scheduleItems.find((ev) => {
    const eventStart = parseTime(ev.startTime);
    const eventEnd = parseTime(ev.endTime);
    return nowVal >= eventStart && nowVal <= eventEnd;
  });

  const nextTimelineEvent = scheduleItems.find((ev: ScheduleEvent) => {
    return parseTime(ev.startTime) > nowVal;
  });

  let classToShowOnLeftPanel: ScheduleEvent | null = null;
  let leftPanelStatus = '';

  if (activeTimelineEvent) {
    const et = parseTime(activeTimelineEvent.endTime);
    // Jeśli z zajęć zostało 30 minut lub mniej i istnieje jakieś kolejne wydarzenie,
    // pokaż kolejne jako najbliższe.
    if (et - nowVal <= 0.5 && nextTimelineEvent) {
      classToShowOnLeftPanel = nextTimelineEvent;
      leftPanelStatus = 'Następne zajęcia:';
    } else {
      classToShowOnLeftPanel = activeTimelineEvent;
      leftPanelStatus = 'Aktualnie:';
    }
  } else if (nextTimelineEvent) {
    classToShowOnLeftPanel = nextTimelineEvent;
    leftPanelStatus = 'Następne zajęcia:';
  }

  const activeTimelineEventStartOffset = activeTimelineEvent
    ? Math.max(0, (parseTime(activeTimelineEvent.startTime) - calendarStartHour) * slotHeight)
    : 0;
  const rawTimelineOffset = activeTimelineEvent
    ? activeTimelineEventStartOffset
    : currentTimeOffset;
  const maxTimelineOffset = Math.max(0, timelineContentHeight - timelineViewportHeight);
  const timelineOffset = Math.min(Math.max(rawTimelineOffset, 0), maxTimelineOffset);
  const currentTimeLineTop = timelineMarkerOffset + currentTimeOffset - timelineOffset;
  const showCurrentTimeLine = nowVal >= calendarStartHour && nowVal <= calendarStartHour + timeSlotsCount;
  if (forceBlackScreen || isNightModeActive || isBlackScreenAfterScheduleEndActive) {
    return (
      <div
        className="tablet-night-screen"
        aria-label={
          forceBlackScreen
            ? 'Czarny ekran wymuszony przez administratora'
            : isNightModeActive
            ? 'Tryb nocny aktywny'
            : 'Czarny ekran po zakończeniu zajęć aktywny'
        }
      />
    );
  }

  if (isLoading) return <div className="fullscreen-msg">Wczytywanie systemu...</div>;

  return (
    <div className="tablet-wrapper" data-tablet-theme={displayTheme}>



      {/* LEFT PANEL */}
      <div className="tablet-left">


        <div className="tablet-room-info-centered">
          <div className="tablet-room-name">
            {roomInfo.room.startsWith(roomInfo.building) ? roomInfo.room : `${roomInfo.building} ${roomInfo.room}`}
          </div>

          <div className="tablet-class-status">
            {classToShowOnLeftPanel && (
              <div 
                className="current-class-info"
                style={{
                  borderLeftColor: classToShowOnLeftPanel.color || '#14b8a6',
                  backgroundColor: `${classToShowOnLeftPanel.color || '#14b8a6'}26`
                }}
              >
                <div className="class-stacked-info">
                  <div className="class-stacked-line status-line">
                    {leftPanelStatus === 'Aktualnie:' ? 'Aktualne zajęcia:' : 'Następne zajęcia:'}
                  </div>
                  <div className="class-stacked-line">
                    <span className="stacked-label">Przedmiot:</span>
                    <span className="stacked-val subject">
                      {classToShowOnLeftPanel.description} {classToShowOnLeftPanel.form ? `(${classToShowOnLeftPanel.form})` : ''}
                    </span>
                  </div>
                  {classToShowOnLeftPanel.group_name && (
                    <div className="class-stacked-line">
                      <span className="stacked-label">Grupa:</span>
                      <span className="stacked-val">{classToShowOnLeftPanel.group_name}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {classToShowOnLeftPanel?.notifications && classToShowOnLeftPanel.notifications.length > 0 && (
            <div className="tablet-messages-section">
              <div className="tablet-messages-header">🔔 Powiadomienia:</div>
              <div className="tablet-messages-viewport">
                <div className={`tablet-messages-scroller ${classToShowOnLeftPanel.notifications.length >= 2 ? 'is-overflowing' : ''}`}>
                  <div className="tablet-messages-list">
                    {classToShowOnLeftPanel.notifications.map((n, idx) => (
                      <div className="tablet-message-item" key={`msg-${idx}`}>
                        <div className="tablet-message-meta">
                          {n.lecturer && <span className="tablet-message-lecturer">{n.lecturer}</span>}
                          {n.isRoomChange && <span className="tablet-message-event" style={{ color: '#ef4444', fontWeight: 'bold' }}>ZMIANA SALI</span>}
                        </div>
                        <div className="tablet-message-body">{n.body}</div>
                        {n.createdAt && <div className="tablet-message-time">{n.createdAt}</div>}
                      </div>
                    ))}

                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="tablet-footer-logo">
          <img src={logo} alt="ZUT Logo" className="tablet-logo-bottom" />
        </div>
      </div>

      {/* RIGHT PANEL: TIMELINE */}
      <div className="tablet-right">
        <div className="timeline-viewport" ref={timelineViewportRef}>
          {showCurrentTimeLine && (
            <div className="current-time-line" style={{ top: `${currentTimeLineTop}px` }}>
              <div className="current-time-label">{currentDateTime.time.substring(0, 5)}</div>
              <div className="current-time-dot"></div>
            </div>
          )}

          <div
            className="timeline-container"
            style={{
              height: `${timelineContentHeight}px`,
              transform: `translateY(-${timelineOffset}px)`,
            }}
          >

            {/* Background Grid */}
            {Array.from({ length: timeSlotsCount }).map((_, i) => (
              <div
                key={i}
                className="time-slot"
                style={{
                  top: timelineMarkerOffset + i * slotHeight + 'px',
                  position: 'absolute',
                  width: '100%',
                }}
              >
                <div className="time-label">{calendarStartHour + i}:00</div>
                <div className="time-line"></div>
              </div>
            ))}

            {/* Render Events */}
            {scheduleItems.map((ev: ScheduleEvent, i: number) => {
              const st = parseTime(ev.startTime);
              const et = parseTime(ev.endTime);
              const dur = et - st;
              const top = (st - calendarStartHour) * slotHeight;
              const height = dur * slotHeight;
              const isPast = nowVal > et;

              return (
                <div
                  key={i}
                  className={`timeline-event ${isPast ? 'past' : ''}`}
                  style={{
                    top: timelineMarkerOffset + top + 'px',
                    height: (height - 4) + 'px', // tiny gap
                    backgroundColor: isPast ? (ev.color ? `${ev.color}20` : 'rgba(255, 255, 255, 0.05)') : (ev.color || '#334155'),
                    color: isPast ? '#94a3b8' : '#ffffff',
                    borderLeft: isPast && ev.color ? `4px solid ${ev.color}60` : undefined,
                    boxShadow: !isPast && ev.color ? `0 4px 15px ${ev.color}40` : 'none'
                  }}
                >
                  <div className="event-title">{ev.description} ({ev.form})</div>
                  <div className="event-time">{ev.startTime} - {ev.endTime}</div>
                  <div className="event-instructor">{ev.instructor} • {ev.group_name}</div>
                  {ev.notifications && ev.notifications.length > 0 && (
                    <div className="event-notifications-container">
                      {ev.notifications.map((n: TabletMessageNotification, idx: number) => (
                        <div key={idx} className="event-notification-pill" style={n.isRoomChange ? { backgroundColor: '#ef4444', color: '#fff' } : {}}>
                          {n.isRoomChange ? `⚠️ ZMIANA SALI: ${n.newRoom || n.body}` : `📢 ${n.body}`}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

          </div>
        </div>

        {/* FLOATING WIDGET (QR Only) */}
        <div className="floating-clock-widget" style={{ padding: '0.8rem 1rem' }}>
          <div className="qr-container-column">
            <div className="qr-wrapper-mini">
              <QRCodeCanvas
                value={`https://plan.zut.edu.pl/#${encodeURIComponent(roomInfo.room.startsWith(roomInfo.building) ? roomInfo.room : `${roomInfo.building} ${roomInfo.room}`)}&&&&`}
                size={58}
                fgColor="#0f172a"
              />
            </div>
            <span className="qr-label-below" style={{ color: 'rgba(255,255,255,0.7)' }}>Odwiedź wirtualny<br />plan sali</span>
          </div>
        </div>

      </div>
    </div>
  );
}
