/** Upgrade pricing — source of truth: SystemSettings in DB */

import {
  UPGRADE_I18N_KEYS,
  SYSTEM_PRICE_FIELD_DEFS,
  SETTINGS_TO_UPGRADE,
  type SystemPriceFieldDef,
} from '@shared/i18n/pricingLookups';
import type { TranslationKey } from '@shared/i18n';

export { UPGRADE_I18N_KEYS, SETTINGS_TO_UPGRADE };
export type { SystemPriceFieldDef as SystemPriceField };

export const UPGRADE_DISPLAY_ORDER = [
  'baseDesign',
  'reception',
  'separateReception',
  'lighting',
  'amplification',
  'screens',
  'fireworks',
  'extraSecurity',
] as const;

export type UpgradeKey = (typeof UPGRADE_DISPLAY_ORDER)[number];

export const HALL_UPGRADE_KEYS = ['reception', 'separateReception', 'extraSecurity'] as const;

export const EXTERNAL_UPGRADE_KEYS = [
  'baseDesign',
  'lighting',
  'amplification',
  'screens',
  'fireworks',
] as const;

export const DEFAULT_UPGRADES_PRICING: Record<string, number> = {
  baseDesign: 4500,
  amplification: 1400,
  lighting: 1800,
  screens: 800,
  reception: 2000,
  separateReception: 3000,
  extraSecurity: 650,
  fireworks: 700,
};

export const NON_REMOVABLE_PRICE_FIELDS = new Set(['vatRate', 'basePricePerPortion']);

export const SYSTEM_PRICE_FIELDS = SYSTEM_PRICE_FIELD_DEFS;

export function parseHiddenPriceFields(settings?: Record<string, unknown> | null): string[] {
  const raw = settings?.hiddenPriceFields;
  if (Array.isArray(raw)) {
    return raw.filter((item): item is string => typeof item === 'string');
  }
  return [];
}

export function isPriceFieldHidden(
  settings: Record<string, unknown> | null | undefined,
  field: string,
): boolean {
  return parseHiddenPriceFields(settings).includes(field);
}

export function getVisibleSystemPriceFields(
  settings?: Record<string, unknown> | null,
): SystemPriceFieldDef[] {
  const hidden = new Set(parseHiddenPriceFields(settings));
  return SYSTEM_PRICE_FIELD_DEFS.filter((item) => !hidden.has(item.field));
}

export function getHiddenSystemPriceFields(
  settings?: Record<string, unknown> | null,
): SystemPriceFieldDef[] {
  const hidden = new Set(parseHiddenPriceFields(settings));
  return SYSTEM_PRICE_FIELD_DEFS.filter((item) => hidden.has(item.field));
}

export function filterUpgradeDisplayOrder(
  settings?: Record<string, unknown> | null,
): UpgradeKey[] {
  const hidden = new Set(parseHiddenPriceFields(settings));
  return UPGRADE_DISPLAY_ORDER.filter((key) => !hidden.has(SETTINGS_TO_UPGRADE[key]));
}

export function buildUpgradesPricingFromSettings(
  settings?: Record<string, unknown> | null,
): Record<string, number> {
  const result = { ...DEFAULT_UPGRADES_PRICING };
  if (!settings) return result;

  for (const key of UPGRADE_DISPLAY_ORDER) {
    const settingsField = SETTINGS_TO_UPGRADE[key];
    const raw = settings[settingsField as string];
    const num = Number(raw);
    if (Number.isFinite(num) && num >= 0) {
      result[key] = num;
    }
  }
  return result;
}

export function getSettingNumber(
  settings: Record<string, unknown> | null | undefined,
  field: string,
  fallback: number,
): number {
  const num = Number(settings?.[field]);
  return Number.isFinite(num) ? num : fallback;
}

export function getPriceFieldLabel(
  translate: (key: TranslationKey) => string,
  field: SystemPriceFieldDef,
): string {
  return translate(field.labelKey);
}
