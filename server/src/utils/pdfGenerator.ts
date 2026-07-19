// puppeteer v24+ is ESM-only, use dynamic import in CommonJS project
import fs from 'fs';
import path from 'path';
import { format } from 'date-fns';
import { he, enUS } from 'date-fns/locale';
import { formatContractTextForHtml } from './defaultContractText';
import { getContractText } from './getContractText';
import { type TimeSlot } from './timeSlot';
import {
  buildAvailableLineItems,
  buildSelectedLineItems,
  resolveEffectiveUpgrades,
  stripAnnexUpgradeSections,
} from './contractSections';
import { renderUpgradesSectionsHtml } from './contract/upgradeTablesHtml';
import { DEFAULT_UPGRADES_PRICING } from './pricing';
import { HALL_ONLY_EVENT_TYPE } from '../validators/booking.validator';
import { logger } from './logger';
import {
  DEFAULT_LOCALE,
  getServerTranslation,
  T,
  type Locale,
  type Translator,
} from '../i18n/getServerTranslation';

type DepositCheckDetails = {
  payee?: string;
  amount?: string;
  amountInWords?: string;
  date?: string;
  checkNumber?: string;
  bank?: string;
  bankCode?: string;
  branch?: string;
  account?: string;
};

export interface EventFormPDFData {
  eventCode?: string;
  isOption?: boolean;
  clientAFullName: string;
  clientAIdNumber: string;
  clientAPhone?: string;
  clientAEmail?: string;
  clientAAddress?: string | null;
  clientBFullName?: string;
  clientBIdNumber?: string;
  clientBPhone?: string;
  clientBEmail?: string;
  clientBAddress?: string | null;
  eventDate: string;
  guestCount: number;
  minimumGuestCount?: number;
  eventType: string;
  timeOfDay?: string;
  clientSignatureUrl?: string | null;
  contractText?: string | null;
  totalPrice?: number;
  basePrice?: number;
  extrasPrice?: number;
  advancePaid?: number;
  hallRentalPrice?: number | null;
  paymentTermsText?: string | null;
  akumApprovalCode?: string | null;
  managerComments?: string | null;
  upgrades?: Record<string, boolean> | null;
  kosherType?: string | null;
  upgradesPricing?: Record<string, number>;
  isHallOnly?: boolean;
  eventForm: {
    eventTime?: string | null;
    receptionType?: string | null;
    finalGuestCount?: number | null;
    seatingType?: string | null;
    menPercent?: number | null;
    womenPercent?: number | null;
    honorTableCount?: number | null;
    tableclothId?: string | null;
    napkinId?: string | null;
    centerpiece?: string | null;
    bridgeChair?: string | null;
    hasLighting?: boolean;
    hasSoundSystem?: boolean;
    hasScreens?: boolean;
    hasFireworks?: boolean;
    entertainersBar?: number | null;
    entertainersSitting?: number | null;
    entertainersMen?: number | null;
    entertainersWomen?: number | null;
    depositCheckUrl?: string | null;
    depositCheckStatus?: boolean;
    depositCheckDetails?: unknown;
    akumCode?: string | null;
    kashrut?: string | null;
    notes?: string | null;
    menuSelections?: unknown;
    tableLayoutImageUrl?: string | null;
  };
}

type BookingForPdf = {
  eventCode: string;
  isOption?: boolean;
  clientAFullName: string;
  clientAIdNumber: string;
  clientAPhone?: string | null;
  clientAEmail?: string | null;
  clientAAddress?: string | null;
  clientBFullName?: string | null;
  clientBIdNumber?: string | null;
  clientBPhone?: string | null;
  clientBEmail?: string | null;
  clientBAddress?: string | null;
  guestCount: number;
  minimumGuestCount?: number | null;
  eventType: string;
  timeOfDay?: string | null;
  clientSignatureUrl?: string | null;
  contractText?: string | null;
  totalPrice?: number;
  basePrice?: number;
  extrasPrice?: number;
  advancePaid?: number;
  hallRentalPrice?: number | null;
  paymentTermsText?: string | null;
  akumApprovalCode?: string | null;
  managerComments?: string | null;
  upgrades?: unknown;
  kosherType?: string | null;
  eventDate?: { date: Date } | null;
  eventForm?: EventFormPDFData['eventForm'] | null;
};

const PHONE_EXTRA_MARKER = ' | נוסף: ';

function dateFnsLocale(locale: Locale) {
  return locale === 'he' ? he : enUS;
}

function intlLocale(locale: Locale) {
  return locale === 'he' ? 'he-IL' : 'en-US';
}

