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

export const EXTERNAL_UPGRADE_KEYS = new Set<string>([
  'baseDesign',
  'lighting',
  'amplification',
  'screens',
  'fireworks',
]);

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

export const KOSHER_PRICING: Record<string, { label: string; extra: number }> = {
  machpud: { label: 'הרב מחפוד', extra: 0 },
  rubin: { label: 'הרב רובין', extra: 10 },
  kehilot: { label: 'קהילות', extra: 10 },
  gross: { label: 'הרב גרוס', extra: 10 },
  landa: { label: 'הרב לנדא', extra: 20 },
  badatz: { label: 'בד"ץ העדה החרדית', extra: 20 },
};

export const CONTRACT_ANNEX_PLACEHOLDER = '{{CONTRACT_ANNEX}}';
export const SECTION_DIVIDER = '────────────────────────────────';
export const ANNEX_TITLE = 'נספח ההזמנה — פירוט לאירוע זה';

/** Venue policy floor for billable portions (contracts + manager-approval threshold). */
export const VENUE_MINIMUM_PORTIONS = 300;

export const AVAILABLE_UPGRADES_INTRO =
  'להלן שירותים נוספים הניתנים לשדרוג האירוע. בחירה בהם תחייב את המזמין/ה בתוספת התשלום המפורט, בכפוף לזמינות ולאישור הנהלת גן מייפל אירועים.';
