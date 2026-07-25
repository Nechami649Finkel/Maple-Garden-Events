import {
  getTranslator,
  DEFAULT_LOCALE,
  isLocale,
  T,
  TP,
  type Locale,
  type Translator,
  type TranslationParams,
  type TranslationKey,
  type PluralKey,
} from '@maple/shared/i18n';

export function getServerTranslation(locale: Locale = DEFAULT_LOCALE): Translator {
  return getTranslator(locale);
}

export function resolveRequestLocale(
  preferred?: string | null,
  fallback: Locale = DEFAULT_LOCALE,
): Locale {
  if (preferred && isLocale(preferred)) {
    return preferred;
  }

  if (preferred) {
    const base = preferred.split('-')[0];
    if (isLocale(base)) {
      return base;
    }
  }

  return fallback;
}

const TRANSLATION_KEY_PATTERN = /^[A-Z][A-Z0-9_]*(\.[A-Z][A-Z0-9_]*)+$/;

export function isTranslationKey(value: string): boolean {
  return TRANSLATION_KEY_PATTERN.test(value);
}

export function resolveServerMessage(
  locale: Locale,
  messageOrKey: string,
  params?: TranslationParams,
): string {
  if (!isTranslationKey(messageOrKey)) {
    return messageOrKey;
  }
  return getServerTranslation(locale).t(messageOrKey, params);
}

export type ServerError = Error & {
  statusCode?: number;
  i18nParams?: TranslationParams;
};

export function createServerError(
  key: string,
  statusCode: number,
  params?: TranslationParams,
): ServerError {
  const err = new Error(key) as ServerError;
  err.statusCode = statusCode;
  if (params) {
    err.i18nParams = params;
  }
  return err;
}

export { resolveLocaleFromRequest } from './resolveLocale';
export { DEFAULT_LOCALE, isLocale, T, TP };
export type { Locale, Translator, PluralKey, TranslationKey };
