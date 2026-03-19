import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import plLocale from '@fullcalendar/core/locales/pl';
import tippy from 'tippy.js';
import 'tippy.js/dist/tippy.css';
import { EventClickArg } from '@fullcalendar/core';
import { fetchMessages, createMessage, deleteMessage } from "../services/messageService";
import { FaPaperPlane, FaTimes, FaTrash } from "react-icons/fa";
import * as leoProfanity from "leo-profanity";
import polishBadWords from "../../assets/badWords";

leoProfanity.loadDictionary("en");
leoProfanity.add(polishBadWords);

// =====================================================================
// 🛠️ MOCK / TRYB TESTOWY (TYLKO DLA DEWELOPERA) 🛠️
// =====================================================================
// Aby podejrzeć plan konkretnego dydaktyka, wpisz jego Imię i Nazwisko poniżej.
// Na przykład: "Śliwiński Grzegorz" lub "Nowak Anna".
// 
// Jeśli zostawisz pusty tekst "", aplikacja zadziała standardowo i pobierze
// plan zalogowanego obecnie użytkownika.
// PAMIĘTAJ ABY ZOSTAWIĆ PUSTE PRZED WRZUCENIEM NA PRODUKCJĘ!
// =====================================================================
const MOCK_TEACHER_NAME = "Lipczyński Tomasz";
// =====================================================================

