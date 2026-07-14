const configured = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

/**
 * In dev, use same-origin /api (Vite proxy) unless VITE_API_URL points at a remote API.
 * Legacy .env values like http://localhost:5000 skip the proxy and fail when the server is down.
 */
function resolveApiBase(): string {
  if (!import.meta.env.DEV) {
    return configured;
  }
  if (!configured) {
    return '';
  }
  if (/^https?:\/\/(localhost|127\.0\.0\.1):5000$/i.test(configured)) {
    return '';
  }
  return configured;
}

export const API_BASE = resolveApiBase();
export const API_URL = API_BASE ? `${API_BASE}/api` : '/api';
