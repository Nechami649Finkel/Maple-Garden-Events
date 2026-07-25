/**
 * Advance (deposit) receipt issuance via EZCount createDoc API,
 * always mirrored into the BookingPayment ledger.
 */

import prisma from '../../config/prisma';
import { logger } from '../../utils/logger';
import { emitBookingUpdated } from '../../utils/realtime';
import { recordAdvancePayment } from '../bookingPayment.service';
import {
  easyCountFetch,
  getDocumentApiBaseUrl,
  getEasyCountApiKey,
  getEasyCountDeveloperEmail,
  getEasyCountMeta,
  resolveEasyCountMode,
  shouldSendAdvanceReceiptEmail,
  type EasyCountMode,
} from './config';

export type EasyCountIssueResult = {
  status: 'SKIPPED' | 'SIMULATED' | 'ISSUED' | 'FAILED';
  docId: string | null;
  docUrl: string | null;
  simulated: boolean;
  error?: string;
};

export type EasyCountReceiptInput = {
  eventCode: string;
  clientName: string;
  clientIdNumber: string;
  clientEmail?: string | null;
  amount: number;
  depositMethod?: string | null;
  eventType?: string | null;
  vatRate?: number;
  vatType?: string | null;
  eventDate?: Date | null;
};

export type EasyCountBookingResult = {
  issued: boolean;
  status: string | null;
  message: string;
  docId: string | null;
  docUrl: string | null;
};

const DOC_TYPE_INVOICE_RECEIPT = 405;

function formatPaymentDate(date = new Date()): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function mapDepositMethodToPaymentType(depositMethod?: string | null): string {
  if (depositMethod === 'credit_card') return '2';
  if (depositMethod === 'check_upload' || depositMethod === 'check_capture') return '3';
  return '1';
}

function mapVatType(vatType?: string | null): string {
  return vatType === 'not_included' ? 'PRE' : 'INC';
}

function buildItemDescription(input: EasyCountReceiptInput): string {
  const eventLabel = input.eventType?.trim() || 'אירוע';
  const dateLabel = input.eventDate
    ? input.eventDate.toLocaleDateString('he-IL')
    : '';
  const parts = [`מקדמה — ${eventLabel}`, input.eventCode];
  if (dateLabel) parts.push(dateLabel);
  return parts.join(' · ');
}

function parseEasyCountResponse(data: unknown): { docId: string | null; docUrl: string | null } {
  if (!data || typeof data !== 'object') return { docId: null, docUrl: null };
  const record = data as Record<string, unknown>;
  const nested = record.data && typeof record.data === 'object'
    ? (record.data as Record<string, unknown>)
    : record;

  const docId =
    (nested.doc_uuid as string | undefined)
    || (nested.docUuid as string | undefined)
    || (nested.doc_number as string | undefined)
    || (nested.docNumber as string | undefined)
    || (nested.id as string | undefined)
    || null;

  const docUrl =
    (nested.pdf_link as string | undefined)
    || (nested.pdfLink as string | undefined)
    || (nested.pdf_url as string | undefined)
    || (nested.pdfUrl as string | undefined)
    || (nested.url as string | undefined)
    || null;

  return { docId, docUrl };
}

export function formatEasyCountUserMessage(
  result: EasyCountIssueResult,
  mode?: EasyCountMode,
): string {
  const resolvedMode = mode ?? getEasyCountMeta().mode;

  switch (result.status) {
    case 'SIMULATED':
      return 'קבלת מקדמה נרשמה בסימולציה — לא הופק מסמך מס אמיתי.';
    case 'ISSUED':
      return resolvedMode === 'sandbox'
        ? 'קבלת בדיקה הופקה בהצלחה ב-EZCount Sandbox.'
        : 'קבלת המקדמה הופקה בהצלחה ב-EZCount.';
    case 'FAILED':
      return `שגיאה בהפקת קבלה ב-EZCount: ${result.error || 'נסי שוב או פני לתמיכה.'}`;
    case 'SKIPPED':
      return 'הפקת קבלה EZCount דולגה.';
    default:
      return '';
  }
}