function slotLabel(slot: TimeSlot, t: Translator['t']): string {
  const map: Record<TimeSlot, string> = {
    morning: t(T.BOOKING.TIME_SLOTS.MORNING),
    noon: t(T.BOOKING.TIME_SLOTS.NOON),
    evening: t(T.BOOKING.TIME_SLOTS.EVENING),
  };
  return map[slot];
}

const PDF_STYLES = `
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: Arial, 'Segoe UI', sans-serif; direction: rtl; color: #111; font-size: 12px; line-height: 1.45; position: relative; overflow-wrap: break-word; word-break: normal; hyphens: none; }
  .page-wrap { padding: 0 4px; }
  .contract-body { page-break-inside: auto; }
  .doc-header { display: flex; align-items: center; justify-content: center; margin-bottom: 10px; padding-bottom: 10px; border-bottom: 2px solid #222; }
  .doc-header-text { text-align: center; }
  .doc-header-text h1 { font-size: 22px; font-weight: 700; color: #111; margin-bottom: 2px; }
  .doc-header-text .doc-subtitle { font-size: 13px; color: #333; font-weight: 600; }
  .meta-bar { background: #e8eaed; border: 1px solid #ccc; padding: 6px 12px; font-size: 11px; font-weight: 600; margin-bottom: 14px; text-align: center; }
  .section { margin-bottom: 12px; page-break-inside: avoid; }
  .section-title { background: #e8eaed; border: 1px solid #ccc; border-bottom: none; padding: 5px 10px; font-size: 12px; font-weight: 700; color: #111; }
  table.data-table { width: 100%; border-collapse: collapse; border: 1px solid #ccc; margin-bottom: 0; table-layout: fixed; }
  table.data-table td, table.data-table th { padding: 5px 8px; border: 1px solid #ccc; vertical-align: top; font-size: 11.5px; overflow-wrap: break-word; word-break: normal; }
  table.data-table td.label { width: 28%; font-weight: 700; background: #f5f5f5; color: #222; white-space: nowrap; }
  table.data-table th { background: #f5f5f5; font-weight: 700; text-align: right; }
  table.upgrades-table td.price-cell { width: 18%; white-space: nowrap; }
  table.upgrades-table td.empty-cell { text-align: center; color: #555; font-style: italic; }
  table.upgrades-table tr.total-row td { background: #fafafa; }
  .marketing-intro { border: 1px solid #ccc; border-top: none; padding: 8px 10px; font-size: 11px; line-height: 1.5; text-align: justify; }
  .upgrades-section { page-break-inside: auto; }
  .upgrades-section .upgrades-table tr { page-break-inside: avoid; break-inside: avoid; }
  .contract-section { margin-top: 16px; page-break-inside: auto; }
  .contract-section .section-title { margin-bottom: 0; }
  .contract-box { border: 1px solid #ccc; border-top: none; padding: 12px 14px; font-size: 11px; line-height: 1.55; text-align: justify; overflow-wrap: break-word; word-break: normal; }
  .contract-box .contract-heading { font-weight: 700; margin: 8px 0 4px; }
  .contract-box .contract-para { margin: 0 0 6px; orphans: 3; widows: 3; }
  .contract-box .contract-list { margin: 4px 20px 8px 0; padding: 0; }
  .contract-box .contract-list li { margin-bottom: 4px; orphans: 3; widows: 3; }
  .contract-emphasis { font-weight: 700; text-decoration: underline; }
  .notes-list { padding: 8px 12px 8px 24px; border: 1px solid #ccc; border-top: none; margin: 0; }
  .notes-list li { margin-bottom: 3px; }
  .signature-footer { page-break-before: auto; page-break-inside: avoid; break-inside: avoid; margin-top: 24px; }
  .signature-box { padding: 14px; border: 2px solid #222; page-break-inside: avoid; break-inside: avoid; }
  .signature-text { font-size: 11px; font-weight: 700; text-align: center; margin-bottom: 12px; line-height: 1.5; }
  .signature-img { max-width: 250px; max-height: 100px; display: block; margin: 0 auto; border-bottom: 1px solid #000; padding-bottom: 5px; }
  .signature-name { text-align: center; font-weight: 700; margin-top: 6px; font-size: 13px; }
  .check-img { max-width: 200px; max-height: 120px; margin-top: 8px; border: 1px solid #ccc; display: block; }
  .layout-img { max-width: 100%; max-height: 400px; margin-top: 8px; border: 1px solid #ccc; display: block; }
  .watermark { position: fixed; top: 45%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); font-size: 120px; color: rgba(180, 180, 180, 0.25); font-weight: 700; z-index: -100; white-space: nowrap; pointer-events: none; }
`;

