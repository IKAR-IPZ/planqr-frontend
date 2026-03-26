import { Link, useLocation } from 'react-router-dom';

export default function AccessDenied() {
  const location = useLocation();
  const reason = (location.state as { reason?: 'admin' | 'lecturer' } | null)?.reason;

  const message =
    reason === 'admin'
      ? 'To konto nie ma uprawnien do panelu administratora.'
      : 'To konto nie ma uprawnien do panelu dydaktyka.';

  return (
    <div style={{ minHeight: '60vh', display: 'grid', placeItems: 'center', padding: '2rem' }}>
      <div style={{ maxWidth: '32rem', textAlign: 'center' }}>
        <h1 style={{ marginBottom: '1rem' }}>Brak dostepu</h1>
        <p style={{ marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>{message}</p>
        <Link to="/" className="btn btn--primary navbar__btn">
          Wroc do logowania
        </Link>
      </div>
    </div>
  );
}
