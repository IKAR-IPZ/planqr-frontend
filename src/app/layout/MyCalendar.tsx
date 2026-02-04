import { useState, useEffect } from 'react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import FullCalendar from '@fullcalendar/react';
import './MyCalendar.css';
import plLocale from '@fullcalendar/core/locales/pl';
import { useParams } from 'react-router-dom';
import tippy from 'tippy.js';
import 'tippy.js/dist/tippy.css';
import { fetchMessages } from "../services/messageService";
import { EventApi, EventClickArg } from '@fullcalendar/core';
import listPlugin from '@fullcalendar/list';
// TODO: Add LogoWA import when available
// import LogoWA from '../../assets/WA.jpg';
import { checkRoomStatus, getRoomReservations, createReservation, RoomReservation } from "../services/reservationService";

export default function MyCalendar() {
  const { department, room } = useParams();
  const [events, setEvents] = useState([]);
  const [currentDates, setCurrentDates] = useState({ start: '', end: '' });
  const [facultyInfo, setFacultyInfo] = useState<{ name: string; logo: string | null }>({ name: '', logo: null });

  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [selectedLessonId, setSelectedLessonId] = useState<number | null>(null);
  const [login, setLogin] = useState<string | null>(null);
  const [lessonLogin, setLessonLogin] = useState<string | null>(null);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EventApi | null>(null);
  const [currentRoomStatus, setCurrentRoomStatus] = useState<'occupied' | 'free' | 'reserved'>('free');
  const [showReservationModal, setShowReservationModal] = useState(false);
  const [reservationStart, setReservationStart] = useState('');
  const [reservationEnd, setReservationEnd] = useState('');
  const [reservations, setReservations] = useState<RoomReservation[]>([]);


  useEffect(() => {
    document.title = `Plan sali - ${room}`
  }
    , []);

  const handleEventClick = (info: EventClickArg) => {
    const event = info.event;
    console.log("Clicked event:", event.extendedProps);

    setSelectedEvent(event);
    const lessonId = event.extendedProps.id;

    if (lessonId) {
      setSelectedLessonId(lessonId);
      setLessonLogin(event.extendedProps.login);
      fetchMessages(lessonId)
        .then(setMessages)
        .catch((err) => console.error("Error fetching messages:", err));
    } else {
      console.error("Lesson ID is missing!");
    }

    setIsSidebarOpen(true);
  };

  const closeSidebar = () => {
    setSelectedEvent(null);
    setIsSidebarOpen(false);
  };

  const [calendarView, setCalendarView] = useState(window.innerWidth < 600 ? 'listWeek' : 'timeGridWeek');

  const handleWindowResize = () => {
    if (window.innerWidth < 600) {
      setCalendarView('listWeek');
    } else {
      setCalendarView('timeGridWeek');
    }
  };

  useEffect(() => {
    window.addEventListener('resize', handleWindowResize);
    return () => {
      window.removeEventListener('resize', handleWindowResize);
    };
  }, []);

  const fetchEvents = async (startDate: string, endDate: string) => {
    const url = `/schedule_student.php?kind=apiwi&department=${department}&room=${room}&start=${startDate}&end=${endDate}`;

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch events');
      const data = await response.json();

      // Add reservations as events (use current reservations state)
      const reservationEvents = (reservations || []).map((reservation) => ({
        title: 'Rezerwacja',
        start: reservation.startTime,
        end: reservation.endTime,
        color: '#f59e0b',
        borderColor: '#f59e0b',
        extendedProps: {
          isReservation: true,
          reservationId: reservation.id
        }
      }));

      // Combine scheduled events with reservations
      const allEvents = [...data, ...reservationEvents];

      const mappedEvents = allEvents.map((event: any) => ({
        title: event.title,
        start: event.start,
        end: event.end,
        description: event.description,
        color: event.color,
        borderColor: event.borderColor,
        worker: event.worker,
        worker_title: event.worker_title,
        worker_cover: event.worker_cover,
        room: event.room,
        group_name: event.group_name,
        lesson_form: event.lesson_form,
        lesson_status: event.lesson_status,
        lesson_form_short: event.lesson_form_short,
        tok_name: event.tok_name,
        lesson_status_short: event.lesson_status_short,
        status_item: event.status_item,
        subject: event.subject,
        wydzial: event.wydzial,
        wydz_sk: event.wydz_sk,
        extendedProps: {
          id: event.id,
          login: event.login,
        }
      }));


      setEvents(mappedEvents);

      // Extract faculty info from first event
      setFacultyInfo({
        name: department || '',
        logo: null
      });

      console.log('Fetched events:', data);
    } catch (error) {
      console.error('Error fetching events:', error);
    }
  };


  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const handleReserveRoom = async () => {
    if (!department || !room || !reservationStart || !reservationEnd) {
      alert('Proszę wypełnić wszystkie pola');
      return;
    }

    try {
      await createReservation({
        room,
        department,
        startTime: reservationStart,
        endTime: reservationEnd,
        status: 'reserved'
      });
      setShowReservationModal(false);
      setReservationStart('');
      setReservationEnd('');
      // Refresh reservations and events
      if (currentDates.start && currentDates.end) {
        const updatedReservations = await getRoomReservations(room, department, currentDates.start, currentDates.end);
        setReservations(updatedReservations);
        // Re-fetch events to show new reservation
        await fetchEvents(currentDates.start, currentDates.end);
      }
      alert('Sala została zarezerwowana');
    } catch (error) {
      console.error('Error creating reservation:', error);
      alert('Nie udało się zarezerwować sali');
    }
  };

  const getStatusColor = (status: 'occupied' | 'free' | 'reserved') => {
    switch (status) {
      case 'occupied':
        return '#ef4444'; // red
      case 'reserved':
        return '#f59e0b'; // orange
      case 'free':
        return '#10b981'; // green
      default:
        return '#6b7280'; // gray
    }
  };

  const getStatusText = (status: 'occupied' | 'free' | 'reserved') => {
    switch (status) {
      case 'occupied':
        return 'Zajęta';
      case 'reserved':
        return 'Rezerwacja';
      case 'free':
        return 'Wolna';
      default:
        return 'Nieznany';
    }
  };

  useEffect(() => {
    const loadData = async () => {
      if (currentDates.start && currentDates.end) {
        if (department && room) {
          const res = await getRoomReservations(room, department, currentDates.start, currentDates.end);
          setReservations(res);
        }
        await fetchEvents(currentDates.start, currentDates.end);
      }
    };

    loadData();
    const intervalId = setInterval(loadData, 15 * 60 * 1000); // 15 minutes in milliseconds

    return () => clearInterval(intervalId);
  }, [department, room, currentDates]);

  // Re-fetch events when reservations change
  useEffect(() => {
    if (currentDates.start && currentDates.end) {
      fetchEvents(currentDates.start, currentDates.end);
    }
  }, [reservations]);

  // Check current room status
  useEffect(() => {
    const updateRoomStatus = async () => {
      if (department && room) {
        const status = await checkRoomStatus(room, department, new Date());
        setCurrentRoomStatus(status);
      }
    };

    updateRoomStatus();
    const statusInterval = setInterval(updateRoomStatus, 60000); // Update every minute
    return () => clearInterval(statusInterval);
  }, [department, room, events, reservations]);

  return (
    <>
      <div className="lecturer-calendar">
        <div className="calendar-view-container">
          <div className="plan-header-info">
            <div className="plan-header-text">
              <h2 className="plan-faculty-name">Wydział: {facultyInfo.name || department}</h2>
              <h3 className="plan-room-number">Sala: {room}</h3>
              <div className="plan-room-status" style={{
                backgroundColor: getStatusColor(currentRoomStatus),
                color: 'white',
                padding: '0.6rem 1.2rem',
                borderRadius: '8px',
                fontSize: '1rem',
                fontWeight: '600',
                marginTop: '0.5rem',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
              }}>
                Status: {getStatusText(currentRoomStatus)}
              </div>
              {currentRoomStatus === 'free' && (
                <button
                  onClick={() => setShowReservationModal(true)}
                  className="plan-reserve-button"
                  style={{
                    marginTop: '0.5rem',
                    padding: '0.6rem 1.2rem',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '0.95rem',
                    fontWeight: '600'
                  }}
                >
                  Zarezerwuj salę
                </button>
              )}
            </div>
          </div>
          <div className={`main-content ${isSidebarOpen ? 'shrink' : ''}`}>
            <FullCalendar
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
              initialView={calendarView}
              events={events}
              headerToolbar={{
                left: 'prev,next today',
                center: 'title',
                right: 'timeGridDay,timeGridWeek,dayGridMonth',
              }}
              height="auto"
              locale={plLocale}
              allDaySlot={false}
              datesSet={(dateInfo) => {
                setCurrentDates({
                  start: dateInfo.startStr,
                  end: dateInfo.endStr,
                });
              }}
              eventDidMount={(info) => {
                // Sprawdzenie, czy użytkownik korzysta z ekranu dotykowego
                const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

                if (!isTouchDevice) {
                  const content = `${info.event.title} , prowadzący ${info.event.extendedProps.worker_title}, sala ${info.event.extendedProps.room}, grupa ${info.event.extendedProps.group_name} - ${info.event.extendedProps.lesson_status}`;
                  tippy(info.el, {
                    content: content,
                    placement: 'top',
                    trigger: 'mouseenter focus', // Wyświetlanie tylko po najechaniu myszką lub skupieniu
                    theme: 'custom-yellow',
                  });
                }
              }}
              eventClick={handleEventClick}
              slotMinTime="07:00:00"
              slotMaxTime="22:00:00"
              windowResize={handleWindowResize}

            />
          </div>
        </div>
        {isSidebarOpen && (
          <div className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
            <button
              className="sidebarCloseButton"
              onClick={closeSidebar}
            >
              Zamknij
            </button>
            {selectedEvent ? (
              <div>
                <h3 className="text-xl font-bold mb-4">{selectedEvent.title}</h3>

                <p><strong>Sala:</strong> {selectedEvent.extendedProps.room}<strong>  Grupa:</strong> {selectedEvent.extendedProps.group_name}</p>
              </div>
            ) : (
              <p>Brak szczegółów wydarzenia</p>
            )}
            <div className="sidebarChat">
              <div className="messages-container">
                {messages.map((msg, index) => (
                  <div key={index} className="message-wrapper">
                    <div className="message-header">
                      <strong>{msg.lecturer}</strong>
                      <span className="message-time">{msg.createdAt ? formatDate(msg.createdAt) : "Invalid Date"}</span>
                    </div>
                    <div className="message-bubble">
                      <p className="message-text">{msg.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Reservation Modal */}
      {
        showReservationModal && (
          <div className="reservation-modal-overlay" onClick={() => setShowReservationModal(false)}>
            <div className="reservation-modal" onClick={(e) => e.stopPropagation()}>
              <h2>Rezerwacja sali {room}</h2>
              <div className="reservation-form">
                <label>
                  Data i godzina rozpoczęcia:
                  <input
                    type="datetime-local"
                    value={reservationStart}
                    onChange={(e) => setReservationStart(e.target.value)}
                    min={new Date().toISOString().slice(0, 16)}
                  />
                </label>
                <label>
                  Data i godzina zakończenia:
                  <input
                    type="datetime-local"
                    value={reservationEnd}
                    onChange={(e) => setReservationEnd(e.target.value)}
                    min={reservationStart || new Date().toISOString().slice(0, 16)}
                  />
                </label>
                <div className="reservation-modal-actions">
                  <button onClick={() => setShowReservationModal(false)}>Anuluj</button>
                  <button onClick={handleReserveRoom} style={{ backgroundColor: '#10b981' }}>Zarezerwuj</button>
                </div>
              </div>
            </div>
          </div>
        )
      }
    </>
  );
}