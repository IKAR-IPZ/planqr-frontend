import { NavLink, useNavigate, useParams, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';

export default function NavBar() {
  const { room, teacher } = useParams();
  const location = useLocation();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const checkLoginStatus = async () => {
      try {
        const response = await fetch('/api/auth/check-login', {
          method: 'GET',
          credentials: 'include',
        });
        setIsLoggedIn(response.ok);
      } catch (error) {
        console.error('Error checking login status:', error);
        setIsLoggedIn(false);
      }
    };
    checkLoginStatus();
  }, []);

  const handleLogout = async () => {
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        setIsLoggedIn(false);
        navigate('/');
      } else {
        alert('Logout failed');
      }
    } catch (error) {
      console.error('Error during logout:', error);
      alert('An error occurred during logout. Please try again.');
    }
  };

  return (
    <header className="navbar">
      <div className="navbar__brand">
        <i className="fas fa-calendar-alt navbar__icon"></i>
        <div className="navbar__title">
          <span>Plan<span className="navbar__brand-accent">QR</span></span>
          {teacher && !location.pathname.startsWith('/lecturerPlan') && <span className="navbar__subtitle">| {teacher}</span>}
        </div>
      </div>

      <div className="navbar__actions">
        {room ? null : (
          isLoggedIn ? (
            <button onClick={handleLogout} className="btn btn--danger navbar__btn">
              <i className="fas fa-sign-out-alt"></i> Wyloguj
            </button>
          ) : (
            <NavLink to="/" className="btn btn--primary navbar__btn">
              <i className="fas fa-sign-in-alt"></i> Logowanie
            </NavLink>
          )
        )}
      </div>
    </header>
  );
}