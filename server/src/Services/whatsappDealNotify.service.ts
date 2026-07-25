import { logger } from '../utils/logger';
import {
  collectWhatsAppPhones,
  isWhatsAppCloudConfigured,
  resolveManagerWhatsAppPhone,
  sendWhatsAppCloudPdfDocument,
  sendWhatsAppCloudText,
  type WhatsAppCloudSendResult,
} from './whatsappCloud.service';

export type DealNotifyBooking = {
  id: string;
  eventCode?: string | null;
  clientAFullName: string;
  clientAPhone?: string | null;
  clientBPhone?: string | null;
  eventType?: string | null;
  eventDate?: { date?: Date | string | null } | null;
};

function formatEventDate(booking: DealNotifyBooking): string {
  const raw = booking.eventDate?.date;
  if (!raw) return '';
  const d = raw instanceof Date ? raw : new Date(raw);
  if (Number.isNaN(d.getTime())) return String(raw);
  return d.toLocaleDateString('he-IL');
}

function clientPhones(booking: DealNotifyBooking): string[] {
  const phones = collectWhatsAppPhones(booking.clientAPhone);
  if (booking.eventType === 'חתונה') {
    phones.push(...collectWhatsAppPhones(booking.clientBPhone).filter((p) => !phones.includes(p)));
  }
  return phones;
}

async function sendPdfToPhones(
  phones: string[],
  pdfBuffer: Buffer,
  filename: string,
  caption: string,
  templateEnvKey: 'WHATSAPP_CONTRACT_TEMPLATE' | 'WHATSAPP_EVENT_FORM_TEMPLATE',
): Promise<{ sent: number; failed: number; simulated: boolean }> {
  const templateName = process.env[templateEnvKey]?.trim() || undefined;
  const templateLang = process.env.WHATSAPP_TEMPLATE_LANG?.trim() || 'he';
  let sent = 0;
  let failed = 0;
  let simulated = false;

  for (const phone of phones) {
    const result: WhatsAppCloudSendResult = await sendWhatsAppCloudPdfDocument(
      phone,
      pdfBuffer,
      filename,
      caption,
      templateName,
      templateLang,
    );
    if (result.simulated) simulated = true;
    if (result.ok) sent++;
    else if (!result.simulated) failed++;
  }

  return { sent, failed, simulated };
}

/**
 * After a deal is closed (BOOKED + signed contract): send contract PDF via WhatsApp Cloud
 * to clients and hall manager. Uses optional approved Meta templates when configured.
 */
export async function notifyContractClosedViaWhatsApp(
  booking: DealNotifyBooking,
  contractPdfBuffer: Buffer,
): Promise<void> {
  if (!isWhatsAppCloudConfigured()) {
    logger.info('WhatsApp Cloud not configured — skip contract WhatsApp notify', {
      bookingId: booking.id,
    });
    return;
  }

  const dateStr = formatEventDate(booking);
  const filename = `contract-${booking.eventCode || booking.id}.pdf`;
  const caption = `חוזה אירוע — ${booking.clientAFullName}${dateStr ? ` · ${dateStr}` : ''}`;
  const phones = clientPhones(booking);
  const managerPhone = resolveManagerWhatsAppPhone();

  const clientResult = await sendPdfToPhones(
    phones,
    contractPdfBuffer,
    filename,
    caption,
    'WHATSAPP_CONTRACT_TEMPLATE',
  );

  if (managerPhone) {
    await sendWhatsAppCloudText(
      managerPhone,
      `📄 חוזה נחתם ונסגר\nלקוח: ${booking.clientAFullName}\nקוד: ${booking.eventCode || booking.id}\nתאריך: ${dateStr || '—'}\nנשלח ללקוח ב-WhatsApp: ${clientResult.sent} נמענים`,
    );
    await sendPdfToPhones(
      [managerPhone],
      contractPdfBuffer,
      filename,
      `עותק מנהל — ${caption}`,
      'WHATSAPP_CONTRACT_TEMPLATE',
    );
  }

  logger.info('WhatsApp contract notify finished', {
    bookingId: booking.id,
    clientPhones: phones.length,
    ...clientResult,
    managerNotified: Boolean(managerPhone),
  });
}

/**
 * Send event production form PDF via WhatsApp Cloud to clients (+ manager alert).
 */
export async function notifyEventFormViaWhatsApp(
  booking: DealNotifyBooking,
  eventFormPdfBuffer: Buffer,
): Promise<void> {
  if (!isWhatsAppCloudConfigured()) {
    logger.info('WhatsApp Cloud not configured — skip event-form WhatsApp notify', {
      bookingId: booking.id,
    });
    return;
  }

  const dateStr = formatEventDate(booking);
  const filename = `event-form-${booking.eventCode || booking.id}.pdf`;
  const caption = `טופס הפקה — ${booking.clientAFullName}${dateStr ? ` · ${dateStr}` : ''}`;
  const phones = clientPhones(booking);
  const managerPhone = resolveManagerWhatsAppPhone();

  const clientResult = await sendPdfToPhones(
    phones,
    eventFormPdfBuffer,
    filename,
    caption,
    'WHATSAPP_EVENT_FORM_TEMPLATE',
  );

  if (managerPhone) {
    await sendWhatsAppCloudText(
      managerPhone,
      `📋 טופס הפקה נשלח ללקוח\nלקוח: ${booking.clientAFullName}\nקוד: ${booking.eventCode || booking.id}\nתאריך: ${dateStr || '—'}`,
    );
  }

  logger.info('WhatsApp event-form notify finished', {
    bookingId: booking.id,
    clientPhones: phones.length,
    ...clientResult,
    managerNotified: Boolean(managerPhone),
  });
}
