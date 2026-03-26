import '../src/app/layout/LoginPanel';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import LoginPanel from '../src/app/layout/LoginPanel';
import { useEffect } from 'react';
import { logout } from '../src/app/services/authService';



function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const shouldManageInactivityLogout =
    location.pathname.startsWith('/lecturerPlan') ||
    location.pathname.startsWith('/adminpanel') ||
    location.pathname.startsWith('/attendance');

  useEffect(() => {
    if (!shouldManageInactivityLogout) {
      return;
    }

    let timeoutId: number;

    const resetTimeout = () => {
      clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        handleLogout();
      }, 60 * 60 * 1000); // 60 minut
    };

    const handleLogout = async () => {
      try {
        await logout();
        navigate("/");
      } catch (error) {
        console.error("Error during logout:", error);
        alert("An error occurred during logout. Please try again.");
      }
    };

    window.addEventListener("mousemove", resetTimeout);
    window.addEventListener("keydown", resetTimeout);

    resetTimeout();

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener("mousemove", resetTimeout);
      window.removeEventListener("keydown", resetTimeout);
    };
  }, [navigate, shouldManageInactivityLogout]);

  return (
    <>
      {location.pathname === '/' ? <LoginPanel /> : (<Outlet />)}
    </>
  );
}

export default App;