export function splitStoredPhone(combined?: string | null): { primary: string; secondary?: string } {
  if (!combined?.trim()) return { primary: '—' };
  const idx = combined.indexOf(PHONE_EXTRA_MARKER);
  if (idx >= 0) {
    return {
      primary: combined.slice(0, idx).trim() || '—',
      secondary: combined.slice(idx + PHONE_EXTRA_MARKER.length).trim() || undefined,
    };
  }
  return { primary: combined.trim() };
}

export function splitStoredAddress(combined?: string | null): { city?: string; street: string } {
  if (!combined?.trim()) return { street: '—' };
  const commaIdx = combined.indexOf(', ');
  if (commaIdx >= 0) {
    return {
      city: combined.slice(0, commaIdx).trim(),
      street: combined.slice(commaIdx + 2).trim() || '—',
    };
  }
  return { street: combined.trim() };
}

export function formatHebrewDate(dateInput: string | Date): string {
  try {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    return new Intl.DateTimeFormat('he-IL-u-ca-hebrew', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date);
  } catch {
    return '';
  }
}

export function formatTimeOfDayDisplay(
  timeOfDay?: string | null,
  locale: Locale = DEFAULT_LOCALE,
): string {
  const { t } = getServerTranslation(locale);
  const dash = '—';
  if (!timeOfDay?.trim()) return dash;
  const raw = timeOfDay.trim();
  if (raw.includes('|')) {
    const [slotPart, timesPart] = raw.split('|').map((p) => p.trim());
    const slotKey = slotPart.toLowerCase() as TimeSlot;
    const label = ['morning', 'noon', 'evening'].includes(slotKey)
      ? slotLabel(slotKey, t)
      : slotPart;
    return timesPart ? `${label} (${timesPart})` : label;
  }
  const slotKey = raw.toLowerCase() as TimeSlot;
  return ['morning', 'noon', 'evening'].includes(slotKey) ? slotLabel(slotKey, t) : raw;
}

export function buildBookingPdfData(
  booking: BookingForPdf,
  overrides?: Partial<EventFormPDFData>,
): EventFormPDFData {
  return {
    eventCode: booking.eventCode,
    isOption: booking.isOption,
    clientAFullName: booking.clientAFullName,
    clientAIdNumber: booking.clientAIdNumber,
    clientAPhone: booking.clientAPhone || undefined,
    clientAEmail: booking.clientAEmail || undefined,
    clientAAddress: booking.clientAAddress,
    clientBFullName: booking.clientBFullName || undefined,
    clientBIdNumber: booking.clientBIdNumber || undefined,
    clientBPhone: booking.clientBPhone || undefined,
    clientBEmail: booking.clientBEmail || undefined,
    clientBAddress: booking.clientBAddress,
    eventDate: booking.eventDate?.date
      ? booking.eventDate.date.toISOString()
      : new Date().toISOString(),
    guestCount: Number(booking.guestCount || 0),
    minimumGuestCount: booking.minimumGuestCount ?? Number(booking.guestCount || 0),
    eventType: booking.eventType,
    timeOfDay: booking.timeOfDay || undefined,
    clientSignatureUrl: booking.clientSignatureUrl || null,
    contractText: booking.contractText,
    totalPrice: booking.totalPrice,
    basePrice: booking.basePrice,
    extrasPrice: booking.extrasPrice,
    advancePaid: booking.advancePaid,
    hallRentalPrice: booking.hallRentalPrice,
    paymentTermsText: booking.paymentTermsText,
    akumApprovalCode: booking.akumApprovalCode,
    managerComments: booking.managerComments,
    upgrades: resolveEffectiveUpgrades(booking.upgrades, booking.eventForm),
    kosherType: booking.kosherType,
    isHallOnly: booking.eventType === HALL_ONLY_EVENT_TYPE,
    eventForm: booking.eventForm || {},
    ...overrides,
  };
}

const translateReceptionType = (type: string | null | undefined, t: Translator['t']) =>
  ({
    separate: t(T.SERVER.PDF.RECEPTION_SEPARATE),
    mixed: t(T.SERVER.PDF.RECEPTION_MIXED),
  }[type || ''] || t(T.SERVER.COMMON.NOT_SPECIFIED));

const translateSeatingType = (
  type: string | null | undefined,
  men: number | null | undefined,
  women: number | null | undefined,
  t: Translator['t'],
) => {
  const base = ({
    separate: t(T.SERVER.PDF.SEATING_SEPARATE),
    mixed: t(T.SERVER.PDF.SEATING_MIXED),
  }[type || ''] || t(T.SERVER.COMMON.NOT_SPECIFIED));
  if (type === 'separate' && (men || women)) {
    return t(T.SERVER.PDF.SEATING_SPLIT, { base, men: men ?? 0, women: women ?? 0 });
  }
  return base;
};

