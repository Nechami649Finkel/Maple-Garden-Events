import { API_BASE } from '../config/api';
import { Sentry } from '../config/sentry';

export const apiFetch = async (url: string, options: RequestInit = {}) => {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  try {
    const response = await fetch(url, {
      ...options,
      credentials: 'include',
      headers,
    });

    if (response.status === 401) {
      window.location.href = '/';
    }

    if (response.status >= 500) {
      Sentry.captureMessage(`API error ${response.status}: ${url}`, 'error');
    }

    return response;
  } catch (error) {
    Sentry.captureException(error, { extra: { url, method: options.method || 'GET' } });
    throw error;
  }
};

export async function logoutManager(): Promise<void> {
  await fetch(`${API_BASE}/api/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  });
}

export async function checkAuthSession(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/api/auth/me`, { credentials: 'include' });
    return response.ok;
  } catch {
    return false;
  }
}
