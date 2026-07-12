import { mergePaymentTermsIntoContract } from './paymentTerms';
import {
  UPGRADE_DISPLAY_ORDER,
  UPGRADE_LABELS,
  DEFAULT_UPGRADES_PRICING,
} from './pricing';

export const CONTRACT_ANNEX_PLACEHOLDER = '{{CONTRACT_ANNEX}}';
export const SECTION_DIVIDER = '────────────────────────────────';

export interface ExtrasLineItem {
  label: string;
  price: number;
  paidTo?: 'hall' | 'external';
}

export function renderSelectedExtrasSection(items: ExtrasLineItem[]): string {
  if (items.length === 0) {
    return 'לא נבחרו תוספות או שדרוגים בנוסף לתנאי הבסיס בחוזה.';
  }

  const hallItems = items.filter((item) => item.paidTo !== 'external');
  const externalItems = items.filter((item) => item.paidTo === 'external');

  const lines = items.map((item) => {
    const payNote = item.paidTo === 'external' ? ' (תשלום ישיר לספק חיצוני — לא בחשבון האולם)' : '';
    return `• ${item.label} — ₪${Math.round(item.price).toLocaleString('he-IL')}${payNote}`;
  });

  const hallTotal = hallItems.reduce((sum, item) => sum + item.price, 0);
  const externalTotal = externalItems.reduce((sum, item) => sum + item.price, 0);

  lines.push('────────────────');
  if (hallTotal > 0) {
    lines.push(`סה"כ תוספות לאולם: ₪${Math.round(hallTotal).toLocaleString('he-IL')}`);
  }
  if (externalTotal > 0) {
    lines.push(
      `ספקים חיצוניים (לידיעה בלבד, לא בחשבון האולם): ₪${Math.round(externalTotal).toLocaleString('he-IL')}`,
    );
  }

  return lines.join('\n');
}

export function renderMenuNotesSection(notes: string[]): string {
  const filtered = notes.map((n) => n.trim()).filter(Boolean);
  if (filtered.length === 0) {
    return 'לא נרשמו הערות מיוחדות לתפריט.';
  }
  return filtered.map((note) => `• ${note}`).join('\n');
}

export function buildContractAnnex(options: {
  paymentTerms: string;
  extras: ExtrasLineItem[];
  menuNotes: string[];
}): string {
  return [
    SECTION_DIVIDER,
    'נספח ההזמנה — פירוט לאירוע זה',
    SECTION_DIVIDER,
    '',
    '▌ תנאי תשלום',
    options.paymentTerms.trim() || 'לא הוגדרו תנאי תשלום.',
    '',
    '▌ תוספות ושדרוגים שנבחרו',
    renderSelectedExtrasSection(options.extras),
    '',
    '▌ הערות והנחיות מיוחדות לתפריט',
    renderMenuNotesSection(options.menuNotes),
    SECTION_DIVIDER,
  ].join('\n');
}

export function mergeContractAnnexIntoBase(baseContract: string, annex: string): string {
  if (baseContract.includes(CONTRACT_ANNEX_PLACEHOLDER)) {
    return baseContract.replace(CONTRACT_ANNEX_PLACEHOLDER, annex);
  }

  const marker = 'הנהלת מייפל אירועים מאחלת';
  if (baseContract.includes(marker)) {
    return baseContract.replace(marker, `${annex}\n\n${marker}`);
  }

  return `${baseContract.trim()}\n\n${annex}`;
}

export function resolveFullContractText(options: {
  baseContract: string;
  paymentTerms: string;
  extras?: ExtrasLineItem[];
  menuNotes?: string[];
}): string {
  const annex = buildContractAnnex({
    paymentTerms: options.paymentTerms,
    extras: options.extras ?? [],
    menuNotes: options.menuNotes ?? [],
  });
  const withAnnex = mergeContractAnnexIntoBase(options.baseContract, annex);
  return mergePaymentTermsIntoContract(withAnnex, options.paymentTerms);
}

const EXTERNAL_UPGRADE_KEYS = new Set([
  'baseDesign',
  'lighting',
  'amplification',
  'screens',
  'fireworks',
]);

const KOSHER_PRICING: Record<string, { label: string; extra: number }> = {
  machpud: { label: 'הרב מחפוד', extra: 0 },
  rubin: { label: 'הרב רובין', extra: 10 },
  kehilot: { label: 'קהילות', extra: 10 },
  gross: { label: 'הרב גרוס', extra: 10 },
  landa: { label: 'הרב לנדא', extra: 20 },
  badatz: { label: 'בד"ץ העדה החרדית', extra: 20 },
};

export function buildExtrasLineItems(options: {
  upgrades?: Record<string, boolean> | null;
  kosherType?: string | null;
  guestCount?: number;
  isHallOnly?: boolean;
  isFoodRelevant?: boolean;
  upgradesPricing?: Record<string, number>;
}): ExtrasLineItem[] {
  const upgrades = options.upgrades ?? {};
  const kosherType = options.kosherType || 'machpud';
  const guestCount = Number(options.guestCount) || 0;
  const isHallOnly = !!options.isHallOnly;
  const isFoodRelevant = options.isFoodRelevant ?? !isHallOnly;
  const pricing = options.upgradesPricing ?? DEFAULT_UPGRADES_PRICING;
  const items: ExtrasLineItem[] = [];

  if (isFoodRelevant && guestCount > 0) {
    const kosher = KOSHER_PRICING[kosherType] ?? KOSHER_PRICING.machpud;
    if (kosher.extra > 0) {
      items.push({
        label: `כשרות (${kosher.label}) — ${guestCount} מנות`,
        price: guestCount * kosher.extra,
        paidTo: 'hall',
      });
    }
  }

  for (const key of UPGRADE_DISPLAY_ORDER) {
    if (!upgrades[key]) continue;
    if (isHallOnly && key === 'baseDesign') continue;
    items.push({
      label: UPGRADE_LABELS[key] ?? key,
      price: pricing[key] ?? 0,
      paidTo: EXTERNAL_UPGRADE_KEYS.has(key) ? 'external' : 'hall',
    });
  }

  return items;
}
