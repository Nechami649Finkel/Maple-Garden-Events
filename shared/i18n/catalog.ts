import type { Locale } from './types';
import type { TranslationTree } from './types';
import en from './locales/en.json';
import he from './locales/he.json';

export const CATALOG: Record<Locale, TranslationTree> = {
  en,
  he,
};
