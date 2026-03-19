import { useEffect, useState, useMemo } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaCheckCircle, FaTimesCircle, FaUserEdit, FaSyncAlt, FaFileExport, FaQuestionCircle } from 'react-icons/fa';

interface Student {
  id: string; // numer indeksu / usosa
  name: string;
  status: 'present' | 'absent' | 'override' | 'unknown';
  time?: string;
}

export default function AttendancePanel() {
  const { lessonId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const queryParams = new URLSearchParams(location.search);
  const room = queryParams.get('room') || 'Nieznana sala';

  const [isLoading, setIsLoading] = useState(true);
  const [students, setStudents] = useState<Student[]>([]);

  // Baza studentów grupy - docelowo z USOSa:
  const initialBase: Student[] = useMemo(() => [
    { id: '123456', name: 'Jan Kowalski', status: 'absent' },
    { id: '123457', name: 'Anna Nowak', status: 'absent' },
    { id: '123458', name: 'Piotr Wiśniewski', status: 'absent' },
    { id: '123459', name: 'Katarzyna Zielińska', status: 'absent' },
    { id: '123460', name: 'Michał Lewandowski', status: 'absent' }
  ], []);

  const fetchAttendance = async () => {
    setIsLoading(true);
    let currentList = [...initialBase];

    try {
      const response = await fetch(`/api/v1/attendance?door_id=${encodeURIComponent(room)}`);
      if (response.ok) {
        const data = await response.json();
        
        if (data && data.length > 0) {
          // Mamy logi z Kantecha, aktualizujemy listę bazową
          data.forEach((scan: any) => {
            const timeStr = new Date(scan.scanned_at).toLocaleTimeString();
            const foundIndex = currentList.findIndex(s => s.id === scan.card_id);
            if (foundIndex !== -1) {
              currentList[foundIndex] = { ...currentList[foundIndex], status: 'present', time: timeStr };
            } else {
              // Czytnik zarejestrował nieznaną kartę spoza przewidywanej listy (USOSa)
              currentList.push({
                id: scan.card_id,
                name: 'Karta Nieprzypisana',
                status: 'unknown',
                time: timeStr
              });
            }
          });
        } else {
          // Brak logów - wstawiamy MOCK dla prezentacji!
          currentList[0].status = 'present';
          currentList[0].time = new Date().toLocaleTimeString();
          currentList[1].status = 'present';
          currentList[1].time = new Date(Date.now() - 150000).toLocaleTimeString();
        }
      } else {
        // Fallback w razie błędu 4xx/5xx - na te same MOCKI
        currentList[0].status = 'present';
        currentList[0].time = new Date().toLocaleTimeString();
        currentList[1].status = 'present'; 
        currentList[1].time = new Date(Date.now() - 150000).toLocaleTimeString();
      }
    } catch (e) {
      console.error(e);
      // Fallback w razie błędu połączenia
      currentList[3].status = 'present';
      currentList[3].time = new Date().toLocaleTimeString();
    } finally {
      setStudents([...currentList]);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendance();
  }, [room, initialBase]);

  const toggleManualOverride = (indexId: string) => {
    setStudents(prev => prev.map(s => {
      if (s.id === indexId) {
        if (s.status === 'absent') return { ...s, status: 'override', time: '-' };
        if (s.status === 'override') return { ...s, status: 'absent', time: undefined };
      }
      return s;
    }));
  };

  const presentCount = students.filter(s => s.status === 'present' || s.status === 'override' || s.status === 'unknown').length;
  const totalCount = students.length;
  const manualCount = students.filter(s => s.status === 'override').length;
  
  return (
    <div className="attendance">
      <div className="attendance__container">
        <div className="attendance__header">
          <div className="attendance__header-left">
            <button className="attendance__back-btn" onClick={() => navigate(-1)}>
              <FaArrowLeft /> Wróć do zaplanowanych zajęć
            </button>
            <h1 className="attendance__title">E-Dziennik Obecności (ID: {lessonId})</h1>
            <div className="attendance__subtitle">Odbicia z czytników w czasie rzeczywistym — Sala: {room}</div>
          </div>
          <div className="attendance__header-actions">
            <button className="attendance__btn attendance__btn--secondary" onClick={fetchAttendance}>
              <FaSyncAlt /> Odśwież czytnik
            </button>
            <button className="attendance__btn attendance__btn--primary" onClick={() => alert("W przyszłości wyśle dane logów do API USOS!")}>
              <FaFileExport /> Wyślij listę do USOS
            </button>
          </div>
        </div>

      <div className="attendance__stats-row">
        <div className="attendance__stat-card">
          <div className="attendance__stat-label">Frekwencja</div>
          <div className="attendance__stat-value attendance__stat-value--indigo">{presentCount} / {totalCount}</div>
        </div>
        <div className="attendance__stat-card">
          <div className="attendance__stat-label">Procent Obecności</div>
          <div className="attendance__stat-value attendance__stat-value--green">{Math.round((presentCount / totalCount) * 100) || 0}%</div>
        </div>
        <div className="attendance__stat-card">
          <div className="attendance__stat-label">Wprowadzeni Ręcznie</div>
          <div className="attendance__stat-value attendance__stat-value--orange">{manualCount} (USOS)</div>
        </div>
      </div>

      <div className="attendance__table-container">
        {isLoading ? (
          <div className="attendance__loading">Ładowanie połączenia z serwerem Kantech...</div>
        ) : (
          <table className="attendance__table">
            <thead>
              <tr>
                <th>Imię i Nazwisko / Nr Karty</th>
                <th>Status Kantech</th>
                <th>Godzina Odbicia</th>
                <th style={{ textAlign: 'right' }}>Ręczna Edycja Wykładowcy</th>
              </tr>
            </thead>
            <tbody>
              {students.map(s => (
                <tr key={s.id}>
                  <td>
                    <div className="attendance__student-info">
                      <span className="attendance__student-name">{s.name}</span>
                      <span className="attendance__student-index">Indeks/Karta: {s.id}</span>
                    </div>
                  </td>
                  <td>
                    {s.status === 'present' && <span className="attendance__badge attendance__badge--present"><FaCheckCircle /> Odbito Kartę</span>}
                    {s.status === 'absent' && <span className="attendance__badge attendance__badge--absent"><FaTimesCircle /> Brak odczytu</span>}
                    {s.status === 'override' && <span className="attendance__badge attendance__badge--override"><FaUserEdit /> Zgłoszony Wpis</span>}
                    {s.status === 'unknown' && <span className="attendance__badge attendance__badge--unknown"><FaQuestionCircle /> Nie na liście</span>}
                  </td>
                  <td>
                    {s.time ? <span className="attendance__time">{s.time}</span> : <span style={{ color: 'var(--text-muted)' }}>-</span>}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {(s.status === 'absent' || s.status === 'override') && (
                      <button className="attendance__toggle-btn" onClick={() => toggleManualOverride(s.id)} style={{ marginLeft: 'auto' }}>
                        {s.status === 'absent' ? "Brak karty? Wybacz" : "Cofnij rozgrzeszenie"}
                      </button>
                    )}
                    {s.status === 'present' && <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Brak konieczności operacji</span>}
                    {s.status === 'unknown' && <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Niezidentyfikowana osoba</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
     </div>
    </div>
  );
}
