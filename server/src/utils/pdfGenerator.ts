// puppeteer v24+ is ESM-only, use dynamic import in CommonJS project
import fs from 'fs';
import path from 'path';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { formatContractTextForHtml } from './defaultContractText';
import { getContractText } from './getContractText';
import { SLOT_LABELS, type TimeSlot } from './timeSlot';
import {
  buildAvailableLineItems,
  buildSelectedLineItems,
  resolveEffectiveUpgrades,
  stripAnnexUpgradeSections,
} from './contractSections';
import { renderUpgradesSectionsHtml } from './contract/upgradeTablesHtml';
import { DEFAULT_UPGRADES_PRICING } from './pricing';
import { HALL_ONLY_EVENT_TYPE } from '../validators/booking.validator';

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

export function formatTimeOfDayDisplay(timeOfDay?: string | null): string {
  if (!timeOfDay?.trim()) return '—';
  const raw = timeOfDay.trim();
  if (raw.includes('|')) {
    const [slotPart, timesPart] = raw.split('|').map((p) => p.trim());
    const slotKey = slotPart.toLowerCase() as TimeSlot;
    const label = SLOT_LABELS[slotKey] || slotPart;
    return timesPart ? `${label} (${timesPart})` : label;
  }
  const slotKey = raw.toLowerCase() as TimeSlot;
  return SLOT_LABELS[slotKey] || raw;
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

const translateReceptionType = (type?: string | null) =>
  ({ separate: 'נפרד', mixed: 'מעורב' }[type || ''] || 'לא צוין');

const translateSeatingType = (type?: string | null, men?: number | null, women?: number | null) => {
  const base = ({ separate: 'נפרד', mixed: 'מעורב' }[type || ''] || 'לא צוין');
  if (type === 'separate' && (men || women)) {
    return `${base} (גברים: ${men ?? 0}, נשים: ${women ?? 0})`;
  }
  return base;
};

const translateKashrut = (k?: string | null) =>
  ({
    bad_reuven: 'בד רובין',
    machpud: 'מחפוד',
    other: 'אחר',
    rubin: 'הרב רובין',
    kehilot: 'קהילות',
    gross: 'הרב גרוס',
    landa: 'הרב לנדא',
    badatz: 'בד"ץ העדה החרדית',
  }[k || ''] || k || 'לא צוין');

const esc = (value: string) => escapeHtml(value);

const row = (label: string, value: string) =>
  `<tr><td class="label">${esc(label)}</td><td>${value}</td></tr>`;

const formatMoney = (amount?: number | null) => {
  if (amount == null || Number.isNaN(Number(amount))) return '—';
  return `₪${Math.round(Number(amount)).toLocaleString('he-IL')}`;
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
  phone?: string | null,
  email?: string | null,
  address?: string | null,
): string {
  const phoneParts = splitStoredPhone(phone);
  const addrParts = splitStoredAddress(address);
  const phoneLine = phoneParts.secondary
    ? `טלפון: ${esc(phoneParts.primary)} | טלפון נוסף: ${esc(phoneParts.secondary)}`
    : `טלפון: ${esc(phoneParts.primary)}`;
  const addrLine = addrParts.city
    ? `עיר: ${esc(addrParts.city)} | כתובת: ${esc(addrParts.street)}`
    : addrParts.street !== '—'
      ? `כתובת: ${esc(addrParts.street)}`
      : '';

  return [
    row(sideLabel, `<strong>${esc(name)}</strong> | ת&quot;ז: ${esc(idNumber || '—')}`),
    row('פרטי קשר', `${phoneLine}<br/>אימייל: ${esc(email || '—')}${addrLine ? `<br/>${addrLine}` : ''}`),
  ].join('');
}

function docHeader(subtitle: string): string {
  return `
  <header class="doc-header">
    <div class="doc-header-text">
      <h1>גן מייפל אירועים</h1>
      <div class="doc-subtitle">${esc(subtitle)}</div>
    </div>
  </header>`;
}

function watermarkHtml(isOption?: boolean): string {
  return isOption ? '<div class="watermark">טיוטה - דוגמא</div>' : '';
}

function signatureFooter(data: EventFormPDFData): string {
  if (!data.clientSignatureUrl) return '';
  return `
  <div class="signature-footer">
    <div class="signature-box">
      <p class="signature-text">
        בחתימתי אני מאשר/ת את נכונות הפרטים המופיעים בחוזה זה. כמו כן, אני מצהיר/ה כי קראתי והבנתי את תנאי ההתקשרות והתקנון של גן אירועים מייפל לעיל, ואני מסכים/ה להם במלואם.
      </p>
      <img class="signature-img" src="${data.clientSignatureUrl}" alt="חתימת הלקוח" />
      <p class="signature-name">נחתם על ידי: ${esc(data.clientAFullName)}</p>
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

function parseMenuRows(menuSelections: unknown): string {
  try {
    let parsedMenu: Record<string, string[]> = {};
    if (typeof menuSelections === 'string' && menuSelections.trim() !== '') {
      parsedMenu = JSON.parse(menuSelections);
    } else if (menuSelections && typeof menuSelections === 'object') {
      parsedMenu = menuSelections as Record<string, string[]>;
    }
    return Object.keys(parsedMenu).map((category) => {
      const items = parsedMenu[category];
      const itemsList = Array.isArray(items) && items.length > 0 ? items.join(', ') : 'לא נבחרו מנות';
      return row(category, esc(itemsList));
    }).join('');
  } catch (err) {
    console.error('שגיאה בפענוח התפריט ל-PDF:', err);
    return '';
  }
}

function buildEventFormSummaries(f: EventFormPDFData['eventForm']) {
  const equipment = [
    f.hasLighting && 'תאורה',
    f.hasSoundSystem && 'הגברה',
    f.hasScreens && 'מסכים',
    f.hasFireworks && 'זיקוקים',
  ].filter(Boolean).join(', ') || 'לא צוין';

  const designSummary = [
    f.tableclothId && `מפות שולחן: ${f.tableclothId}`,
    f.napkinId && `מפיות: ${f.napkinId}`,
    f.centerpiece && `מרכזי שולחן: ${f.centerpiece}`,
    f.bridgeChair && `כסא כלה: ${f.bridgeChair}`,
  ].filter(Boolean).join(', ') || '—';

  let entertainersSummary = '—';
  if (f.entertainersBar || f.entertainersSitting) {
    const parts: string[] = [];
    if (f.entertainersBar) {
      parts.push(`משמחים בר: ${f.entertainersBar} (גברים: ${f.entertainersMen || 0}, נשים: ${f.entertainersWomen || 0})`);
    }
    if (f.entertainersSitting) {
      parts.push(`משמחים ישיבה: ${f.entertainersSitting}`);
    }
    entertainersSummary = parts.join(' | ');
  }

  return { equipment, designSummary, entertainersSummary };
}

async function buildContractPdfHtml(data: EventFormPDFData): Promise<string> {
  const formattedDate = format(new Date(data.eventDate), 'd בMMMM yyyy', { locale: he });
  const hebrewDate = formatHebrewDate(data.eventDate);
  const contractText = data.contractText?.trim() || await getContractText();
  const contractHtml = formatContractTextForHtml(stripAnnexUpgradeSections(contractText));
  const producedDate = format(new Date(), 'd.M.yyyy', { locale: he });

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
  const upgradesHtml = renderUpgradesSectionsHtml({ selectedExtras, availableExtras });

  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
<meta charset="UTF-8"/>
<style>${PDF_STYLES}</style>
</head>
<body>
  ${watermarkHtml(data.isOption)}
  <div class="page-wrap">
  <div class="contract-body">

  ${docHeader('חוזה התקשרות')}
  <div class="meta-bar">הופק: ${esc(producedDate)} | קוד הזמנה: ${esc(data.eventCode || 'לא צוין')}</div>

  <div class="section">
    <div class="section-title">פרטי לקוחות ופרטי אירוע</div>
    <table class="data-table">
      ${row('קוד הזמנה', `<strong>${esc(data.eventCode || '—')}</strong>`)}
      ${renderClientBlock("צד א' (הלקוח)", data.clientAFullName, data.clientAIdNumber, data.clientAPhone, data.clientAEmail, data.clientAAddress)}
      ${data.clientBFullName ? renderClientBlock("צד ב' (הנציג)", data.clientBFullName, data.clientBIdNumber || '', data.clientBPhone, data.clientBEmail, data.clientBAddress) : ''}
      ${row('תאריך אירוע', `${esc(formattedDate)}${hebrewDate ? `<br/>${esc(hebrewDate)}` : ''}`)}
      ${row('זמן ביום', esc(formatTimeOfDayDisplay(data.timeOfDay)))}
      ${row('סוג אירוע', esc(data.eventType))}
      ${row('כמות מנות (בפועל)', esc(String(data.guestCount)))}
      ${row('מינימום מנות', esc(String(data.minimumGuestCount ?? data.guestCount)))}
      ${row('כשרות', esc(translateKashrut(data.kosherType)))}
    </table>
  </div>

  <div class="section">
    <div class="section-title">סיכום פיננסי</div>
    <table class="data-table">
      ${data.basePrice != null ? row('מחיר בסיס', formatMoney(data.basePrice)) : ''}
      ${data.extrasPrice != null && data.extrasPrice > 0 ? row('תוספות', formatMoney(data.extrasPrice)) : ''}
      ${data.hallRentalPrice != null && data.hallRentalPrice > 0 ? row('שכירות אולם', formatMoney(data.hallRentalPrice)) : ''}
      ${data.totalPrice != null ? row('סה&quot;כ להזמנה', `<strong>${formatMoney(data.totalPrice)}</strong>`) : ''}
      ${data.advancePaid != null && data.advancePaid > 0 ? row('מקדמה ששולמה', formatMoney(data.advancePaid)) : ''}
      ${data.totalPrice != null ? row('יתרה לתשלום', formatMoney(Math.max(0, balanceDue))) : ''}
      ${showPaymentTerms ? row('תנאי תשלום', esc(data.paymentTermsText!.trim())) : ''}
    </table>
  </div>

  ${upgradesHtml}

  <div class="section contract-section">
    <div class="section-title">תנאים כלליים להזמנה — גן אירועים מייפל</div>
    <div class="contract-box">${contractHtml}</div>
  </div>

  </div>
  ${signatureFooter(data)}
  </div>
</body>
</html>`;
}

function buildEventProductionPdfHtml(data: EventFormPDFData): string {
  const f = data.eventForm;
  const formattedDate = format(new Date(data.eventDate), 'd בMMMM yyyy', { locale: he });
  const hebrewDate = formatHebrewDate(data.eventDate);
  const producedDate = format(new Date(), 'd.M.yyyy', { locale: he });

  const checkDetails = f.depositCheckDetails as DepositCheckDetails | null | undefined;
  const akumCode = f.akumCode || data.akumApprovalCode;
  const { equipment, designSummary, entertainersSummary } = buildEventFormSummaries(f);
  const notesList = parseEventFormNotes(f.notes);
  const menuRows = parseMenuRows(f.menuSelections);

  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
<meta charset="UTF-8"/>
<style>${PDF_STYLES}</style>
</head>
<body>
  ${watermarkHtml(data.isOption)}
  <div class="page-wrap">
  <div class="contract-body">

  ${docHeader('טופס הפקת אירוע')}
  <div class="meta-bar">הופק: ${esc(producedDate)} | קוד הזמנה: ${esc(data.eventCode || 'לא צוין')}</div>

  <div class="section">
    <div class="section-title">פרטי אירוע</div>
    <table class="data-table">
      ${row('קוד הזמנה', `<strong>${esc(data.eventCode || '—')}</strong>`)}
      ${row('שם הלקוח', esc(data.clientAFullName))}
      ${row('תאריך אירוע', `${esc(formattedDate)}${hebrewDate ? `<br/>${esc(hebrewDate)}` : ''}`)}
      ${row('סוג אירוע', esc(data.eventType))}
      ${row('זמן ביום', esc(formatTimeOfDayDisplay(data.timeOfDay)))}
    </table>
  </div>

  <div class="section">
    <div class="section-title">סידור האירוע ועיצוב</div>
    <table class="data-table">
      ${row('סוג ישיבה', esc(translateSeatingType(f.seatingType, f.menPercent, f.womenPercent)))}
      ${row('מוזמנים סופי', f.finalGuestCount ? esc(String(f.finalGuestCount)) : '—')}
      ${row('שעת קבלת פנים', esc(f.eventTime || 'לא צוין'))}
      ${row('סוג קבלת פנים', esc(translateReceptionType(f.receptionType)))}
      ${f.honorTableCount ? row('שולחן כבוד', esc(`${f.honorTableCount} אנשים`)) : ''}
      ${row('עיצוב', esc(designSummary))}
      ${row('ציוד טכני', esc(equipment))}
      ${row('משמחים ובר', esc(entertainersSummary))}
    </table>
  </div>

  ${menuRows ? `
  <div class="section">
    <div class="section-title">תפריט האירוע (מנות נבחרות)</div>
    <table class="data-table">${menuRows}</table>
  </div>` : ''}

  <div class="section">
    <div class="section-title">אישורים ופרטי הפקה</div>
    <table class="data-table">
      ${row('צ\'ק פיקדון', f.depositCheckStatus ? 'התקבל' : 'טרם התקבל')}
      ${checkDetails?.checkNumber ? row("מספר צ'ק", esc(checkDetails.checkNumber)) : ''}
      ${checkDetails?.bank ? row('בנק', esc(checkDetails.bank)) : ''}
      ${checkDetails?.branch ? row('סניף', esc(checkDetails.branch)) : ''}
      ${checkDetails?.account ? row('חשבון', esc(checkDetails.account)) : ''}
      ${checkDetails?.payee ? row('לפקודת', esc(checkDetails.payee)) : ''}
      ${checkDetails?.amount ? row('סכום צ\'ק', esc(`₪${checkDetails.amount}`)) : ''}
      ${checkDetails?.date ? row('תאריך על הגבי', esc(checkDetails.date)) : ''}
      ${akumCode ? row('קוד אקו&quot;ם', esc(String(akumCode))) : ''}
      ${row('כשרות', esc(translateKashrut(f.kashrut)))}
    </table>
    ${f.depositCheckUrl ? `<img class="check-img" src="${f.depositCheckUrl}" alt="צ'ק פיקדון"/>` : ''}
  </div>

  ${f.tableLayoutImageUrl ? `
  <div class="section">
    <div class="section-title">סידור שולחנות</div>
    <img class="layout-img" src="${f.tableLayoutImageUrl}" alt="סידור שולחנות"/>
  </div>` : ''}

  ${notesList.length > 0 ? `
  <div class="section">
    <div class="section-title">הערות לאירוע</div>
    <ol class="notes-list">${notesList.map((n) => `<li>${esc(n)}</li>`).join('')}</ol>
  </div>` : ''}

  ${data.managerComments?.trim() ? `
  <div class="section">
    <div class="section-title">הערות מנהל</div>
    <table class="data-table">${row('הערות', esc(data.managerComments.trim()))}</table>
  </div>` : ''}

  </div>
  </div>
</body>
</html>`;
}

async function renderPdfFromHtml(html: string): Promise<Buffer> {
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
          גן מייפל אירועים | עמוד <span class="pageNumber"></span> מתוך <span class="totalPages"></span>
        </div>`,
      headerTemplate: logoUri
        ? `<div style="width:100%;padding:0 12mm;direction:rtl;font-size:0;">
            <div style="text-align:right;">
              <img src="${logoUri}" style="height:36px;width:auto;" alt="מייפל" />
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
export const generateContractPDF = async (data: EventFormPDFData): Promise<Buffer> => {
  const html = await buildContractPdfHtml(data);
  return renderPdfFromHtml(html);
};

/** טופס הפקת אירוע — סידור, תפריט, ציוד, אישורים והערות */
export const generateEventProductionPDF = async (data: EventFormPDFData): Promise<Buffer> => {
  const html = buildEventProductionPdfHtml(data);
  return renderPdfFromHtml(html);
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
