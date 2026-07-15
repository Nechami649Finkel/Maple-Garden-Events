import { deliverMail, getFromAddress } from '../utils/mailer';
import { logger } from '../utils/logger';

export const sendPDFToClient = async (
  clientEmail: string,
  clientName: string,
  eventDate: string,
  pdfBuffer: Buffer,
): Promise<boolean> => {
  const subject = `טופס הפקת אירוע - ${clientName} | ${new Date(eventDate).toLocaleDateString('he-IL')}`;
  const htmlBody = `
      <div style="direction: rtl; font-family: Arial, sans-serif;">
        <h2>שלום ${clientName}!</h2>
        <p>מצורף טופס הפקת האירוע שלך ב-PDF.</p>
        <p>אנא שמור את הטופס הזה כדי להשתמש בו ביום האירוע.</p>
        <br/>
        <p>גן מייפל אירועים</p>
      </div>
    `;

  const result = await deliverMail(
    {
      from: getFromAddress(),
      to: clientEmail,
      subject,
      html: htmlBody,
      attachments: [
        {
          filename: `טופס_הפקה_${clientName}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    },
    `טופס PDF ל-${clientEmail}`,
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