const translateKashrut = (k: string | null | undefined, t: Translator['t']) => {
  const map: Record<string, string> = {
    bad_reuven: t(T.BOOKING.KOSHER_TYPES.RUBIN),
    machpud: t(T.BOOKING.KOSHER_TYPES.MACHPUD),
    מחפוד: t(T.BOOKING.KOSHER_TYPES.MACHPUD),
    other: t(T.SERVER.COMMON.NOT_SPECIFIED),
    rubin: t(T.BOOKING.KOSHER_TYPES.RUBIN),
    רובין: t(T.BOOKING.KOSHER_TYPES.RUBIN),
    kehilot: t(T.BOOKING.KOSHER_TYPES.KEHILOT),
    gross: t(T.BOOKING.KOSHER_TYPES.GROSS),
    landa: t(T.BOOKING.KOSHER_TYPES.LANDA),
    לנדא: t(T.BOOKING.KOSHER_TYPES.LANDA),
    badatz: t(T.BOOKING.KOSHER_TYPES.BADATZ),
    'בדץ ע"ח': t(T.BOOKING.KOSHER_TYPES.BADATZ),
  };
  return map[k || ''] || k || t(T.SERVER.COMMON.NOT_SPECIFIED);
};

const esc = (value: string) => escapeHtml(value);

const row = (label: string, value: string) =>
  `<tr><td class="label">${esc(label)}</td><td>${value}</td></tr>`;

const formatMoney = (amount: number | null | undefined, locale: Locale) => {
  if (amount == null || Number.isNaN(Number(amount))) return '—';
  return `₪${Math.round(Number(amount)).toLocaleString(intlLocale(locale))}`;
};

const PUPPETEER_ARGS = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'];

let cachedLogoDataUri: string | null = null;

function getLogoDataUri(): string {
  if (cachedLogoDataUri) return cachedLogoDataUri;
  const logoPath = path.join(__dirname, '../../../client/public/logo.svg');
  try {
    const svg = fs.readFileSync(logoPath, 'utf8');
    cachedLogoDataUri = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  } catch {
    cachedLogoDataUri = '';
  }
  return cachedLogoDataUri;
}

async function launchPdfBrowser() {
  const { default: puppeteer } = await import('puppeteer');
  const base: Parameters<typeof puppeteer.launch>[0] = {
    headless: true,
    args: PUPPETEER_ARGS,
  };

  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return puppeteer.launch({ ...base, executablePath: process.env.PUPPETEER_EXECUTABLE_PATH });
  }

  try {
    return await puppeteer.launch({ ...base, channel: 'chrome' });
  } catch {
    return puppeteer.launch(base);
  }
}

function renderClientBlock(
  sideLabel: string,
  name: string,
  idNumber: string,
  t: Translator['t'],
  phone?: string | null,
  email?: string | null,
  address?: string | null,
): string {
  const phoneParts = splitStoredPhone(phone);
  const addrParts = splitStoredAddress(address);
  const phoneLine = phoneParts.secondary
    ? `${t(T.SERVER.PDF.PHONE)} ${esc(phoneParts.primary)} | ${t(T.SERVER.PDF.PHONE_EXTRA)} ${esc(phoneParts.secondary)}`
    : `${t(T.SERVER.PDF.PHONE)} ${esc(phoneParts.primary)}`;
  const addrLine = addrParts.city
    ? `${t(T.SERVER.PDF.CITY)} ${esc(addrParts.city)} | ${t(T.SERVER.PDF.ADDRESS)} ${esc(addrParts.street)}`
    : addrParts.street !== '—'
      ? `${t(T.SERVER.PDF.ADDRESS)} ${esc(addrParts.street)}`
      : '';

  return [
    row(sideLabel, `<strong>${esc(name)}</strong> | ${t(T.SERVER.PDF.ID_NUMBER)} ${esc(idNumber || '—')}`),
    row(t(T.SERVER.PDF.CONTACT_DETAILS), `${phoneLine}<br/>${t(T.SERVER.PDF.EMAIL)} ${esc(email || '—')}${addrLine ? `<br/>${addrLine}` : ''}`),
  ].join('');
}

function docHeader(subtitle: string, t: Translator['t']): string {
  return `
  <header class="doc-header">
    <div class="doc-header-text">
      <h1>${esc(t(T.SERVER.PDF.VENUE_NAME))}</h1>
      <div class="doc-subtitle">${esc(subtitle)}</div>
    </div>
  </header>`;
}

