import { useContext } from 'react';
import {
  T,
  TP,
  type PluralKey,
  type TranslationKey,
  type TranslationParams,
} from '@shared/i18n';
import { I18nContext } from './I18nProvider';

export function useTranslation() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useTranslation must be used within I18nProvider');
  }

  const { t: translate, tp: translatePlural, locale, setLocale } = ctx;

  const t = (key: TranslationKey, params?: TranslationParams) => translate(key, params);
  const tp = (key: PluralKey, count: number, params?: TranslationParams) =>
    translatePlural(key, count, params);

  return { t, tp, locale, setLocale, T, TP };
}
