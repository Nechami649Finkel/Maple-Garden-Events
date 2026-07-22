import fs from 'fs';
import path from 'path';
import { createTranslator } from '../vendor/shared/i18n/resolve';
import {
  DEFAULT_LOCALE,
  isLocale,
  type Locale,
  type TranslationParams,
  type TranslationTree,
  type Translator,
} from '../vendor/shared/i18n/types';

let cachedCatalog: Record<Locale, TranslationTree> | null = null;

function loadCatalog(): Record<Locale, TranslationTree> {
  const localesDir = path.join(__dirname, '../vendor/shared/i18n/locales');

  return {
    en: JSON.parse(fs.readFileSync(path.join(localesDir, 'en.json'), 'utf8')) as TranslationTree,
    he: JSON.parse(fs.readFileSync(path.join(localesDir, 'he.json'), 'utf8')) as TranslationTree,
  };
}

function getCatalog(): Record<Locale, TranslationTree> {
  if (!cachedCatalog) {
    cachedCatalog = loadCatalog();
  }
  return cachedCatalog;
}

export function getServerTranslation(locale: Locale = DEFAULT_LOCALE): Translator {
  return createTranslator(locale, getCatalog());
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
export { DEFAULT_LOCALE, isLocale, type Locale, type Translator } from '../vendor/shared/i18n/types';
export { T, TP } from '../vendor/shared/i18n/keys';
export type { PluralKey, TranslationKey } from '../vendor/shared/i18n/keys';
