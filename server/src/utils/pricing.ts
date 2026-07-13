export const HALL_UPGRADE_KEYS = ['reception', 'separateReception', 'extraSecurity'] as const;

export const EXTERNAL_UPGRADE_KEYS = new Set<string>([
  'baseDesign',
  'lighting',
  'amplification',
  'screens',
  'fireworks',
]);

/** תוספת מחיר למנה לפי סוג כשרות */
export const KOSHER_PRICING: Record<string, { label: string; extra: number }> = {
  machpud: { label: 'הרב מחפוד', extra: 0 },
  rubin: { label: 'הרב רובין', extra: 10 },
  kehilot: { label: 'קהילות', extra: 10 },
  gross: { label: 'הרב גרוס', extra: 10 },
  landa: { label: 'הרב לנדא', extra: 20 },
  badatz: { label: 'בד"ץ העדה החרדית', extra: 20 },
};

export const UPGRADE_LABELS: Record<string, string> = {
  baseDesign: 'עיצוב בסיסי',
  reception: 'קבלת פנים',
  separateReception: 'קבלת פנים נפרד',
  lighting: 'תאורה',
  amplification: 'הגברה',
  screens: 'מסכים',
  fireworks: 'זיקוקים',
  extraSecurity: 'מאבטח נוסף',
};

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

export function parseHiddenPriceFields(settings?: Record<string, unknown> | null): string[] {
  const raw = settings?.hiddenPriceFields;
  if (Array.isArray(raw)) {
    return raw.filter((item): item is string => typeof item === 'string');
  }
  return [];
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
    const num = Number(settings?.[settingsField]);
    if (Number.isFinite(num) && num >= 0) {
      result[key] = num;
    }
  }
  return result;
}
