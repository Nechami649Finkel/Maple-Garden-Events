import { CATALOG } from './catalog';
import { createTranslator } from './resolve';
import { getBrandI18nParams } from '../brand';
import type { Locale, Translator } from './types';

export function getTranslator(locale: Locale): Translator {
  const base = createTranslator(locale, CATALOG);
  const venueParams = getBrandI18nParams(locale);
  return {
    locale: base.locale,
    t: (key, params) => base.t(key, { ...venueParams, ...params }),
    tp: (key, count, params) => base.tp(key, count, { ...venueParams, ...params }),
  };
}

export { createTranslator, interpolate, pluralize } from './resolve';
export { CATALOG } from './catalog';
export { T, TP } from './keys';
export type { TranslationKey, PluralKey } from './keys';
export * from './bookingLookups';
export * from './navigationLookups';
export * from './statusLookups';
export {
  getUpgradeLabel,
  SYSTEM_PRICE_FIELD_DEFS,
  SETTINGS_TO_UPGRADE,
  UPGRADE_I18N_KEYS as SETTINGS_UPGRADE_I18N_KEYS,
} from './pricingLookups';
export type { SystemPriceFieldDef } from './pricingLookups';
export type { UpgradeKey } from './upgradeKeys';
export * from './formatters';
export {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  SUPPORTED_LOCALES,
  getLocaleDirection,
  isLocale,
} from './types';
export type {
  Locale,
  PluralForms,
  TranslationParams,
  TranslationTree,
  Translator,
} from './types';
