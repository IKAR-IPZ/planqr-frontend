import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

type AuthStatus = 'checking' | 'authenticated' | 'unauthenticated';

export default function RequireAuth() {
  const [authStatus, setAuthStatus] = useState<AuthStatus>('checking');
  const location = useLocation();

  useEffect(() => {
    let isMounted = true;

    const checkLoginStatus = async () => {
      try {
        const response = await fetch('/api/auth/check-login', {
          method: 'GET',
          credentials: 'include',
        });

        if (!isMounted) {
          return;
        }

        setAuthStatus(response.ok ? 'authenticated' : 'unauthenticated');
      } catch (error) {
        if (isMounted) {
          setAuthStatus('unauthenticated');
        }
      }
    };

    checkLoginStatus();

    return () => {
      isMounted = false;
    };
  }, []);

  if (authStatus === 'checking') {
    return <div>Sprawdzanie sesji...</div>;
  }

  if (authStatus === 'unauthenticated') {
    return <Navigate to="/" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
