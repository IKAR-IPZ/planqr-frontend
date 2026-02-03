import { useEffect, useState, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import './Tablet.css';
import { fetchMessages } from '../services/messageService';
import LogoWI from '../../assets/WI.jpg';
import LogoZUT from '../../assets/ZUT_Logo.png';
import { QRCodeCanvas } from 'qrcode.react';
import { get } from 'http';

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
  notifications: string[];
  color: string;
}

export default function Tablet() {
  const navigate = useNavigate();
  const { secretUrl } = useParams<{ secretUrl: string }>();

  const timeGridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const rootElement = document.getElementById('root');
    if (rootElement) {
      rootElement.classList.add('tablet-mode');
    }

    return () => {
      if (rootElement) {
        rootElement.classList.remove('tablet-mode');
      }
    };
  }, []);

  const params = useParams<{ room?: string }>();
  const location = useLocation();

  const [roomInfo, setRoomInfo] = useState({
    building: "",
    room: ""
  });

  const [isValid, setIsValid] = useState<boolean | null>(null); // Stan do przechowywania wyniku walidacji


  // ZAKOMENTOWANE: Walidacja room i secretUrl - włącz ponownie w produkcji
  // useEffect(() => {
  //   const validateRoomAndSecretUrl = async () => {
  //     try {
  //       const response = await fetch(
  //         `/api/devices/validate?room=${encodeURIComponent(
  //           roomInfo.room
  //         )}&secretUrl=${encodeURIComponent(secretUrl || '')}`
  //       );

  //       if (!response.ok) {
  //         throw new Error('Nie znaleziono urządzenia z podanym room i secretUrl.');
  //       }

  //       const data = await response.json();
  //       console.log('Walidacja zakończona sukcesem:', data);
  //       setIsValid(true);
  //     } catch (err: any) {
  //       console.error('Błąd podczas walidacji:', err.message);
  //       setIsValid(false);
  //       setError(err.message);
  //     }
  //   };

  //   if (roomInfo.room && secretUrl) {
  //     validateRoomAndSecretUrl();
  //   }
  // }, [roomInfo.room, secretUrl]);

  // Tymczasowe obejście walidacji dla developmentu
  useEffect(() => {
    setIsValid(true);
  }, []);

  // ZAKOMENTOWANE: Sprawdzanie konfiguracji urządzenia - włącz ponownie w produkcji
  // useEffect(() => {
  //   const checkConfig = async () => {
  //     const storedUuid = localStorage.getItem('tablet_uuid');
  //     if (!storedUuid) return;

  //     try {
  //       const response = await fetch(`/api/registry/status/${storedUuid}`);
  //       if (response.ok) {
  //         const data = await response.json();
  //         if (data.status !== 'ACTIVE') {
  //           navigate('/registry');
  //           return;
  //         }

  //         if (data.config && data.config.room && data.config.room !== roomInfo.room) {
  //           navigate(`/tablet/${encodeURIComponent(data.config.room)}/${data.config.secretUrl}`);
  //         }
  //       } else {
  //         // If 404 meaning device not found
  //         if (response.status === 404) {
  //           navigate('/registry');
  //         }
  //       }
  //     } catch (err) {
  //       console.error("Config check failed", err);
  //     }
  //   };

  //   const interval = setInterval(checkConfig, 10000); // Check every 10 seconds
  //   return () => clearInterval(interval);
  // }, [navigate, roomInfo]);



  // ZAKOMENTOWANE: Przekierowanie przy nieudanej walidacji - włącz ponownie w produkcji
  // if (isValid === false) {
  //   navigate('/registry');
  //   return null;
  // }

  const showSpecialDateForAll = false;
  const hasSpecialDate = showSpecialDateForAll;

  const initialDate = hasSpecialDate
    ? new Date()
    : new URLSearchParams(location.search).get('date')
      ? new Date(new URLSearchParams(location.search).get('date') || '')
      : new Date();

  const [currentDateTime, setCurrentDateTime] = useState({
    date: initialDate.toLocaleDateString('pl-PL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }),
    time: new Date().toLocaleTimeString('pl-PL', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }),
    dayName: initialDate.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
    dayNumber: initialDate.getDate()
  });

  const [scheduleItems, setScheduleItems] = useState<ScheduleEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<ScheduleEvent | null>(null);
  const [calendarStartHour, setCalendarStartHour] = useState(6);
  const [scrollableStates, setScrollableStates] = useState<{ [key: number]: boolean }>({});
  const marqueeRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const updatedScrollableStates: { [key: number]: boolean } = {};

    scheduleItems.forEach((_, index) => {
      const marqueeElement = marqueeRefs.current[index];
      if (marqueeElement) {
        const isOverflowing = marqueeElement.scrollWidth > 925;
        // console.log(marqueeElement.scrollWidth, marqueeElement.clientWidth, isOverflowing);
        updatedScrollableStates[index] = isOverflowing;
      }
    });

    setScrollableStates(updatedScrollableStates);
  }, [scheduleItems]);


  useEffect(() => {
    const parseRoomInfo = () => {
      let roomPart = '';

      if (params.room) {
        roomPart = decodeURIComponent(params.room);
      } else {
        const pathParts = location.pathname.split('/');
        if (pathParts.length >= 3) {
          roomPart = decodeURIComponent(pathParts[2]);
        }
      }

      if (roomPart) {
        // Extract building code from room name (e.g., "WI1-100" -> "WI", "WA1-100" -> "WA")
        // Match letters at the start before numbers or dashes
        const buildingMatch = roomPart.match(/^([A-Z]+)/);
        const building = buildingMatch ? buildingMatch[1] : "WI"; // Default to WI if not found

        setRoomInfo({
          building: building,
          room: roomPart
        });
      }
    };

    parseRoomInfo();
  }, [location.pathname, params]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      const now = new Date();
      setCurrentDateTime({
        date: now.toLocaleDateString('pl-PL', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        }),
        time: now.toLocaleTimeString('pl-PL', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
        dayName: now.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
        dayNumber: now.getDate(),
      });
    }, 1000);

    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const fetchSchedule = async () => {
      if (!roomInfo.building || !roomInfo.room) {
        console.log("Informacje o sali nie są jeszcze dostępne");
        return;
      }

      setIsLoading(true);

      // MOCK DATA - Remove this when backend is ready
      const USE_MOCK_DATA = true;

      if (USE_MOCK_DATA) {
        const mockEvents: ScheduleEvent[] = [
          {
            id: '1',
            startTime: '08:15',
            endTime: '10:00',
            description: 'Sieci komputerowe',
            instructor: 'Dr Jan Kowalski',
            room: roomInfo.room,
            form: 'L',
            group_name: 'Laboratorium A',
            login: 'jkowalski',
            notifications: [],
            color: '#2d4190'
          },
          {
            id: '2',
            startTime: '10:15',
            endTime: '12:00',
            description: 'Sieci komputerowe',
            instructor: 'Dr Jan Kowalski',
            room: roomInfo.room,
            form: 'L',
            group_name: 'Laboratorium B',
            login: 'jkowalski',
            notifications: ['Proszę przynieść laptopy'],
            color: '#28a745'
          },
          {
            id: '3',
            startTime: '12:15',
            endTime: '14:00',
            description: 'Sieci komputerowe',
            instructor: 'Dr Jan Kowalski',
            room: roomInfo.room,
            form: 'L',
            group_name: 'Laboratorium C',
            login: 'jkowalski',
            notifications: [],
            color: '#2d4190'
          },
          {
            id: '4',
            startTime: '14:15',
            endTime: '16:00',
            description: 'Sieci komputerowe',
            instructor: 'Dr Jan Kowalski',
            room: roomInfo.room,
            form: 'L',
            group_name: 'Laboratorium D',
            login: 'jkowalski',
            notifications: [],
            color: '#28a745'
          }
        ];

        setScheduleItems(mockEvents);
        setCalendarStartHour(8);
        setIsLoading(false);
        setError(null);
        return;
      }
      // END MOCK DATA

      try {
        const urlParams = new URLSearchParams(window.location.search);
        const dateParam = urlParams.get('date');

        let targetDate;
        if (hasSpecialDate) {
          targetDate = new Date();
        } else if (dateParam) {
          targetDate = new Date(dateParam);
          if (isNaN(targetDate.getTime())) {
            throw new Error('Nieprawidłowy format daty');
          }
        } else {
          targetDate = new Date();
        }

        const formattedDate = targetDate.toISOString().split('T')[0];

        const nextDay = new Date(targetDate);
        nextDay.setDate(nextDay.getDate() + 1);
        const nextDayFormatted = nextDay.toISOString().split('T')[0];

        const fullId = roomInfo.room.startsWith(roomInfo.building)
          ? roomInfo.room
          : `${roomInfo.building} ${roomInfo.room}`;

        const url = `/api/schedule?kind=room&id=${encodeURIComponent(fullId)}&start=${formattedDate}&end=${nextDayFormatted}`;

        console.log("Pobieranie planu zajęć z URL:", url);

        const response = await fetch(url);
        if (!response.ok) throw new Error('Nie udało się pobrać planu zajęć');

        const data = await response.json();
        console.log("Otrzymane dane planu:", data);

        const targetDateString = targetDate.toDateString();
        const targetEvents = data.filter((event: any) => {
          const eventDate = new Date(event.start);
          return eventDate.toDateString() === targetDateString;
        });

        console.log("Przefiltrowane wydarzenia na dzisiaj:", targetEvents);

        const formattedEvents = await Promise.all(
          targetEvents.map(async (event: any) => {
            let messages = [];
            try {
              if (event.id) {
                messages = await fetchMessages(event.id); // Pobierz powiadomienia dla każdego wydarzenia
              }
            } catch (err) {
              console.error('Błąd podczas pobierania wiadomości dla lekcji:', event.id, err);
            }

            const startTime = new Date(event.start).toLocaleTimeString('pl-PL', {
              hour: '2-digit',
              minute: '2-digit',
            });

            const endTime = new Date(event.end).toLocaleTimeString('pl-PL', {
              hour: '2-digit',
              minute: '2-digit',
            });

            return {
              id: event.id,
              startTime,
              endTime,
              description: event.subject || event.title,
              instructor: event.worker_title || 'Brak informacji',
              room: event.room || 'Brak informacji',
              group_name: event.group_name || '',
              login: event.login || '',
              notifications: messages.map((msg: { body: string }) => msg.body), // Dodaj powiadomienia
              color: event.color || '#039be5',
              form: event.lesson_form_short || '',
            } as ScheduleEvent;
          })
        );

        console.log("Sformatowane wydarzenia:", formattedEvents);

        const sortedEvents = formattedEvents.sort((a, b) =>
          a.startTime.localeCompare(b.startTime)
        );

        // Ustaw godzinę początkową kalendarza na podstawie pierwszego wydarzenia
        if (sortedEvents.length > 0) {
          const firstEventStartHour = parseInt(
            sortedEvents[0].startTime.split(':')[0]
          );
          setCalendarStartHour(Math.max(6, firstEventStartHour)); // Minimum godz. 6, lub godzinę przed pierwszymi zajęciami
        } else {
          setCalendarStartHour(6); // Domyślna godzina początkowa
        }

        setScheduleItems(sortedEvents);
        if (sortedEvents.length > 0) {
          setSelectedEvent(sortedEvents[0]);
        }
        setIsLoading(false);
        setError(null);
      } catch (error) {
        console.error('Błąd podczas pobierania planu zajęć:', error);
        setScheduleItems([]);
        setError('Nie udało się pobrać planu zajęć');
        setIsLoading(false);
      }
    };

    fetchSchedule();

    const intervalId = setInterval(fetchSchedule, 15 * 60 * 1000);

    return () => clearInterval(intervalId);
  }, [roomInfo.building, roomInfo.room, location.search, hasSpecialDate]);

  useEffect(() => {
    const updateMessages = async () => {
      try {
        const updatedItems = await Promise.all(scheduleItems.map(async (event) => {
          try {
            const messages = await fetchMessages(event.id);
            return { ...event, notifications: messages.map((msg: { body: string }) => msg.body) };
          } catch {
            return event;
          }
        }));
        setScheduleItems(updatedItems);
      } catch (err) {
        console.error("Błąd przy aktualizacji wiadomości:", err);
      }
    };

    if (scheduleItems.length > 0) {
      updateMessages();
      const intervalId = setInterval(updateMessages, 30 * 1000);
      return () => clearInterval(intervalId);
    }
  }, [scheduleItems.length]);

  // Funkcja do automatycznego przewijania kalendarza
  const scrollToCurrentTime = () => {
    if (!timeGridRef.current || scheduleItems.length === 0) return;

    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    // Znajdź aktualnie trwające zajęcia lub najbliższe przyszłe
    const currentEvent = scheduleItems.find(event => isEventCurrent(event));
    const upcomingEvent = scheduleItems.find(event => {
      const eventStartHour = parseInt(event.startTime.split(':')[0]);
      const eventStartMinute = parseInt(event.startTime.split(':')[1]);
      const eventStartTime = eventStartHour + eventStartMinute / 60;
      const currentTime = currentHour + currentMinute / 60;
      return eventStartTime > currentTime;
    });

    let targetHour = currentHour;

    if (currentEvent) {
      // Jeśli są obecnie trwające zajęcia, przewiń do ich początku
      targetHour = parseInt(currentEvent.startTime.split(':')[0]);
    } else if (upcomingEvent) {
      // Jeśli nie ma obecnie trwających zajęć, przewiń do najbliższych przyszłych
      targetHour = parseInt(upcomingEvent.startTime.split(':')[0]);
    }

    // Oblicz pozycję do przewinięcia
    const slotHeight = 100;
    const scrollPosition = Math.max(0, (targetHour - calendarStartHour) * slotHeight);

    timeGridRef.current.scrollTo({
      top: scrollPosition,
      behavior: 'smooth'
    });
  };

  // Efekt do automatycznego przewijania
  useEffect(() => {
    if (!isLoading && !error && scheduleItems.length > 0) {
      // Przewiń po załadowaniu danych
      setTimeout(scrollToCurrentTime, 100);

      // Ustaw interwał do przewijania co minutę
      const scrollInterval = setInterval(scrollToCurrentTime, 60000);

      return () => clearInterval(scrollInterval);
    }
  }, [scheduleItems, calendarStartHour, isLoading, error]);

  const getEventTime = (event: ScheduleEvent) => {
    const startHour = parseInt(event.startTime.split(':')[0]);
    const startMinute = parseInt(event.startTime.split(':')[1]);
    const endHour = parseInt(event.endTime.split(':')[0]);
    const endMinute = parseInt(event.endTime.split(':')[1]);

    const startTimeValue = startHour + startMinute / 60;
    const endTimeValue = endHour + endMinute / 60;

    return { startTimeValue, endTimeValue };
  }

  const isEventCurrent = (event: ScheduleEvent) => {
    const now = new Date();
    const currentTimeValue = now.getHours() + now.getMinutes() / 60;

    const startHour = parseInt(event.startTime.split(':')[0]);
    const startMinute = parseInt(event.startTime.split(':')[1]);
    const endHour = parseInt(event.endTime.split(':')[0]);
    const endMinute = parseInt(event.endTime.split(':')[1]);

    const startTimeValue = startHour + startMinute / 60;
    const endTimeValue = endHour + endMinute / 60;

    return currentTimeValue >= startTimeValue && currentTimeValue < endTimeValue;
  };

  const timeSlots = () => {
    return Array.from({ length: 15 }, (_, i) => {
      const hour = i + calendarStartHour;
      const hourFormatted = hour < 10 ? `0${hour}` : `${hour}`;
      return `${hourFormatted}:00`;
    });
  };

  const getEventStyle = (event: ScheduleEvent) => {
    const startTime = getEventTime(event).startTimeValue;
    const endTime = getEventTime(event).endTimeValue;
    const duration = endTime - startTime;
    const slotHeight = 100;
    const topPosition = (startTime - calendarStartHour) * slotHeight;
    const height = duration * slotHeight;

    return {
      top: `${topPosition}px`,
      height: `${height}px`,
    };
  };

  const getCurrentTimePosition = () => {
    const currentTime = new Date().getHours() + new Date().getMinutes() / 60;
    return (currentTime - calendarStartHour) * 100;
  };

  const findCurrentEvent = () => {
    const currentEvent = scheduleItems.find(event => isEventCurrent(event));
    return currentEvent;
  };

  useEffect(() => {
    if (!isLoading && !error && scheduleItems.length > 0) {
      const currentEvent = findCurrentEvent();
      if (currentEvent) {
        setSelectedEvent(currentEvent);
      } else {
        setSelectedEvent(scheduleItems[0]);
      }
    }
  }, [scheduleItems, isLoading, error]);

  return (
    <div className="tablet-container">
      <div className="calendar-layout">
        {/* Left Panel - Current Class Display */}
        <div className="current-class-display">
          {(() => {
            const currentEvent = findCurrentEvent();
            const nextEvent = !currentEvent ? scheduleItems.find(event => {
              const now = new Date();
              const eventStart = new Date();
              const [hours, minutes] = event.startTime.split(':');
              eventStart.setHours(parseInt(hours), parseInt(minutes), 0);
              return eventStart > now;
            }) : null;

            const displayEvent = currentEvent || nextEvent;

            if (!displayEvent) {
              return (
                <div className="no-current-class">
                  <h2>Brak zajęć</h2>
                  <p>{scheduleItems.length === 0 ? 'Dziś nie ma zaplanowanych zajęć' : 'Wszystkie zajęcia zostały zakończone'}</p>
                </div>
              );
            }

            return (
              <>
                <div className="class-status-badge">
                  {currentEvent ? 'TRWAJĄ ZAJĘCIA' : 'NASTĘPNE ZAJĘCIA'}
                </div>
                <h1 className="current-class-title">{displayEvent.description}</h1>
                <div className="current-class-details">
                  <div className="detail-row">
                    <span className="detail-label">Prowadzący:</span>
                    <span className="detail-value">{displayEvent.instructor}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Godziny:</span>
                    <span className="detail-value">{displayEvent.startTime} - {displayEvent.endTime}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Grupa:</span>
                    <span className="detail-value">{displayEvent.group_name}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Forma:</span>
                    <span className="detail-value">{displayEvent.form}</span>
                  </div>
                </div>
              </>
            );
          })()}
        </div>

        {/* Right Panel - Calendar */}
        <div className="calendar-panel">
          <div className="header-container">
            <div className="header-logos">
              <div className="university-logo-container">
                <img src={LogoZUT} alt="Logo ZUT" className="university-logo" />
              </div>
            </div>

            <div className="room-info-container">
              <div className="datetime-placeholder">
                <div className="time">
                  {currentDateTime.time}
                </div>
              </div>

              <div className="room-number">
                <span>{roomInfo.room}</span>
              </div>
              <div className='qrcode'>
                <QRCodeCanvas
                  value={`https://plan.zut.edu.pl/${roomInfo.building}/${encodeURIComponent(roomInfo.room)}`}
                  size={100}
                  style={{ width: '100%', height: 'auto' }}
                />
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="loading-container">Ładowanie planu zajęć...</div>
          ) : error ? (
            <div className="error-container">{error}</div>
          ) : scheduleItems.length === 0 ? (
            <div className="no-events-container">Brak zajęć na dzisiaj</div>
          ) : (
            <div className="calendar-container">
              <div className="day-indicator">
                <div className="day-name">{currentDateTime.dayName}</div>
                <div className="day-circle">{currentDateTime.dayNumber}</div>
              </div>

              <div className="time-grid" ref={timeGridRef}>
                {timeSlots().map((time, index) => (
                  <div key={index} className="time-slot">
                    <div className="time-label">{time}</div>
                    <div className="time-cell"></div>
                  </div>
                ))}

                <div className="current-time-indicator" style={{ top: `${getCurrentTimePosition()}px` }}>
                  <div className="time-circle"></div>
                </div>

                {scheduleItems.map((event, index) => (
                  <div
                    key={index}
                    className={`calendar-event ${isEventCurrent(event) ? 'current' : ''}`}
                    style={{
                      ...getEventStyle(event),
                      backgroundColor: event.color,
                      color: '#fff',
                    }}
                  >
                    <div className="calendar-event-left">
                      <span>{event.startTime}<br /> - <br />{event.endTime}</span>
                    </div>
                    <div className="calendar-event-right">
                      <div className="event-description">
                        <div className="description-block description-block-1">
                          <span>{event.description} ({event.form})</span>
                        </div>
                        <div className="description-block description-block-2">
                          <span>{event.instructor}</span>
                        </div>
                        <div className="description-block description-block-3">
                          <span>{event.group_name}</span>
                        </div>
                      </div>
                      <div className="event-footer">
                        {event.notifications && event.notifications.length > 0 ? (
                          <div
                            ref={(el) => (marqueeRefs.current[index] = el)}
                            className={`notifications-marquee ${!scrollableStates[index] ? 'no-scroll' : ''}`}
                          >
                            {event.notifications.map((notification, notifIndex) => (
                              <div key={notifIndex} className="notification-item">
                                {notification}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="notifications-marquee no-scroll">
                            <span>Brak powiadomień</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}