export function canIssueEasyCountReceipt(booking: {
  advancePaid?: number | null;
  isOption?: boolean;
  easycountStatus?: string | null;
}): boolean {
  if (booking.isOption) return false;
  if (!booking.advancePaid || booking.advancePaid <= 0) return false;
  return !booking.easycountStatus
    || booking.easycountStatus === 'FAILED'
    || booking.easycountStatus === 'SIMULATED';
}

/** Low-level createDoc call — does not touch the ledger. */
export async function issueAdvanceReceipt(input: EasyCountReceiptInput): Promise<EasyCountIssueResult> {
  const mode = resolveEasyCountMode();
  const amount = Number(input.amount) || 0;

  if (amount <= 0) {
    return { status: 'SKIPPED', docId: null, docUrl: null, simulated: false };
  }

  if (mode === 'off') {
    logger.info('[EZCount] skipped — mode=off', { eventCode: input.eventCode, amount });
    return { status: 'SKIPPED', docId: null, docUrl: null, simulated: false };
  }

  if (mode === 'simulation') {
    const docId = `SIM-${input.eventCode}-${Date.now()}`;
    logger.info('[EZCount] simulation receipt', {
      eventCode: input.eventCode,
      amount,
      docId,
      clientName: input.clientName,
    });
    return {
      status: 'SIMULATED',
      docId,
      docUrl: null,
      simulated: true,
    };
  }

  const apiKey = getEasyCountApiKey();
  const developerEmail = getEasyCountDeveloperEmail();
  if (!apiKey || !developerEmail) {
    return {
      status: 'FAILED',
      docId: null,
      docUrl: null,
      simulated: false,
      error: 'EasyCount credentials missing (EASYCOUNT_API_KEY / EASYCOUNT_DEVELOPER_EMAIL)',
    };
  }

  const vatRate = Number(input.vatRate) || 17;
  const ezVatType = mapVatType(input.vatType);
  const sendEmail =
    mode === 'live'
    && shouldSendAdvanceReceiptEmail()
    && !!input.clientEmail?.trim();

  const payload: Record<string, unknown> = {
    api_key: apiKey,
    developer_email: developerEmail,
    type: DOC_TYPE_INVOICE_RECEIPT,
    customer_name: input.clientName,
    customer_id: input.clientIdNumber,
    customer_email: input.clientEmail || undefined,
    item: [
      {
        details: buildItemDescription(input),
        price: amount,
        amount: 1,
        vat_type: ezVatType,
      },
    ],
    payment: [
      {
        payment_type: mapDepositMethodToPaymentType(input.depositMethod),
        date: formatPaymentDate(),
        payment_sum: String(amount),
      },
    ],
    vat: String(vatRate),
    comment: `מקדמה להזמנה ${input.eventCode} — גן אירועים מייפל`,
    dont_send_email: sendEmail ? 0 : 1,
    send_copy: 0,
    print_type: 'PDF',
  };

  try {
    const response = await easyCountFetch(`${getDocumentApiBaseUrl(mode)}/api/createDoc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const bodyText = await response.text();
    let parsed: unknown = null;
    try {
      parsed = bodyText ? JSON.parse(bodyText) : null;
    } catch {
      parsed = { raw: bodyText };
    }

    if (!response.ok) {
      const message = typeof parsed === 'object' && parsed && 'errMsg' in parsed
        ? String((parsed as Record<string, unknown>).errMsg)
        : bodyText || `HTTP ${response.status}`;
      logger.error('[EZCount] createDoc failed', {
        eventCode: input.eventCode,
        mode,
        status: response.status,
        message,
      });
      return {
        status: 'FAILED',
        docId: null,
        docUrl: null,
        simulated: false,
        error: message,
      };
    }

    const { docId, docUrl } = parseEasyCountResponse(parsed);
    logger.info('[EZCount] receipt issued', {
      eventCode: input.eventCode,
      mode,
      docId,
      amount,
    });

    return {
      status: 'ISSUED',
      docId,
      docUrl,
      simulated: mode === 'sandbox',
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown EZCount error';
    logger.error('[EZCount] createDoc error', { eventCode: input.eventCode, mode, message });
    return {
      status: 'FAILED',
      docId: null,
      docUrl: null,
      simulated: false,
      error: message,
    };
  }
}

/** Persist advance on the payment ledger even when EasyCount is skipped/unavailable. */
export async function ensureAdvanceOnLedger(bookingId: string): Promise<void> {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking || booking.isOption || booking.advancePaid <= 0) return;
  await recordAdvancePayment({
    bookingId: booking.id,
    tenantId: booking.tenantId,
    amount: booking.advancePaid,
    depositMethod: booking.depositMethod,
    easycountDocId: booking.easycountDocId,
  });
}

/**
 * Facade: issue advance receipt via EasyCount and always sync BookingPayment ledger.
 */
export async function issueEasyCountReceiptForBooking(
  bookingId: string,
  options?: { force?: boolean },
): Promise<EasyCountBookingResult | null> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { eventDate: true },
  });

  if (!booking || booking.isOption || booking.advancePaid <= 0) {
    return null;
  }

  const force = options?.force === true;
  const alreadyIssued =
    booking.easycountStatus === 'ISSUED'
    || (!force && booking.easycountStatus === 'SIMULATED' && !!booking.easycountDocId);

  if (alreadyIssued && !force) {
    return {
      issued: false,
      status: booking.easycountStatus,
      message: 'קבלה כבר הופקה עבור מקדמה זו.',
      docId: booking.easycountDocId,
      docUrl: booking.easycountDocUrl,
    };
  }

  if (!force && !canIssueEasyCountReceipt(booking)) {
    return null;
  }

  const settings = await prisma.systemSettings.findUnique({ where: { id: 'global' } });
  const result = await issueAdvanceReceipt({
    eventCode: booking.eventCode,
    clientName: booking.clientAFullName,
    clientIdNumber: booking.clientAIdNumber,
    clientEmail: booking.clientAEmail || booking.clientBEmail,
    amount: booking.advancePaid,
    depositMethod: booking.depositMethod,
    eventType: booking.eventType,
    vatRate: settings?.vatRate ?? 17,
    vatType: booking.vatType,
    eventDate: booking.eventDate?.date ?? null,
  });

  if (result.status === 'SKIPPED') {
    await recordAdvancePayment({
      bookingId,
      tenantId: booking.tenantId,
      amount: booking.advancePaid,
      depositMethod: booking.depositMethod,
    }).catch((ledgerError) => {
      logger.error('שגיאה ברישום מקדמה ליומן תשלומים:', ledgerError);
    });
    return null;
  }

  const message = formatEasyCountUserMessage(result, getEasyCountMeta().mode);

  await prisma.booking.update({
    where: { id: bookingId },
    data: {
      easycountDocId: result.docId,
      easycountDocUrl: result.docUrl,
      easycountStatus: result.status,
      easycountError: result.status === 'FAILED' ? (result.error || message) : null,
    },
  });

  if (result.status === 'ISSUED' || result.status === 'SIMULATED') {
    await recordAdvancePayment({
      bookingId,
      tenantId: booking.tenantId,
      amount: booking.advancePaid,
      depositMethod: booking.depositMethod,
      easycountDocId: result.docId,
    }).catch((ledgerError) => {
      logger.error('שגיאה ברישום מקדמה ליומן תשלומים:', ledgerError);
    });
  }

  emitBookingUpdated(bookingId);

  return {
    issued: result.status === 'ISSUED' || result.status === 'SIMULATED',
    status: result.status,
    message,
    docId: result.docId,
    docUrl: result.docUrl,
  };
}