function watermarkHtml(isOption: boolean | undefined, t: Translator['t']): string {
  return isOption ? `<div class="watermark">${esc(t(T.SERVER.PDF.DRAFT_WATERMARK))}</div>` : '';
}

function signatureFooter(data: EventFormPDFData, t: Translator['t']): string {
  if (!data.clientSignatureUrl) return '';
  return `
  <div class="signature-footer">
    <div class="signature-box">
      <p class="signature-text">${esc(t(T.SERVER.PDF.SIGNATURE_TEXT))}</p>
      <img class="signature-img" src="${data.clientSignatureUrl}" alt="${esc(t(T.SERVER.PDF.SIGNATURE_ALT))}" />
      <p class="signature-name">${t(T.SERVER.PDF.SIGNED_BY)} ${esc(data.clientAFullName)}</p>
    </div>
  </div>`;
}

function parseEventFormNotes(notes?: string | null): string[] {
  try {
    return notes ? JSON.parse(notes) : [];
  } catch {
    return [];
  }
}

function parseMenuRows(menuSelections: unknown, t: Translator['t']): string {
  try {
    let parsedMenu: Record<string, string[]> = {};
    if (typeof menuSelections === 'string' && menuSelections.trim() !== '') {
      parsedMenu = JSON.parse(menuSelections);
    } else if (menuSelections && typeof menuSelections === 'object') {
      parsedMenu = menuSelections as Record<string, string[]>;
    }
    return Object.keys(parsedMenu).map((category) => {
      const items = parsedMenu[category];
      const itemsList = Array.isArray(items) && items.length > 0 ? items.join(', ') : t(T.SERVER.PDF.NO_MENU_ITEMS);
      return row(category, esc(itemsList));
    }).join('');
  } catch (err) {
    logger.error('שגיאה בפענוח התפריט ל-PDF', { error: err });
    return '';
  }
}

function buildEventFormSummaries(f: EventFormPDFData['eventForm'], t: Translator['t']) {
  const equipment = [
    f.hasLighting && t(T.SERVER.PDF.EQUIPMENT_LIGHTING),
    f.hasSoundSystem && t(T.SERVER.PDF.EQUIPMENT_SOUND),
    f.hasScreens && t(T.SERVER.PDF.EQUIPMENT_SCREENS),
    f.hasFireworks && t(T.SERVER.PDF.EQUIPMENT_FIREWORKS),
  ].filter(Boolean).join(', ') || t(T.SERVER.COMMON.NOT_SPECIFIED);

  const designSummary = [
    f.tableclothId && t(T.SERVER.PDF.DESIGN_TABLECLOTH, { value: f.tableclothId }),
    f.napkinId && t(T.SERVER.PDF.DESIGN_NAPKIN, { value: f.napkinId }),
    f.centerpiece && t(T.SERVER.PDF.DESIGN_CENTERPIECE, { value: f.centerpiece }),
    f.bridgeChair && t(T.SERVER.PDF.DESIGN_BRIDGE_CHAIR, { value: f.bridgeChair }),
  ].filter(Boolean).join(', ') || '—';

  let entertainersSummary = '—';
  if (f.entertainersBar || f.entertainersSitting) {
    const parts: string[] = [];
    if (f.entertainersBar) {
      parts.push(
        t(T.SERVER.PDF.ENTERTAINERS_BAR, {
          count: f.entertainersBar,
          men: f.entertainersMen || 0,
          women: f.entertainersWomen || 0,
        }),
      );
    }
    if (f.entertainersSitting) {
      parts.push(t(T.SERVER.PDF.ENTERTAINERS_SITTING, { count: f.entertainersSitting }));
    }
    entertainersSummary = parts.join(' | ');
  }

  return { equipment, designSummary, entertainersSummary };
}

