import { deliverMail, getFromAddress } from '../utils/mailer';
import { logger } from '../utils/logger';
import { DEFAULT_LOCALE, getServerTranslation, T, type Locale } from '../i18n/getServerTranslation';

export const sendPDFToClient = async (
  clientEmail: string,
  clientName: string,
  eventDate: string,
  pdfBuffer: Buffer,
  locale: Locale = DEFAULT_LOCALE,
): Promise<boolean> => {
  const { t } = getServerTranslation(locale);
  const formattedDate = new Date(eventDate).toLocaleDateString(locale === 'he' ? 'he-IL' : 'en-US');
  const subject = t(T.SERVER.EMAIL.EVENT_FORM.SUBJECT, { clientName, date: formattedDate });
  const htmlBody = `
      <div style="direction: rtl; font-family: Arial, sans-serif;">
        <h2>${t(T.SERVER.EMAIL.EVENT_FORM.GREETING, { clientName })}</h2>
        <p>${t(T.SERVER.EMAIL.EVENT_FORM.BODY)}</p>
        <p>${t(T.SERVER.EMAIL.EVENT_FORM.NOTE)}</p>
        <br/>
        <p>${t(T.SERVER.EMAIL.EVENT_FORM.SIGNATURE)}</p>
      </div>
    `;

  const result = await deliverMail(
    {
      from: getFromAddress(locale),
      to: clientEmail,
      subject,
      html: htmlBody,
      attachments: [
        {
          filename: t(T.SERVER.EMAIL.EVENT_FORM.ATTACHMENT, { clientName }),
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    },
    t(T.SERVER.EMAIL.EVENT_FORM.LOG_LABEL, { email: clientEmail }),
  );

  return result.ok;
};

export const sendWhatsAppMessage = async (
  phoneNumber: string,
  clientName: string,
  eventDate: string,
): Promise<boolean> => {
  try {
    const twilio_account_sid = process.env.TWILIO_ACCOUNT_SID;
    const twilio_auth_token = process.env.TWILIO_AUTH_TOKEN;
    const twilio_phone = process.env.TWILIO_PHONE_NUMBER;

    if (!twilio_account_sid || !twilio_auth_token || !twilio_phone) {
      logger.warn('Twilio not configured - skipping WhatsApp');
      return false;
    }

    logger.info('WhatsApp would be sent', { phoneNumber });
    return false;
  } catch (error) {
    logger.error('WhatsApp sending failed', { error });
    return false;
  }
};
