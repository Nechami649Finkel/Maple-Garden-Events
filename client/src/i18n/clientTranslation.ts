import { getTranslator, T, type TranslationKey, type TranslationParams } from '@shared/i18n';
import { loadStoredLocale } from './languageStorage';

export { T };

export function tClient(key: TranslationKey, params?: TranslationParams): string {
  const { t } = getTranslator(loadStoredLocale());
  return t(key, params);
}