async function buildContractPdfHtml(
  data: EventFormPDFData,
  locale: Locale = DEFAULT_LOCALE,
): Promise<string> {
  const { t } = getServerTranslation(locale);
  const dfLocale = dateFnsLocale(locale);
  const formattedDate = format(new Date(data.eventDate), 'd MMMM yyyy', { locale: dfLocale });
  const hebrewDate = locale === 'he' ? formatHebrewDate(data.eventDate) : '';
  const contractText = data.contractText?.trim() || await getContractText();
  const contractHtml = formatContractTextForHtml(stripAnnexUpgradeSections(contractText));
  const producedDate = format(new Date(), 'd.M.yyyy', { locale: dfLocale });
  const notSpecified = t(T.SERVER.COMMON.NOT_SPECIFIED);

  const balanceDue = (data.totalPrice ?? 0) - (data.advancePaid ?? 0);
  const showPaymentTerms =
    data.paymentTermsText?.trim()
    && !contractText.includes(data.paymentTermsText.trim());

  const isHallOnly = data.isHallOnly ?? data.eventType === HALL_ONLY_EVENT_TYPE;
  const lineItemOptions = {
    upgrades: data.upgrades ?? {},
    kosherType: data.kosherType || 'machpud',
    guestCount: data.guestCount,
    isHallOnly,
    isFoodRelevant: !isHallOnly,
    upgradesPricing: data.upgradesPricing ?? DEFAULT_UPGRADES_PRICING,
  };
  const selectedExtras = buildSelectedLineItems(lineItemOptions);
  const availableExtras = buildAvailableLineItems(lineItemOptions);
  const upgradesHtml = renderUpgradesSectionsHtml({ selectedExtras, availableExtras }, locale);

  return `<!DOCTYPE html>
<html dir="${locale === 'he' ? 'rtl' : 'ltr'}" lang="${locale}">
<head>
<meta charset="UTF-8"/>
<style>${PDF_STYLES}</style>
</head>
<body>
  ${watermarkHtml(data.isOption, t)}
  <div class="page-wrap">
  <div class="contract-body">

  ${docHeader(t(T.SERVER.PDF.CONTRACT_TITLE), t)}
  <div class="meta-bar">${t(T.SERVER.PDF.PRODUCED)} ${esc(producedDate)} | ${t(T.SERVER.PDF.ORDER_CODE)} ${esc(data.eventCode || notSpecified)}</div>

  <div class="section">
    <div class="section-title">${esc(t(T.SERVER.PDF.CLIENTS_AND_EVENT))}</div>
    <table class="data-table">
      ${row(t(T.SERVER.PDF.ORDER_CODE), `<strong>${esc(data.eventCode || '—')}</strong>`)}
      ${renderClientBlock(t(T.SERVER.PDF.CLIENT_SIDE_A), data.clientAFullName, data.clientAIdNumber, t, data.clientAPhone, data.clientAEmail, data.clientAAddress)}
      ${data.clientBFullName ? renderClientBlock(t(T.SERVER.PDF.CLIENT_SIDE_B), data.clientBFullName, data.clientBIdNumber || '', t, data.clientBPhone, data.clientBEmail, data.clientBAddress) : ''}
      ${row(t(T.SERVER.PDF.EVENT_DATE), `${esc(formattedDate)}${hebrewDate ? `<br/>${esc(hebrewDate)}` : ''}`)}
      ${row(t(T.SERVER.PDF.TIME_OF_DAY), esc(formatTimeOfDayDisplay(data.timeOfDay, locale)))}
      ${row(t(T.SERVER.PDF.EVENT_TYPE), esc(data.eventType))}
      ${row(t(T.SERVER.PDF.GUEST_COUNT), esc(String(data.guestCount)))}
      ${row(t(T.SERVER.PDF.MINIMUM_GUESTS), esc(String(data.minimumGuestCount ?? data.guestCount)))}
      ${row(t(T.SERVER.PDF.KASHRUT), esc(translateKashrut(data.kosherType, t)))}
    </table>
  </div>

  <div class="section">
    <div class="section-title">${esc(t(T.SERVER.PDF.FINANCIAL_SUMMARY))}</div>
    <table class="data-table">
      ${data.basePrice != null ? row(t(T.SERVER.PDF.BASE_PRICE), formatMoney(data.basePrice, locale)) : ''}
      ${data.extrasPrice != null && data.extrasPrice > 0 ? row(t(T.SERVER.PDF.EXTRAS), formatMoney(data.extrasPrice, locale)) : ''}
      ${data.hallRentalPrice != null && data.hallRentalPrice > 0 ? row(t(T.SERVER.PDF.HALL_RENTAL), formatMoney(data.hallRentalPrice, locale)) : ''}
      ${data.totalPrice != null ? row(t(T.SERVER.PDF.TOTAL), `<strong>${formatMoney(data.totalPrice, locale)}</strong>`) : ''}
      ${data.advancePaid != null && data.advancePaid > 0 ? row(t(T.SERVER.PDF.ADVANCE_PAID), formatMoney(data.advancePaid, locale)) : ''}
      ${data.totalPrice != null ? row(t(T.SERVER.PDF.BALANCE_DUE), formatMoney(Math.max(0, balanceDue), locale)) : ''}
      ${showPaymentTerms ? row(t(T.SERVER.PDF.PAYMENT_TERMS), esc(data.paymentTermsText!.trim())) : ''}
    </table>
  </div>

  ${upgradesHtml}

  <div class="section contract-section">
    <div class="section-title">${esc(t(T.SERVER.PDF.TERMS_TITLE))}</div>
    <div class="contract-box">${contractHtml}</div>
  </div>

  </div>
  ${signatureFooter(data, t)}
  </div>
</body>
</html>`;
}

