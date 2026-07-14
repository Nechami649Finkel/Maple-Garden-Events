/** Empty VITE_API_URL = same origin (/api) — Vite proxies to the server in dev. */
export const API_BASE = import.meta.env.VITE_API_URL ?? '';
export const API_URL = API_BASE ? `${API_BASE.replace(/\/$/, '')}/api` : '/api';
