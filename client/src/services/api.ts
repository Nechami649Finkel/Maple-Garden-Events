import { API_BASE } from '../config/api';
import { Sentry } from '../config/sentry';
import { disconnectSocket, connectSocket } from './socketService';

const CSRF_COOKIE = 'maple_csrf';
const CSRF_HEADER = 'X-CSRF-Token';

function isMutatingMethod(method?: string): boolean {
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes((method || 'GET').toUpperCase());
}

export function getCsrfToken(): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${CSRF_COOKIE}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

let refreshInFlight: Promise<boolean> | null = null;

export async function refreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    })
      .then((res) => {
        if (res.ok) {
          connectSocket();
        }
        return res.ok;
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

function shouldSkipAuthRedirect(): boolean {
  return import.meta.env.DEV && window.location.pathname.startsWith('/__design__/');
}

export async function secureFetch(url: string, options: RequestInit = {}, retried = false): Promise<Response> {
  const method = (options.method || 'GET').toUpperCase();
  const headers = new Headers(options.headers || {});

  if (isMutatingMethod(method)) {
    const csrf = getCsrfToken();
    if (csrf) {
      headers.set(CSRF_HEADER, csrf);
    }
  }

  try {
    const response = await fetch(url, {
      ...options,
      credentials: 'include',
      headers,
    });

    const isAuthEndpoint =
      url.includes('/api/auth/login') ||
      url.includes('/api/auth/refresh') ||
      url.includes('/api/auth/logout');

    if (response.status === 401 && !retried && !isAuthEndpoint) {
      const refreshed = await refreshSession();
      if (refreshed) {
        return secureFetch(url, options, true);
      }
      if (!url.includes('/api/auth/me') && !shouldSkipAuthRedirect()) {
        window.location.href = '/';
      }
    }

    return response;
  } catch (error) {
    const isNetworkError =
      error instanceof TypeError &&
      (error.message.includes('Failed to fetch') || error.message.includes('NetworkError'));
    if (!isNetworkError || !import.meta.env.DEV) {
      Sentry.captureException(error, { extra: { url, method } });
    }
    if (isNetworkError) {
      throw new Error('לא ניתן להתחבר לשרת — ודאי שהשרת רץ על פורט 5000', {
        cause: error,
      });
    }
    throw error;
  }
}

export const apiFetch = async (url: string, options: RequestInit = {}) => {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const response = await secureFetch(url, { ...options, headers });

  if (response.status >= 500) {
    Sentry.captureMessage(`API error ${response.status}: ${url}`, 'error');
  }

  return response;
};

export async function logoutManager(): Promise<void> {
  disconnectSocket();
  clearUserCache();
  await secureFetch(`${API_BASE}/api/auth/logout`, { method: 'POST' });
}

export type AuthUserInfo = { email: string; name: string; role: string };

const USER_CACHE_KEY = 'maple-user-cache';

function loadUserCache(): AuthUserInfo | null {
  try {
    const raw = sessionStorage.getItem(USER_CACHE_KEY);
    return raw ? (JSON.parse(raw) as AuthUserInfo) : null;
  } catch {
    return null;
  }
}

function saveUserCache(user: AuthUserInfo): void {
  try {
    sessionStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
  } catch {
    // ignore
  }
}

export function clearUserCache(): void {
  sessionStorage.removeItem(USER_CACHE_KEY);
}

export async function getAuthUser(): Promise<AuthUserInfo | null> {
  try {
    let response = await secureFetch(`${API_BASE}/api/auth/me`);
    if (response.status === 401) {
      const refreshed = await refreshSession();
      if (refreshed) {
        response = await secureFetch(`${API_BASE}/api/auth/me`);
      }
    }
    if (!response.ok) return loadUserCache();
    const json = await response.json();
    if (json.user) {
      saveUserCache(json.user);
      return json.user as AuthUserInfo;
    }
    return null;
  } catch {
    return loadUserCache();
  }
}

export async function checkAuthSession(): Promise<boolean> {
  const user = await getAuthUser();
  return user !== null;
}
