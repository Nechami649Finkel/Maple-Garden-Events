import {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  getLocaleDirection,
  isLocale,
  type Locale,
} from '@shared/i18n';

export function loadStoredLocale(): Locale {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (isLocale(stored)) return stored;
  } catch {
    // localStorage may be unavailable (private mode, blocked storage)
  }
  return DEFAULT_LOCALE;
}

export function applyDocumentLocale(locale: Locale): void {
  document.documentElement.lang = locale;
  document.documentElement.dir = getLocaleDirection(locale);
}

export function saveLocale(locale: Locale): void {
  localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  document.cookie = `${LOCALE_STORAGE_KEY}=${locale};path=/;max-age=31536000;SameSite=Lax`;
  applyDocumentLocale(locale);
}

export function initDocumentLocale(): void {
  applyDocumentLocale(loadStoredLocale());
}
