export const DEFAULT_EVENT_KASHRUT = 'הרב מחפוד';

/** אפשרויות כשרות לטופס הפקה — עם תארים מלאים + בד"ץ כפי שהיה */
export const EVENT_KASHRUT_OPTIONS = [
  'הרב מחפוד',
  'הרב רובין',
  'הרב גרוס',
  'הרב לנדא',
  'בדץ קהילות',
  'בד"ץ העדה החרדית',
] as const;

/** מיפוי ערכים ישנים מהמערכת → תווית מעודכנת */
const LEGACY_KASHRUT_MAP: Record<string, string> = {
  מחפוד: 'הרב מחפוד',
  רובין: 'הרב רובין',
  לנדא: 'הרב לנדא',
  'בדץ ע"ח': 'בד"ץ העדה החרדית',
  'בדץ העדה החרדית': 'בד"ץ העדה החרדית',
};

export function normalizeKashrutValue(value?: string | null): string {
  const trimmed = (value || '').trim();
  if (!trimmed) return DEFAULT_EVENT_KASHRUT;
  return LEGACY_KASHRUT_MAP[trimmed] || trimmed;
}