function buildEventProductionPdfHtml(
  data: EventFormPDFData,
  locale: Locale = DEFAULT_LOCALE,
): string {
  const { t } = getServerTranslation(locale);
  const dfLocale = dateFnsLocale(locale);
  const f = data.eventForm;
  const formattedDate = format(new Date(data.eventDate), 'd MMMM yyyy', { locale: dfLocale });
  const hebrewDate = locale === 'he' ? formatHebrewDate(data.eventDate) : '';
  const producedDate = format(new Date(), 'd.M.yyyy', { locale: dfLocale });
  const notSpecified = t(T.SERVER.COMMON.NOT_SPECIFIED);

  const checkDetails = f.depositCheckDetails as DepositCheckDetails | null | undefined;
  const akumCode = f.akumCode || data.akumApprovalCode;
  const { equipment, designSummary, entertainersSummary } = buildEventFormSummaries(f, t);
  const notesList = parseEventFormNotes(f.notes);
  const menuRows = parseMenuRows(f.menuSelections, t);

  return `<!DOCTYPE html>
<html dir="${locale === 'he' ? 'rtl' : 'ltr'}" lang="${locale}">
<head>
<meta charset="UTF-8"/>
<style>${PDF_STYLES}</style>
</head>
<body>
  ${watermarkHtml(data.isOption, t)}
  <div class="page-wrap">
  <div class="contract-body">

  ${docHeader(t(T.SERVER.PDF.EVENT_FORM_TITLE), t)}
  <div class="meta-bar">${t(T.SERVER.PDF.PRODUCED)} ${esc(producedDate)} | ${t(T.SERVER.PDF.ORDER_CODE)} ${esc(data.eventCode || notSpecified)}</div>

  <div class="section">
    <div class="section-title">${esc(t(T.SERVER.PDF.EVENT_DETAILS))}</div>
    <table class="data-table">
      ${row(t(T.SERVER.PDF.ORDER_CODE), `<strong>${esc(data.eventCode || '—')}</strong>`)}
      ${row(t(T.SERVER.PDF.CLIENT_NAME), esc(data.clientAFullName))}
      ${row(t(T.SERVER.PDF.EVENT_DATE), `${esc(formattedDate)}${hebrewDate ? `<br/>${esc(hebrewDate)}` : ''}`)}
      ${row(t(T.SERVER.PDF.EVENT_TYPE), esc(data.eventType))}
      ${row(t(T.SERVER.PDF.TIME_OF_DAY), esc(formatTimeOfDayDisplay(data.timeOfDay, locale)))}
    </table>
  </div>

  <div class="section">
    <div class="section-title">${esc(t(T.SERVER.PDF.LAYOUT_AND_DESIGN))}</div>
    <table class="data-table">
      ${row(t(T.SERVER.PDF.SEATING_TYPE), esc(translateSeatingType(f.seatingType, f.menPercent, f.womenPercent, t)))}
      ${row(t(T.SERVER.PDF.FINAL_GUESTS), f.finalGuestCount ? esc(String(f.finalGuestCount)) : '—')}
      ${row(t(T.SERVER.PDF.RECEPTION_TIME), esc(f.eventTime || notSpecified))}
      ${row(t(T.SERVER.PDF.RECEPTION_TYPE), esc(translateReceptionType(f.receptionType, t)))}
      ${f.honorTableCount ? row(t(T.SERVER.PDF.HONOR_TABLE), esc(t(T.SERVER.PDF.HONOR_TABLE_PEOPLE, { count: f.honorTableCount }))) : ''}
      ${row(t(T.SERVER.PDF.DESIGN), esc(designSummary))}
      ${row(t(T.SERVER.PDF.EQUIPMENT), esc(equipment))}
      ${row(t(T.SERVER.PDF.ENTERTAINERS), esc(entertainersSummary))}
    </table>
  </div>

  ${menuRows ? `
  <div class="section">
    <div class="section-title">${esc(t(T.SERVER.PDF.MENU_TITLE))}</div>
    <table class="data-table">${menuRows}</table>
  </div>` : ''}

  <div class="section">
    <div class="section-title">${esc(t(T.SERVER.PDF.APPROVALS))}</div>
    <table class="data-table">
      ${row(t(T.SERVER.PDF.DEPOSIT_CHECK), f.depositCheckStatus ? t(T.SERVER.PDF.DEPOSIT_RECEIVED) : t(T.SERVER.PDF.DEPOSIT_PENDING))}
      ${checkDetails?.checkNumber ? row(t(T.SERVER.PDF.CHECK_NUMBER), esc(checkDetails.checkNumber)) : ''}
      ${checkDetails?.bank ? row(t(T.SERVER.PDF.BANK), esc(checkDetails.bank)) : ''}
      ${checkDetails?.branch ? row(t(T.SERVER.PDF.BRANCH), esc(checkDetails.branch)) : ''}
      ${checkDetails?.account ? row(t(T.SERVER.PDF.ACCOUNT), esc(checkDetails.account)) : ''}
      ${checkDetails?.payee ? row(t(T.SERVER.PDF.PAYEE), esc(checkDetails.payee)) : ''}
      ${checkDetails?.amount ? row(t(T.SERVER.PDF.CHECK_AMOUNT), esc(`₪${checkDetails.amount}`)) : ''}
      ${checkDetails?.date ? row(t(T.SERVER.PDF.CHECK_DATE), esc(checkDetails.date)) : ''}
      ${akumCode ? row(t(T.SERVER.PDF.AKUM_CODE), esc(String(akumCode))) : ''}
      ${row(t(T.SERVER.PDF.KASHRUT), esc(translateKashrut(f.kashrut, t)))}
    </table>
    ${f.depositCheckUrl ? `<img class="check-img" src="${f.depositCheckUrl}" alt="${esc(t(T.SERVER.PDF.DEPOSIT_CHECK_ALT))}"/>` : ''}
  </div>

  ${f.tableLayoutImageUrl ? `
  <div class="section">
    <div class="section-title">${esc(t(T.SERVER.PDF.TABLE_LAYOUT))}</div>
    <img class="layout-img" src="${f.tableLayoutImageUrl}" alt="${esc(t(T.SERVER.PDF.TABLE_LAYOUT_ALT))}"/>
  </div>` : ''}

  ${notesList.length > 0 ? `
  <div class="section">
    <div class="section-title">${esc(t(T.SERVER.PDF.EVENT_NOTES))}</div>
    <ol class="notes-list">${notesList.map((n) => `<li>${esc(n)}</li>`).join('')}</ol>
  </div>` : ''}

  ${data.managerComments?.trim() ? `
  <div class="section">
    <div class="section-title">${esc(t(T.SERVER.PDF.MANAGER_NOTES))}</div>
    <table class="data-table">${row(t(T.SERVER.PDF.NOTES), esc(data.managerComments.trim()))}</table>
  </div>` : ''}

  </div>
  </div>
</body>
</html>`;
}

