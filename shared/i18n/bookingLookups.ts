import { T, type TranslationKey } from './keys';

export type BookingTimeSlot = 'morning' | 'noon' | 'evening';

export const HALL_ONLY_EVENT_TYPE = 'השכרת אולם בלי אוכל';
export const DEFAULT_EVENT_TYPE = 'חתונה';
export const UNSPECIFIED_EVENT_TYPE = 'לא צוין';

export const EVENT_TYPE_VALUES = [
  'חתונה',
  'אירוסין',
  'בר מצווה',
  'בת מצווה',
  'ברית',
  'בריתה',
  'חינה',
  'הרמת כוסית',
  'כנס מקצועי',
  'אירוע חברה/עסקי',
  HALL_ONLY_EVENT_TYPE,
] as const;

export type EventTypeValue = (typeof EVENT_TYPE_VALUES)[number];

export const KASHRUT_KEY_BY_VALUE: Record<string, TranslationKey> = {
  רובין: T.EVENT_FORM.KASHRUT.RUBIN,
  מחפוד: T.EVENT_FORM.KASHRUT.MACHPUD,
  לנדא: T.EVENT_FORM.KASHRUT.LANDA,
  'בדץ קהילות': T.EVENT_FORM.KASHRUT.KEHILOT,
  'הרב גרוס': T.EVENT_FORM.KASHRUT.GROSS,
  'בדץ ע"ח': T.EVENT_FORM.KASHRUT.BADATZ,
};

export const EVENT_TYPE_KEY_BY_VALUE: Record<string, TranslationKey> = {
  חתונה: T.BOOKING.EVENT_TYPES.WEDDING,
  אירוסין: T.BOOKING.EVENT_TYPES.ENGAGEMENT,
  'בר מצווה': T.BOOKING.EVENT_TYPES.BAR_MITZVAH,
  'בת מצווה': T.BOOKING.EVENT_TYPES.BAT_MITZVAH,
  ברית: T.BOOKING.EVENT_TYPES.BRIT,
  בריתה: T.BOOKING.EVENT_TYPES.BRITA,
  חינה: T.BOOKING.EVENT_TYPES.HENNA,
  'הרמת כוסית': T.BOOKING.EVENT_TYPES.TOAST,
  'כנס מקצועי': T.BOOKING.EVENT_TYPES.CONFERENCE,
  'אירוע חברה/עסקי': T.BOOKING.EVENT_TYPES.CORPORATE,
  [HALL_ONLY_EVENT_TYPE]: T.BOOKING.EVENT_TYPES.HALL_RENTAL_ONLY,
};

export const KOSHER_TYPE_KEYS = {
  machpud: T.BOOKING.KOSHER_TYPES.MACHPUD,
  rubin: T.BOOKING.KOSHER_TYPES.RUBIN,
  kehilot: T.BOOKING.KOSHER_TYPES.KEHILOT,
  gross: T.BOOKING.KOSHER_TYPES.GROSS,
  landa: T.BOOKING.KOSHER_TYPES.LANDA,
  badatz: T.BOOKING.KOSHER_TYPES.BADATZ,
} as const satisfies Record<string, TranslationKey>;

export const KOSHER_TYPE_EXTRAS: Record<keyof typeof KOSHER_TYPE_KEYS, number> = {
  machpud: 0,
  rubin: 10,
  kehilot: 10,
  gross: 10,
  landa: 20,
  badatz: 20,
};

export const SERVING_STYLE_KEYS = {
  american: T.BOOKING.SERVING_STYLES.AMERICAN,
  center: T.BOOKING.SERVING_STYLES.CENTER,
  bar: T.BOOKING.SERVING_STYLES.BAR,
} as const satisfies Record<string, TranslationKey>;

export const TIME_SLOT_KEYS: Record<BookingTimeSlot, TranslationKey> = {
  morning: T.BOOKING.TIME_SLOTS.MORNING,
  noon: T.BOOKING.TIME_SLOTS.NOON,
  evening: T.BOOKING.TIME_SLOTS.EVENING,
};

export const UPGRADE_I18N_KEYS = {
  baseDesign: T.BOOKING.UPGRADE_ITEMS.BASE_DESIGN,
  reception: T.BOOKING.UPGRADE_ITEMS.RECEPTION,
  separateReception: T.BOOKING.UPGRADE_ITEMS.SEPARATE_RECEPTION,
  lighting: T.BOOKING.UPGRADE_ITEMS.LIGHTING,
  amplification: T.BOOKING.UPGRADE_ITEMS.AMPLIFICATION,
  screens: T.BOOKING.UPGRADE_ITEMS.SCREENS,
  fireworks: T.BOOKING.UPGRADE_ITEMS.FIREWORKS,
  extraSecurity: T.BOOKING.UPGRADE_ITEMS.EXTRA_SECURITY,
} as const satisfies Record<string, TranslationKey>;

export function translateByValue(
  translate: (key: TranslationKey) => string,
  map: Record<string, TranslationKey>,
  value: string,
): string {
  const key = map[value];
  return key ? translate(key) : value;
}
