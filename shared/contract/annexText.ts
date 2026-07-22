import {
  ANNEX_TITLE,
  AVAILABLE_UPGRADES_INTRO,
  SECTION_DIVIDER,
} from './constants';
import type { ExtrasLineItem } from './types';

export function formatMoneyLine(amount: number): string {
  return `₪${Math.round(amount).toLocaleString('he-IL')}`;
}

export function paymentNoteText(paidTo?: ExtrasLineItem['paidTo']): string {
  return paidTo === 'external' ? 'תשלום ישיר לספק חיצוני' : 'דרך גן מייפל אירועים';
}

export function renderSelectedExtrasSection(items: ExtrasLineItem[]): string {
  if (items.length === 0) {
    return 'לא נבחרו תוספות או שדרוגים בנוסף לתנאי הבסיס בחוזה.';
  }

  const lines = items.map((item) => {
    const payNote = item.paidTo === 'external' ? ' (תשלום ישיר לספק חיצוני)' : '';
    return `• ${item.label} — ${formatMoneyLine(item.price)}${payNote}`;
  });
  const total = items.reduce((sum, item) => sum + item.price, 0);
  lines.push('────────────────');
  lines.push(`סה"כ תוספות: ${formatMoneyLine(total)}`);
  return lines.join('\n');
}

export function renderAvailableExtrasSection(items: ExtrasLineItem[]): string {
  if (items.length === 0) {
    return 'כל שירותי השדרוג הזמינים נכללו בהזמנה.';
  }

  return items
    .map((item) => {
      const payNote = item.paidTo === 'external' ? ' (תשלום ישיר לספק חיצוני)' : '';
      return `• ${item.label} — ${formatMoneyLine(item.price)}${payNote}`;
    })
    .join('\n');
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
  selectedExtras: ExtrasLineItem[];
  availableExtras: ExtrasLineItem[];
  menuNotes: string[];
}): string {
  return [
    SECTION_DIVIDER,
    ANNEX_TITLE,
    SECTION_DIVIDER,
    '',
    '▌ תנאי תשלום',
    options.paymentTerms.trim() || 'לא הוגדרו תנאי תשלום.',
    '',
    '▌ תוספות ושדרוגים שנבחרו',
    renderSelectedExtrasSection(options.selectedExtras),
    '',
    '▌ אפשרויות לשדרוג נוסף',
    AVAILABLE_UPGRADES_INTRO,
    renderAvailableExtrasSection(options.availableExtras),
    '',
    '▌ הערות והנחיות מיוחדות לתפריט',
    renderMenuNotesSection(options.menuNotes),
    SECTION_DIVIDER,
  ].join('\n');
}

const ANNEX_UPGRADE_SECTION_HEADERS = [
  '▌ תוספות ושדרוגים שנבחרו',
  '▌ אפשרויות לשדרוג נוסף',
] as const;

/** Removes upgrade table sections from contract annex text (PDF renders them as HTML tables). */
export function stripAnnexUpgradeSections(contractText: string): string {
  let text = contractText;
  for (const header of ANNEX_UPGRADE_SECTION_HEADERS) {
    const start = text.indexOf(header);
    if (start === -1) continue;

    const afterHeader = start + header.length;
    const nextSection = text.indexOf('\n▌ ', afterHeader);
    const end = nextSection === -1 ? text.length : nextSection;

    let removeStart = start;
    if (removeStart > 0 && text[removeStart - 1] === '\n') {
      removeStart -= 1;
    }

    text = text.slice(0, removeStart) + text.slice(end);
  }

  return text.replace(/\n{3,}/g, '\n\n').trim();
}

export function mergeContractAnnexIntoBase(baseContract: string, annex: string): string {
  if (baseContract.includes('{{CONTRACT_ANNEX}}')) {
    return baseContract.replace('{{CONTRACT_ANNEX}}', annex);
  }

  const marker = 'הנהלת מייפל אירועים מאחלת';
  if (baseContract.includes(marker)) {
    return baseContract.replace(marker, `${annex}\n\n${marker}`);
  }

  return `${baseContract.trim()}\n\n${annex}`;
}
