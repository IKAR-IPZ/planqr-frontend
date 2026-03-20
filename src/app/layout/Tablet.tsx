import { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import './Tablet.css';
import { fetchMessages } from '../services/messageService';
import { QRCodeCanvas } from 'qrcode.react';
import { FaUserFriends } from 'react-icons/fa';

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
  notifications: any[];
  color: string;
}

export default function Tablet() {
  const params = useParams<{ room?: string }>();
  const location = useLocation();

  const [roomInfo, setRoomInfo] = useState({ building: "", room: "" });
  
  // States
  const [currentDateTime, setCurrentDateTime] = useState({
    date: '', time: '', dayName: '', dayNumber: 0
  });
  const [scheduleItems, setScheduleItems] = useState<ScheduleEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Time metrics for calendar view
  const calendarStartHour = 7; // Fixed start hour
  const timeSlotsCount = 13; // 7:00 to 19:00

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

        const data = await response.json();
        console.log('[Tablet] Raw API response:', data.length, 'events');

        // Filter out invalid events (ZUT API returns empty first element) and match today's date
        // Use local YYYY-MM-DD comparison to avoid timezone issues
        const todayLocal = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;
        const targetEvents = data.filter((e: any) => {
          if (!e.start || !e.title) return false; // Skip incomplete events
          const eventDate = e.start.split('T')[0]; // Extract YYYY-MM-DD from ISO string
          return eventDate === todayLocal;
        });
        console.log('[Tablet] Today:', todayLocal, '| Matching events:', targetEvents.length);

        const formattedEvents = await Promise.all(
          targetEvents.map(async (event: any) => {
            let messages = [];
            try {
              if (event.id) messages = await fetchMessages(event.id);
            } catch (err) {}
            
            return {
              id: event.id,
              startTime: new Date(event.start).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }),
              endTime: new Date(event.end).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }),
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

        console.log('[Tablet] Formatted events:', formattedEvents.length, formattedEvents);

        setScheduleItems(formattedEvents.sort((a, b) => a.startTime.localeCompare(b.startTime)));
        setIsLoading(false);
      } catch (error) {
        console.error('[Tablet] fetchSchedule ERROR:', error);
        setIsLoading(false);
      }
    };

    if (roomInfo.room) {
      fetchSchedule();
      // TODO: [PROD] Change interval to 60000ms (1 min) or higher for production
      const intervalId = setInterval(fetchSchedule, 2000); // 2s for dev — fast message sync
      return () => clearInterval(intervalId);
    }
  }, [roomInfo]);

  // View Helpers
  const parseTime = (timeStr: string) => {
    const [h, m] = timeStr.split(':').map(Number);
    return h + m / 60;
  };

  const nowVal = new Date().getHours() + new Date().getMinutes() / 60;

  // Check for Room Change Alert
  const roomChangeAlert = useMemo(() => {
     let alertMessage: any = null;
     scheduleItems.forEach(ev => {
        ev.notifications?.forEach(msg => {
           if (msg.isRoomChange) {
              alertMessage = msg;
           }
        });
     });
     return alertMessage;
  }, [scheduleItems]);

  // Aggregate all non-room-change messages from all today's events
  const allMessages = useMemo(() => {
     const msgs: { body: string; lecturer: string; createdAt: string; eventTitle: string }[] = [];
     scheduleItems.forEach(ev => {
        ev.notifications?.forEach(msg => {
           if (!msg.isRoomChange) {
              msgs.push({
                 body: msg.body,
                 lecturer: msg.lecturer || 'Wykładowca',
                 createdAt: msg.createdAt || '',
                 eventTitle: ev.description,
              });
           }
        });
     });
     return msgs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [scheduleItems]);

  // Auto-scroll messages (touch is disabled on tablet)
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = messagesScrollRef.current;
    if (!el || allMessages.length === 0) return;
    let scrollDir = 1;
    let animId: ReturnType<typeof setInterval>;
    let pauseId: ReturnType<typeof setTimeout>;
    const step = () => {
      if (!el) return;
      el.scrollTop += scrollDir;
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 1) {
        scrollDir = -1;
        clearInterval(animId);
        pauseId = setTimeout(() => { animId = setInterval(step, 30); }, 2000);
      } else if (el.scrollTop <= 0) {
        scrollDir = 1;
        clearInterval(animId);
        pauseId = setTimeout(() => { animId = setInterval(step, 30); }, 2000);
      }
    };
    const startId = setTimeout(() => { animId = setInterval(step, 30); }, 2000);
    return () => { clearTimeout(startId); clearTimeout(pauseId); clearInterval(animId); };
  }, [allMessages]);

  // Layout calculations for right panel
  const slotHeight = 120; // 120px per hour
  const getCurrentTimeTop = () => (nowVal - calendarStartHour) * slotHeight;

  if (isLoading) return <div className="fullscreen-msg">Wczytywanie systemu...</div>;

  return (
    <div className="tablet-wrapper">
      
      {/* 🚨 Fullscreen Room Change Alert Overlay 🚨 */}
      {roomChangeAlert && (
          <div className="room-change-overlay">
              <h1>⚠️ Zmiana Sali</h1>
              <h2>Zajęcia zostały przeniesione do: {roomChangeAlert.newRoom}</h2>
              {roomChangeAlert.body && <p>{roomChangeAlert.body}</p>}
          </div>
      )}

      {/* LEFT PANEL */}
      <div className="tablet-left">
         <div className="tablet-clock">
            <div className="tablet-time">{currentDateTime.time.substring(0, 5)}</div>
            <div className="tablet-date">{currentDateTime.date} • {currentDateTime.dayName}</div>
         </div>

         <div className="tablet-room-info">
            <div className="tablet-room-capacity"><FaUserFriends /> Ekran Informacyjny</div>
            <div className="tablet-room-name">Sala {roomInfo.building}-{roomInfo.room}</div>
         </div>

         {/* Messages Section - always visible, auto-scrolling */}
         <div className="tablet-messages-section">
            <div className="tablet-messages-header">📢 Wiadomości od wykładowcy</div>
            {allMessages.length > 0 ? (
               <div className="tablet-messages-list" ref={messagesScrollRef}>
                  {allMessages.map((msg, i) => (
                     <div key={i} className="tablet-message-item">
                        <div className="tablet-message-meta">
                           <span className="tablet-message-lecturer">{msg.lecturer}</span>
                           <span className="tablet-message-event">• {msg.eventTitle}</span>
                        </div>
                        <div className="tablet-message-body">{msg.body}</div>
                        {msg.createdAt && (
                           <div className="tablet-message-time">
                              {new Date(msg.createdAt).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
                           </div>
                        )}
                     </div>
                  ))}
               </div>
            ) : (
               <div className="tablet-message-empty">Brak wiadomości</div>
            )}
         </div>

         {/* QR Code Location */}
         <div className="tablet-qr-section">
            <div className="qr-wrapper">
               <QRCodeCanvas 
                 value={`https://plan.zut.edu.pl/#${encodeURIComponent(roomInfo.room.startsWith(roomInfo.building) ? roomInfo.room : `${roomInfo.building} ${roomInfo.room}`)}&&&&`} 
                 size={110} 
                 fgColor="#0f172a"
               />
            </div>
            <div className="qr-text">
               <h3>Zeskanuj Kod QR</h3>
               <p>Zobacz pełny harmonogram na swoim urządzeniu.</p>
            </div>
         </div>
      </div>

      {/* RIGHT PANEL: TIMELINE */}
      <div className="tablet-right">
         <div className="timeline-container" style={{ transform: `translateY(0)` }}>
            
            {/* Background Grid */}
            {Array.from({ length: timeSlotsCount }).map((_, i) => (
               <div key={i} className="time-slot" style={{ top: i * slotHeight + 'px', position: 'absolute', width: '100%' }}>
                  <div className="time-label">{calendarStartHour + i}:00</div>
                  <div className="time-line"></div>
               </div>
            ))}

            {/* Current Time Line */}
            {nowVal >= calendarStartHour && nowVal <= calendarStartHour + timeSlotsCount && (
               <div className="current-time-line" style={{ top: getCurrentTimeTop() + 'px' }}>
                  <div className="current-time-label">{currentDateTime.time.substring(0, 5)}</div>
                  <div className="current-time-dot"></div>
               </div>
            )}

            {/* Render Events */}
            {scheduleItems.map((ev, i) => {
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
                        top: top + 'px',
                        height: (height - 4) + 'px', // tiny gap
                     }}
                  >
                     <div className="event-title">{ev.description} ({ev.form})</div>
                     <div className="event-time">{ev.startTime} - {ev.endTime}</div>
                     <div className="event-instructor">{ev.instructor} • {ev.group_name}</div>
                     {ev.notifications?.filter(n => !n.isRoomChange).length > 0 && (
                        <div className="event-message-badge">
                           📢 {ev.notifications.filter(n => !n.isRoomChange).length}
                        </div>
                     )}
                  </div>
               );
            })}

         </div>
      </div>
    </div>
  );
}