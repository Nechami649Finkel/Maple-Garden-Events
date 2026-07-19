export const SUPPORTED_LOCALES = ['en', 'he'] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'he';

export const LOCALE_STORAGE_KEY = 'maple.locale';

export type TranslationParams = Record<string, string | number>;

export type TranslationTree = {
  [key: string]: string | string[] | TranslationTree | PluralForms;
};

export type PluralForms = {
  zero?: string;
  one?: string;
  two?: string;
  few?: string;
  many?: string;
  other: string;
};

export type Translator = {
  locale: Locale;
  t: (key: string, params?: TranslationParams) => string;
  tp: (key: string, count: number, params?: TranslationParams) => string;
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export function getLocaleDirection(locale: Locale): 'ltr' | 'rtl' {
  return locale === 'he' ? 'rtl' : 'ltr';
}
