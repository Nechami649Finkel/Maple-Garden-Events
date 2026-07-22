import { logger } from '../utils/logger';

export type EasyCountMode = 'off' | 'simulation' | 'sandbox' | 'live';

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

const DOC_TYPE_INVOICE_RECEIPT = 405;

function resolveEasyCountMode(): EasyCountMode {
  const raw = (process.env.EASYCOUNT_MODE || 'simulation').trim().toLowerCase();
  if (raw === 'off') return 'off';
  if (raw === 'live') {
    return hasCredentials() ? 'live' : 'simulation';
  }
  if (raw === 'sandbox') {
    return hasCredentials() ? 'sandbox' : 'simulation';
  }
  return 'simulation';
}

function hasCredentials(): boolean {
  return !!(process.env.EASYCOUNT_API_KEY?.trim() && process.env.EASYCOUNT_DEVELOPER_EMAIL?.trim());
}

function apiBaseUrl(mode: EasyCountMode): string {
  if (mode === 'sandbox') return 'https://demo.ezcount.co.il';
  return 'https://www.ezcount.co.il';
}

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

export function getEasyCountMeta() {
  const mode = resolveEasyCountMode();
  return {
    mode,
    configured: hasCredentials(),
    canIssueRealDocuments: mode === 'live' || mode === 'sandbox',
    label:
      mode === 'off'
        ? 'כבוי'
        : mode === 'simulation'
          ? 'סימולציה — לא מופקות קבלות אמיתיות'
          : mode === 'sandbox'
            ? 'Sandbox (demo.ezcount.co.il)'
            : 'Production (ezcount.co.il)',
  };
}

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

  const apiKey = process.env.EASYCOUNT_API_KEY!.trim();
  const developerEmail = process.env.EASYCOUNT_DEVELOPER_EMAIL!.trim();
  const vatRate = Number(input.vatRate) || 17;
  const ezVatType = mapVatType(input.vatType);
  const sendEmail =
    mode === 'live'
    && process.env.EASYCOUNT_SEND_EMAIL === 'true'
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
    const response = await fetch(`${apiBaseUrl(mode)}/api/createDoc`, {
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
