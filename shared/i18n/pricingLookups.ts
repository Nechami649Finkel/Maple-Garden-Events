import { T, type TranslationKey } from './keys';
import type { UpgradeKey } from './upgradeKeys';

export const UPGRADE_I18N_KEYS: Record<UpgradeKey, TranslationKey> = {
  baseDesign: T.SETTINGS.UPGRADE_BASE_DESIGN,
  reception: T.SETTINGS.UPGRADE_RECEPTION,
  separateReception: T.SETTINGS.UPGRADE_SEPARATE_RECEPTION,
  lighting: T.SETTINGS.UPGRADE_LIGHTING,
  amplification: T.SETTINGS.UPGRADE_AMPLIFICATION,
  screens: T.SETTINGS.UPGRADE_SCREENS,
  fireworks: T.SETTINGS.UPGRADE_FIREWORKS,
  extraSecurity: T.SETTINGS.UPGRADE_EXTRA_SECURITY,
};

export interface SystemPriceFieldDef {
  field: string;
  labelKey: TranslationKey;
  hintKey?: TranslationKey;
  suffix?: string;
  group: 'system' | 'upgrades';
  required?: boolean;
}

export const SYSTEM_PRICE_FIELD_DEFS: SystemPriceFieldDef[] = [
  { field: 'vatRate', labelKey: T.SETTINGS.FIELD_VAT, suffix: '%', group: 'system', required: true },
  { field: 'basePricePerPortion', labelKey: T.SETTINGS.FIELD_BASE_PORTION, suffix: '₪', group: 'system', required: true },
  {
    field: 'barPortionPrice',
    labelKey: T.SETTINGS.FIELD_BAR_PORTION,
    hintKey: T.SETTINGS.FIELD_BAR_PORTION_HINT,
    suffix: '₪',
    group: 'system',
  },
  { field: 'staffPortionPrice', labelKey: T.SETTINGS.FIELD_STAFF_PORTION, suffix: '₪', group: 'system' },
  { field: 'akumFee', labelKey: T.SETTINGS.FIELD_AKUM_FEE, suffix: '₪', group: 'system' },
  { field: 'designBasePrice', labelKey: T.SETTINGS.UPGRADE_BASE_DESIGN, suffix: '₪', group: 'upgrades' },
  { field: 'receptionPrice', labelKey: T.SETTINGS.UPGRADE_RECEPTION, suffix: '₪', group: 'upgrades' },
  { field: 'separateReceptionPrice', labelKey: T.SETTINGS.UPGRADE_SEPARATE_RECEPTION, suffix: '₪', group: 'upgrades' },
  { field: 'lightingPrice', labelKey: T.SETTINGS.UPGRADE_LIGHTING, suffix: '₪', group: 'upgrades' },
  { field: 'soundSystemPrice', labelKey: T.SETTINGS.UPGRADE_AMPLIFICATION, suffix: '₪', group: 'upgrades' },
  { field: 'screensPrice', labelKey: T.SETTINGS.UPGRADE_SCREENS, suffix: '₪', group: 'upgrades' },
  { field: 'fireworksPrice', labelKey: T.SETTINGS.UPGRADE_FIREWORKS, suffix: '₪', group: 'upgrades' },
  { field: 'extraSecurityPrice', labelKey: T.SETTINGS.UPGRADE_EXTRA_SECURITY, suffix: '₪', group: 'upgrades' },
];

export const SETTINGS_TO_UPGRADE: Record<UpgradeKey, string> = {
  baseDesign: 'designBasePrice',
  amplification: 'soundSystemPrice',
  lighting: 'lightingPrice',
  screens: 'screensPrice',
  reception: 'receptionPrice',
  separateReception: 'separateReceptionPrice',
  extraSecurity: 'extraSecurityPrice',
  fireworks: 'fireworksPrice',
};

export function getUpgradeLabel(
  translate: (key: TranslationKey) => string,
  key: UpgradeKey,
): string {
  return translate(UPGRADE_I18N_KEYS[key]);
}
