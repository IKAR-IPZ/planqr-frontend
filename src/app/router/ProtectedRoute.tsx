import { ReactNode, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { fetchSession, type SessionInfo } from '../services/authService';

type AccessRequirement = 'admin' | 'lecturer';

interface ProtectedRouteProps {
  requirement: AccessRequirement;
  children: ReactNode;
}

const hasRequiredAccess = (session: SessionInfo, requirement: AccessRequirement) => {
  if (requirement === 'admin') {
    return session.access.isAdmin;
  }

  return session.access.canAccessLecturerPlan;
};

export default function ProtectedRoute({ requirement, children }: ProtectedRouteProps) {
  const location = useLocation();
  const [session, setSession] = useState<SessionInfo | null | undefined>(undefined);

  useEffect(() => {
    let isMounted = true;

    const loadSession = async () => {
      const nextSession = await fetchSession();
      if (isMounted) {
        setSession(nextSession);
      }
    };

    void loadSession();

    return () => {
      isMounted = false;
    };
  }, [location.pathname]);

  if (session === undefined) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Trwa weryfikacja dostepu...</div>;
  }

  if (!session) {
    return <Navigate to="/" replace />;
  }

  if (!hasRequiredAccess(session, requirement)) {
    return <Navigate to="/access-denied" replace state={{ reason: requirement }} />;
  }

  return <>{children}</>;
}
