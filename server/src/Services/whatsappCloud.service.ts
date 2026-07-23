import { logger } from '../utils/logger';

const GRAPH_API_VERSION = process.env.WHATSAPP_GRAPH_VERSION || 'v20.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

export type WhatsAppCloudSendResult = {
  ok: boolean;
  messageId?: string;
  mediaId?: string;
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

/** Collect unique WhatsApp-ready phones from raw booking fields (supports ` | ` suffixes). */
export function collectWhatsAppPhones(...rawPhones: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  for (const raw of rawPhones) {
    if (!raw?.trim()) continue;
    for (const part of raw.split(/[|,;]/)) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      const digits = trimmed.replace(/\D/g, '');
      if (digits.length < 9) continue;
      seen.add(formatPhoneForWhatsAppCloud(trimmed));
    }
  }
  return [...seen];
}

export function resolveManagerWhatsAppPhone(): string | null {
  const raw = process.env.MANAGER_ALERT_PHONE?.trim();
  if (!raw) return null;
  return formatPhoneForWhatsAppCloud(raw);
}

async function postMessages(body: Record<string, unknown>): Promise<WhatsAppCloudSendResult> {
  const config = getCloudConfig();
  if (!config) {
    logger.info('WhatsApp Cloud API not configured — simulating send', { type: body.type, to: body.to });
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
    logger.info('WhatsApp Cloud API message sent', { messageId, to: body.to, type: body.type });
    return { ok: true, messageId };
  } catch (error) {
    logger.error('WhatsApp Cloud API send error', { error });
    return { ok: false, error: error instanceof Error ? error.message : 'unknown' };
  }
}

/** Upload a binary file to WhatsApp Cloud media endpoint; returns media id. */
export async function uploadWhatsAppCloudMedia(
  buffer: Buffer,
  filename: string,
  mimeType: string,
): Promise<WhatsAppCloudSendResult> {
  const config = getCloudConfig();
  if (!config) {
    return { ok: false, simulated: true, error: 'not_configured' };
  }

  try {
    const form = new FormData();
    form.append('messaging_product', 'whatsapp');
    form.append('type', mimeType);
    form.append(
      'file',
      new Blob([Uint8Array.from(buffer)], { type: mimeType }),
      filename,
    );

    const res = await fetch(`${GRAPH_BASE}/${config.phoneNumberId}/media`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.token}` },
      body: form,
    });

    const data = (await res.json().catch(() => ({}))) as {
      id?: string;
      error?: { message?: string };
    };

    if (!res.ok || !data.id) {
      const error = data.error?.message || `HTTP ${res.status}`;
      logger.error('WhatsApp Cloud media upload failed', { status: res.status, error, data });
      return { ok: false, error };
    }

    return { ok: true, mediaId: data.id };
  } catch (error) {
    logger.error('WhatsApp Cloud media upload error', { error });
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

/** Send a PDF/document previously uploaded (or by public link). */
export async function sendWhatsAppCloudDocument(
  rawPhone: string,
  options: {
    mediaId?: string;
    link?: string;
    filename: string;
    caption?: string;
  },
): Promise<WhatsAppCloudSendResult> {
  const to = formatPhoneForWhatsAppCloud(rawPhone);
  const document: Record<string, string> = { filename: options.filename };
  if (options.mediaId) document.id = options.mediaId;
  else if (options.link) document.link = options.link;
  else return { ok: false, error: 'mediaId_or_link_required' };
  if (options.caption) document.caption = options.caption;

  return postMessages({
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'document',
    document,
  });
}

/**
 * Upload PDF buffer and send as WhatsApp document.
 * Optionally send an approved template first (opens customer-care window / branding).
 */
export async function sendWhatsAppCloudPdfDocument(
  rawPhone: string,
  pdfBuffer: Buffer,
  filename: string,
  caption?: string,
  templateName?: string,
  templateLanguage = 'he',
): Promise<WhatsAppCloudSendResult> {
  if (templateName?.trim()) {
    await sendWhatsAppCloudTemplate(rawPhone, templateName.trim(), templateLanguage);
  }

  const uploaded = await uploadWhatsAppCloudMedia(pdfBuffer, filename, 'application/pdf');
  if (!uploaded.ok || !uploaded.mediaId) {
    return uploaded;
  }

  return sendWhatsAppCloudDocument(rawPhone, {
    mediaId: uploaded.mediaId,
    filename,
    caption,
  });
}