async function renderPdfFromHtml(html: string, locale: Locale = DEFAULT_LOCALE): Promise<Buffer> {
  const { t } = getServerTranslation(locale);
  const logoUri = getLogoDataUri();
  const browser = await launchPdfBrowser();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '22mm', bottom: '18mm', left: '12mm', right: '12mm' },
      displayHeaderFooter: true,
      footerTemplate: `
        <div style="width:100%;font-size:9px;color:#666;text-align:center;font-family:Arial,sans-serif;padding:0 12mm;">
          ${t(T.SERVER.PDF.FOOTER)} <span class="pageNumber"></span> ${t(T.SERVER.PDF.PAGE_OF)} <span class="totalPages"></span>
        </div>`,
      headerTemplate: logoUri
        ? `<div style="width:100%;padding:0 12mm;direction:rtl;font-size:0;">
            <div style="text-align:right;">
              <img src="${logoUri}" style="height:36px;width:auto;" alt="${t(T.SERVER.PDF.VENUE_NAME)}" />
            </div>
          </div>`
        : '<div></div>',
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

/** חוזה התקשרות — לקוח, מחירים, שדרוגים, תנאים וחתימה */
export const generateContractPDF = async (
  data: EventFormPDFData,
  locale: Locale = DEFAULT_LOCALE,
): Promise<Buffer> => {
  const html = await buildContractPdfHtml(data, locale);
  return renderPdfFromHtml(html, locale);
};

/** טופס הפקת אירוע — סידור, תפריט, ציוד, אישורים והערות */
export const generateEventProductionPDF = async (
  data: EventFormPDFData,
  locale: Locale = DEFAULT_LOCALE,
): Promise<Buffer> => {
  const html = buildEventProductionPdfHtml(data, locale);
  return renderPdfFromHtml(html, locale);
};

/** @deprecated use generateEventProductionPDF */
export const generateEventFormPDF = generateEventProductionPDF;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
