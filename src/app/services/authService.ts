export interface SessionAccess {
  roles: string[];
  isAdmin: boolean;
  canAccessLecturerPlan: boolean;
}

export interface SessionInfo {
  login: string;
  displayName: string;
  givenName: string;
  surname: string;
  title: string;
  access: SessionAccess;
}

export const fetchSession = async (): Promise<SessionInfo | null> => {
  try {
    const response = await fetch('/api/auth/check-login', {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Error checking session:', error);
    return null;
  }
};

export const logout = async () => {
  const response = await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Logout failed');
  }
};

export const getLecturerDisplayName = (session: SessionInfo | null) => {
  if (!session) {
    return '';
  }

  return session.displayName || `${session.surname} ${session.givenName}`.trim();
};

export const canOpenLecturerPlan = (session: SessionInfo | null) =>
  Boolean(session?.access.canAccessLecturerPlan && getLecturerDisplayName(session));

export const getPreferredRoute = (session: SessionInfo | null) => {
  if (!session) {
    return null;
  }

  if (canOpenLecturerPlan(session)) {
    return '/lecturerPlan';
  }

  if (session.access.isAdmin) {
    return '/adminpanel';
  }

  return null;
};
