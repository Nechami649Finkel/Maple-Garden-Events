import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'miryamilandman@gmail.com',
    pass: process.env.EMAIL_PASSWORD || '',
  },
});

export const sendPDFToClient = async (
  clientEmail: string,
  clientName: string,
  eventDate: string,
  pdfBuffer: Buffer
): Promise<boolean> => {
  try {
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

    await transporter.sendMail({
      from: process.env.EMAIL_USER || 'miryamilandman@gmail.com',
      to: clientEmail,
      subject: subject,
      html: htmlBody,
      attachments: [
        {
          filename: `טופס_הפקה_${clientName}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    });

    console.log(`✅ Email sent to ${clientEmail}`);
    return true;
  } catch (error) {
    console.error('❌ Email sending failed:', error);
    return false;
  }
};

export const sendWhatsAppMessage = async (
  phoneNumber: string,
  clientName: string,
  eventDate: string
): Promise<boolean> => {
  try {
    // בשלב זה - placeholder. כדי להשתמש בTwilio צריך:
    // 1. npm install twilio
    // 2. Twilio account + credentials
    // 3. שימוש ב-Twilio API
    
    const twilio_account_sid = process.env.TWILIO_ACCOUNT_SID;
    const twilio_auth_token = process.env.TWILIO_AUTH_TOKEN;
    const twilio_phone = process.env.TWILIO_PHONE_NUMBER;

    if (!twilio_account_sid || !twilio_auth_token || !twilio_phone) {
      console.warn('⚠️ Twilio not configured - skipping WhatsApp');
      return false;
    }

    // TODO: implement Twilio WhatsApp API
    console.log(`📱 WhatsApp would be sent to: ${phoneNumber}`);
    return false;
  } catch (error) {
    console.error('❌ WhatsApp sending failed:', error);
    return false;
  }
};
