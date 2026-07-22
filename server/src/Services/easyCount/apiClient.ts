import type { EasyCountInvoiceRequest, EasyCountInvoiceResult } from './types';
import { generateMockExternalId } from './helpers';

function useMockMode(): boolean {
  return process.env.EASY_COUNT_MOCK_MODE === 'true';
}

export async function postEasyCountInvoice(
  payload: EasyCountInvoiceRequest,
): Promise<EasyCountInvoiceResult> {
  if (useMockMode()) {
    return {
      externalId: generateMockExternalId(),
      paymentUrl: undefined,
      status: 'pending',
    };
  }

  const baseUrl = process.env.EASY_COUNT_API_URL?.trim().replace(/\/$/, '');
  const apiKey = process.env.EASY_COUNT_API_KEY?.trim();
  if (!baseUrl || !apiKey) {
    const err: Error & { statusCode?: number } = new Error(
      'Easy Count לא מוגדר — הוסיפי EASY_COUNT_API_URL ו-EASY_COUNT_API_KEY ל-.env',
    );
    err.statusCode = 503;
    throw err;
  }

  const merchantId = process.env.EASY_COUNT_MERCHANT_ID?.trim();
  const response = await fetch(`${baseUrl}/invoices`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      ...(merchantId ? { 'X-Merchant-Id': merchantId } : {}),
    },
    body: JSON.stringify({
      reference: payload.bookingId,
      customer: {
        name: payload.clientName,
        email: payload.clientEmail ?? undefined,
        phone: payload.clientPhone,
      },
      amount: payload.amount,
      currency: 'ILS',
      description: payload.description,
      metadata: {
        eventCode: payload.eventCode,
        installmentLabel: payload.installmentLabel,
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    const err: Error & { statusCode?: number } = new Error(
      `Easy Count API error (${response.status}): ${text || response.statusText}`,
    );
    err.statusCode = response.status >= 400 && response.status < 500 ? 502 : 503;
    throw err;
  }

  const data = (await response.json()) as {
    id?: string;
    invoiceId?: string;
    paymentUrl?: string;
    payment_url?: string;
    status?: string;
  };

  const externalId = String(data.id ?? data.invoiceId ?? '');
  if (!externalId) {
    throw new Error('Easy Count API returned no invoice id');
  }

  return {
    externalId,
    paymentUrl: data.paymentUrl ?? data.payment_url,
    status: normalizeRemoteStatus(data.status),
  };
}

function normalizeRemoteStatus(status?: string): EasyCountInvoiceResult['status'] {
  switch ((status ?? '').toLowerCase()) {
    case 'paid':
    case 'completed':
      return 'paid';
    case 'cancelled':
    case 'canceled':
      return 'cancelled';
    case 'failed':
      return 'failed';
    case 'draft':
      return 'draft';
    default:
      return 'pending';
  }
}

export interface EasyCountWebhookEvent {
  externalId: string;
  status: 'paid' | 'pending' | 'cancelled' | 'failed';
  amountPaid?: number;
  paidAt?: string;
  raw: unknown;
}

export function parseEasyCountWebhook(body: unknown): EasyCountWebhookEvent | null {
  if (!body || typeof body !== 'object') return null;

  const record = body as Record<string, unknown>;
  const externalId = String(
    record.externalId ?? record.invoiceId ?? record.id ?? '',
  ).trim();
  if (!externalId) return null;

  const statusRaw = String(record.status ?? '').toLowerCase();
  let status: EasyCountWebhookEvent['status'] = 'pending';
  if (['paid', 'completed', 'success'].includes(statusRaw)) status = 'paid';
  else if (['cancelled', 'canceled'].includes(statusRaw)) status = 'cancelled';
  else if (['failed', 'error'].includes(statusRaw)) status = 'failed';

  const amountPaid = record.amountPaid ?? record.amount_paid ?? record.paidAmount;
  const paidAt = record.paidAt ?? record.paid_at;

  return {
    externalId,
    status,
    amountPaid: amountPaid !== undefined ? Number(amountPaid) : undefined,
    paidAt: paidAt !== undefined ? String(paidAt) : undefined,
    raw: body,
  };
}
