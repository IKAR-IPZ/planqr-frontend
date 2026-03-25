export interface SessionAccess {
  roles: string[];
  isAdmin: boolean;
  isLecturer: boolean | null;
  lecturerStatusResolved: boolean;
  canAccessLecturerPlan: boolean;
  lecturerAccessSource: 'env' | 'role' | 'ldap' | 'unknown';
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

export const getPreferredRoute = (session: SessionInfo | null) => {
  if (!session) {
    return null;
  }

  if (session.access.isAdmin) {
    return '/adminpanel';
  }

  if (session.access.canAccessLecturerPlan) {
    return '/lecturerPlan';
  }

  return null;
};
