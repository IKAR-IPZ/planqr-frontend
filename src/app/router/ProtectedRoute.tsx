import { ReactNode, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { canOpenLecturerPlan, fetchSession, type SessionInfo } from '../services/authService';

type AccessRequirement = 'admin' | 'lecturer';
type AccessDeniedReason = AccessRequirement;

interface ProtectedRouteProps {
  requirement: AccessRequirement;
  children: ReactNode;
}

const hasRequiredAccess = (session: SessionInfo, requirement: AccessRequirement) => {
  if (requirement === 'admin') {
    return session.access.isAdmin;
  }

  return canOpenLecturerPlan(session);
};

const getAccessDeniedReason = (
  session: SessionInfo,
  requirement: AccessRequirement,
  location: ReturnType<typeof useLocation>,
): AccessDeniedReason | null => {
  if (
    requirement === 'lecturer' &&
    location.pathname === '/lecturerPlan' &&
    new URLSearchParams(location.search).get('mode') === 'admin-preview'
  ) {
    return session.access.isAdmin ? null : 'admin';
  }

  return hasRequiredAccess(session, requirement) ? null : requirement;
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

  const accessDeniedReason = getAccessDeniedReason(session, requirement, location);

  if (accessDeniedReason) {
    return <Navigate to="/access-denied" replace state={{ reason: accessDeniedReason }} />;
  }

  return <>{children}</>;
}
