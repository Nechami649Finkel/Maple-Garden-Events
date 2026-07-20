import { useCallback, useContext, useMemo } from 'react';
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

  const t = useCallback(
    (key: TranslationKey, params?: TranslationParams) => translate(key, params),
    [translate],
  );
  const tp = useCallback(
    (key: PluralKey, count: number, params?: TranslationParams) =>
      translatePlural(key, count, params),
    [translatePlural],
  );

  return useMemo(
    () => ({ t, tp, locale, setLocale, T, TP }),
    [t, tp, locale, setLocale],
  );
}
