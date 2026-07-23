import { logger } from '../utils/logger';

const GRAPH_API_VERSION = process.env.WHATSAPP_GRAPH_VERSION || 'v20.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

export type WhatsAppCloudSendResult = {
  ok: boolean;
  messageId?: string;
  error?: string;
  simulated?: boolean;
};

export function isWhatsAppCloudConfigured(): boolean {
  return !!(
    process.env.WHATSAPP_TOKEN?.trim() &&
    process.env.WHATSAPP_PHONE_NUMBER_ID?.trim()
  );
}

function getCloudConfig(): { token: string; phoneNumberId: string } | null {
  const token = process.env.WHATSAPP_TOKEN?.trim();
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  if (!token || !phoneNumberId) return null;
  return { token, phoneNumberId };
}

/** E.164 digits without leading + (Meta Cloud expects this in `to`). */
export function formatPhoneForWhatsAppCloud(rawPhone: string): string {
  const digits = rawPhone.replace(/\D/g, '');
  if (digits.startsWith('972')) return digits;
  if (digits.startsWith('0')) return `972${digits.slice(1)}`;
  return digits;
}

async function postMessages(body: Record<string, unknown>): Promise<WhatsAppCloudSendResult> {
  const config = getCloudConfig();
  if (!config) {
    logger.info('WhatsApp Cloud API not configured — simulating send', { body });
    return { ok: false, simulated: true, error: 'not_configured' };
  }

  try {
    const res = await fetch(`${GRAPH_BASE}/${config.phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = (await res.json().catch(() => ({}))) as {
      messages?: { id?: string }[];
      error?: { message?: string; code?: number };
    };

    if (!res.ok) {
      const error = data.error?.message || `HTTP ${res.status}`;
      logger.error('WhatsApp Cloud API send failed', { status: res.status, error, data });
      return { ok: false, error };
    }

    const messageId = data.messages?.[0]?.id;
    logger.info('WhatsApp Cloud API message sent', { messageId, to: body.to });
    return { ok: true, messageId };
  } catch (error) {
    logger.error('WhatsApp Cloud API send error', { error });
    return { ok: false, error: error instanceof Error ? error.message : 'unknown' };
  }
}

/** Send a plain text message via Meta WhatsApp Cloud API. */
export async function sendWhatsAppCloudText(
  rawPhone: string,
  text: string,
): Promise<WhatsAppCloudSendResult> {
  const to = formatPhoneForWhatsAppCloud(rawPhone);
  return postMessages({
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'text',
    text: { preview_url: false, body: text },
  });
}

/** Send a template message (required for first outbound contact outside 24h window). */
export async function sendWhatsAppCloudTemplate(
  rawPhone: string,
  templateName: string,
  languageCode = 'he',
  components?: Record<string, unknown>[],
): Promise<WhatsAppCloudSendResult> {
  const to = formatPhoneForWhatsAppCloud(rawPhone);
  return postMessages({
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
      ...(components?.length ? { components } : {}),
    },
  });
}