export default function LecturerCalendar() {
  const navigate = useNavigate();
  const { teacher } = useParams<{ teacher?: string }>();
  
  const [actualLogin, setActualLogin] = useState<string | null>(null);
  const [activeTeacher, setActiveTeacher] = useState<string | null>(MOCK_TEACHER_NAME || null);
  
  const [events, setEvents] = useState<any[]>([]);
  const [currentDates, setCurrentDates] = useState({ start: '', end: '' });

  console.log("[LecturerCalendar] Render - activeTeacher:", activeTeacher, "actualLogin:", actualLogin);

  // Sidebar state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedEventData, setSelectedEventData] = useState<any | null>(null);

  // Messages state
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Room Edit
  const [editingRoom, setEditingRoom] = useState(false);
  const [editedRoom, setEditedRoom] = useState("");

  // Calendar View
  const [calendarView, setCalendarView] = useState(window.innerWidth < 1024 ? 'listWeek' : 'timeGridWeek');

  const handleWindowResize = () => {
    setCalendarView(window.innerWidth < 1024 ? 'listWeek' : 'timeGridWeek');
  };

  useEffect(() => {
    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, []);

  // Init Login & Teacher
  // ⚠️ MOCK HAS ABSOLUTE PRIORITY: if MOCK_TEACHER_NAME is set, activeTeacher is NEVER changed by login check.
  useEffect(() => {
    const checkLoginStatus = async () => {
      try {
        const response = await fetch('/api/auth/check-login', { credentials: 'include' });
        if (response.ok) {
          const data = await response.json();
          // Always store the actual login for isOutgoing checks
          setActualLogin(data.login);

          // Determine which teacher to show - set ONCE, never override mock
          if (MOCK_TEACHER_NAME) {
            // Mock is active - DO NOT touch activeTeacher, it's already set in useState
            console.log(`[LecturerCalendar] Mock active. Keeping: "${MOCK_TEACHER_NAME}". Logged in as: "${data.login}"`);
          } else if (teacher) {
            setActiveTeacher(decodeURIComponent(teacher));
            console.log(`[LecturerCalendar] URL param teacher: "${decodeURIComponent(teacher)}"`);
          } else {
            const fullName = `${data.surname} ${data.givenName}`;
            setActiveTeacher(fullName);
            console.log(`[LecturerCalendar] Using logged-in user: "${fullName}"`);
          }
        } else {
          // Not logged in
          if (MOCK_TEACHER_NAME) {
            setActualLogin("mock_login");
          } else if (teacher) {
            setActiveTeacher(decodeURIComponent(teacher));
          }
        }
      } catch (error) {
        console.error("Auth check failed", error);
        if (MOCK_TEACHER_NAME) setActualLogin("mock_login");
        else if (teacher) setActiveTeacher(decodeURIComponent(teacher));
      }
    };
    checkLoginStatus();
  }, [teacher]); // eslint-disable-line react-hooks/exhaustive-deps


  useEffect(() => {
    if (activeTeacher) document.title = `Kokpit - ${activeTeacher}`;
  }, [activeTeacher]);

  const fetchEvents = async (startDate: string, endDate: string, targetTeacher: string) => {
    console.log(`[LecturerCalendar] fetchEvents Triggered! targetTeacher: "${targetTeacher}", URL param "teacher": "${teacher}"`);
    if (!targetTeacher) {
      console.warn("[LecturerCalendar] fetchEvents ABORTED: No targetTeacher!");
      return;
    }
    const url = `/api/schedule?kind=worker&id=${encodeURIComponent(targetTeacher)}&start=${startDate}&end=${endDate}`;
    console.log("[LecturerCalendar] Fetching URL:", url);
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch events');
        const data = await response.json();
        console.log(`[LecturerCalendar] Fetched ${data.length} events for ${targetTeacher}`);
        if (data.length > 0) {
            console.log("[LecturerCalendar] First event worker:", data[0].worker_title);
        }
      setEvents(data.map((event: any) => ({
        ...event,
        id: event.id || event.lessonId, // Ensure top-level ID for FullCalendar
        extendedProps: { 
          id: event.id || event.lessonId, 
          login: event.login, 
          room: event.room, 
          group_name: event.group_name, 
          worker_title: event.worker_title, 
          lesson_form: event.lesson_form 
        }
      })));
    } catch (error) {
      console.error('Error fetching events:', error);
    }
  };

  // Fetching logic
  useEffect(() => {
    console.log("[LecturerCalendar] useEffect (Fetch) triggered. activeTeacher:", activeTeacher, "dates:", currentDates);
    if (currentDates.start && currentDates.end && activeTeacher) {
      fetchEvents(currentDates.start, currentDates.end, activeTeacher);
    }
    const intervalId = setInterval(() => {
      if (currentDates.start && currentDates.end && activeTeacher) {
        fetchEvents(currentDates.start, currentDates.end, activeTeacher);
      }
    }, 15 * 60 * 1000);
    return () => clearInterval(intervalId);
  }, [activeTeacher, currentDates]);

  // Event interaction
  const handleEventClick = (info: EventClickArg) => {
    const event = info.event;
    setSelectedEventData({
      id: event.id || event.extendedProps.id,
      title: event.title,
      room: event.extendedProps.room,
      worker_title: event.extendedProps.worker_title,
      group_name: event.extendedProps.group_name
    });
    setEditingRoom(false);
    
    const lessonId = event.id || event.extendedProps.id;
    console.log("[LecturerCalendar] Event Clicked! LessonID:", lessonId, "selectedEventData:", event.extendedProps);
    if (lessonId) {
      fetchMessages(lessonId)
        .then(setMessages)
        .catch(console.error);
    }
    setIsSidebarOpen(true);
  };

  const closeSidebar = () => {
    setIsSidebarOpen(false);
    setTimeout(() => setSelectedEventData(null), 300); // Wait for transition
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isSidebarOpen) scrollToBottom();
  }, [messages, isSidebarOpen]);

  // Chat
  const handleSendMessage = async () => {
    const lessonId = selectedEventData?.id;
    if (lessonId && newMessage.trim() !== "") {
      const sanitizedMessage = leoProfanity.clean(newMessage);
      const message = {
        body: sanitizedMessage,
        lecturer: selectedEventData?.worker_title || activeTeacher || "Wykładowca",
        login: actualLogin || "Unknown",
        room: selectedEventData?.room || "Unknown",
        lessonId: lessonId,
        group: selectedEventData?.group_name || "Unknown",
        createdAt: new Date(),
      };
      try {
        await createMessage(message);
        const updatedMessages = await fetchMessages(lessonId);
        setMessages(updatedMessages);
        setNewMessage("");
      } catch (error: any) {
        console.error("Error sending message", error);
        alert('Błąd podczas wysyłania wiadomości: ' + error.message);
      }
    }
  };

  const handleDeleteMessage = async (id: number) => {
    try {
      await deleteMessage(id);
      setMessages(prev => prev.filter(msg => msg.id !== id));
    } catch (error) {
      console.error("Error deleting", error);
    }
  };

  // Room Edit & Attendance
  const handleSaveRoom = async () => {
    if (selectedEventData) {
      const oldRoom = selectedEventData.room || "";
      const lessonId = selectedEventData.id;
      const finalRoom = editedRoom.trim();

      if (finalRoom === "" || finalRoom === oldRoom) {
        setEditingRoom(false);
        return;
      }

      const message = {
        body: `Zajęcia przeniesione do sali: ${finalRoom}`,
        lecturer: selectedEventData.worker_title || activeTeacher || "Wykładowca",
        login: actualLogin || "Unknown",
        room: oldRoom, // Stara sala - tam gdzie wisi tablet, otrzyma alert
        lessonId: lessonId,
        group: selectedEventData.group_name || "Unknown",
        createdAt: new Date(),
        // Nowe pola wg Twojego backendu:
        isRoomChange: true,
        newRoom: finalRoom
      };

      try {
        await createMessage(message);
        // Odśwież wiadomości, by pokazać ten wysłany specjalny komunikat
        const updatedMessages = await fetchMessages(lessonId);
        setMessages(updatedMessages);

        // Nadpisz wizualnie salę u prowadzącego, żeby widział że dokonał zmiany
        setEvents(prev => prev.map(e => 
          e.extendedProps?.id === lessonId 
            ? { ...e, extendedProps: { ...e.extendedProps, room: finalRoom } } 
            : e
        ));
        setSelectedEventData((prev: any) => prev ? { ...prev, room: finalRoom } : null);
        setEditingRoom(false);
      } catch (error) {
        console.error("Error sending room change message:", error);
        alert("Błąd: Nie udało się powiadomić sali o przeniesieniu.");
      }
    }
  };

  return (
    <div className="lecturer-plan">
      <div className="lecturer-plan__layout">
        {/* Calendar Wrapper */}
        <div className={`lecturer-plan__calendar ${isSidebarOpen ? 'lecturer-plan__calendar--shrink' : ''}`}>
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
            initialView={calendarView}
            events={events}
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'timeGridWeek,dayGridMonth,listWeek',
            }}
            height="100%"
            locale={plLocale}
            allDaySlot={false}
            datesSet={info => setCurrentDates(prev => {
              if (prev.start === info.startStr && prev.end === info.endStr) return prev; // no change
              return { start: info.startStr, end: info.endStr };
            })}
            eventClick={handleEventClick}
            slotMinTime="07:00:00"
            slotMaxTime="21:00:00"
            eventDidMount={(info) => {
              const isTouch = 'ontouchstart' in window;
              if (!isTouch) {
                tippy(info.el, {
                  content: `${info.event.title} - Sala ${info.event.extendedProps.room}`,
                  placement: 'top',
                  theme: 'light-border'
                });
              }
            }}
          />
        </div>

        {/* Premium Sidebar */}
        <div className={`lecturer-plan__sidebar ${isSidebarOpen ? 'lecturer-plan__sidebar--open' : ''}`}>
          <div className="lecturer-plan__sidebar-header">
            <div>
              <div className="lecturer-plan__sidebar-title">{selectedEventData?.title}</div>
              <div className="text-sm text-gray-500 mt-1">{activeTeacher || selectedEventData?.worker_title}</div>
            </div>
            <button className="lecturer-plan__close-btn" onClick={closeSidebar}><FaTimes /></button>
          </div>

          {selectedEventData && (
            <div className="lecturer-plan__sidebar-content">
              {/* Info Section */}
              <div className="lecturer-plan__details-section">
                <div className="lecturer-plan__section-title">Szczegóły logistyczne</div>
                <div className="lecturer-plan__detail-row">
                  <span className="lecturer-plan__detail-label">Grupa</span>
                  <span className="lecturer-plan__detail-value">{selectedEventData.group_name || "-"}</span>
                </div>
                <div className="lecturer-plan__detail-row">
                  <span className="lecturer-plan__detail-label">Sala</span>
                  <div className="lecturer-plan__detail-value">
                    {!editingRoom ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>{selectedEventData.room || "-"}</span>
                        <button className="lecturer-plan__btn-small lecturer-plan__btn-small--outline" onClick={() => { setEditedRoom(selectedEventData.room || ""); setEditingRoom(true); }}>Edytuj (Komunikat)</button>
                      </div>
                    ) : (
                      <div className="lecturer-plan__edit-room">
                        <input type="text" className="lecturer-plan__edit-input" value={editedRoom} onChange={e => setEditedRoom(e.target.value)} autoFocus />
                        <button className="lecturer-plan__btn-small lecturer-plan__btn-small--success" onClick={handleSaveRoom}>✓</button>
                        <button className="lecturer-plan__btn-small lecturer-plan__btn-small--danger" onClick={() => setEditingRoom(false)}>✕</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Attendance Section */}
              <div className="lecturer-plan__details-section">
                <div className="lecturer-plan__section-title">Otwórz Dziennik Obecności</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                  Moduł kompatybilny z integracją czytników Kantech i przyszłym eksportem dla sytemu USOS.
                </div>
                <button 
                  className="lecturer-plan__btn-small lecturer-plan__btn-small--primary" 
                  style={{ width: '100%', padding: '10px', display: 'flex', justifyContent: 'center' }}
                  onClick={() => {
                    const roomId = selectedEventData.room || "";
                    navigate(`/attendance/${selectedEventData.id}?room=${encodeURIComponent(roomId)}`);
                  }}
                >
                  Zarządzaj Obecnością (Kantech & USOS)
                </button>
              </div>

              {/* Chat Section */}
              <div className="lecturer-plan__details-section" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div className="lecturer-plan__section-title">Komunikacja z Salą</div>
                <div className="lecturer-plan__chat-container">
                  <div className="lecturer-plan__chat-messages">
                    {messages.length === 0 ? (
                      <div className="text-center text-gray-400 text-sm mt-4">Brak wiadomości</div>
                    ) : (
                      messages.map(msg => {
                        const isOutgoing = msg.login === actualLogin || (actualLogin === "mock_login" && msg.lecturer === MOCK_TEACHER_NAME);

                        if (msg.isRoomChange) {
                          return (
                            <div key={msg.id} className="lecturer-plan__message" style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#991b1b', alignSelf: 'center', width: '100%' }}>
                              <div className="lecturer-plan__message-header" style={{ color: '#7f1d1d' }}>
                                <span>⚠️ ZMIANA SALI ⚠️</span>
                                <span className="lecturer-plan__message-time">{new Date(msg.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                              </div>
                              <div style={{ fontWeight: 600 }}>{msg.body}</div>
                              {isOutgoing && (
                                <button className="lecturer-plan__delete-msg" onClick={() => handleDeleteMessage(msg.id)} title="Usuń"><FaTrash /></button>
                              )}
                            </div>
                          );
                        }

                        return (
                          <div key={msg.id} className={`lecturer-plan__message ${isOutgoing ? 'lecturer-plan__message--outgoing' : 'lecturer-plan__message--incoming'}`}>
                            <div className="lecturer-plan__message-header">
                              <span>{msg.lecturer}</span>
                              <span className="lecturer-plan__message-time">{new Date(msg.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                            </div>
                            <div>{msg.body}</div>
                            {isOutgoing && (
                              <button className="lecturer-plan__delete-msg" onClick={() => handleDeleteMessage(msg.id)} title="Usuń"><FaTrash /></button>
                            )}
                          </div>
                        );
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                  <div className="lecturer-plan__chat-input-area">
                    <input 
                      type="text" 
                      className="lecturer-plan__chat-input" 
                      placeholder="Napisz wiadomość..." 
                      value={newMessage}
                      onChange={e => setNewMessage(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                    />
                    <button className="lecturer-plan__chat-send" onClick={handleSendMessage}><FaPaperPlane size={14}/></button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}