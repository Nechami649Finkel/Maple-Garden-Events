import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';
import { logger } from './logger';

const LOGO_PATH = path.join(__dirname, '..', 'assets', 'logo.png');

export type MailFailureReason = 'missing_config' | 'auth_failed' | 'unknown';
export type MailDeliveryResult =
  | { ok: true; simulated?: boolean }
  | { ok: false; reason: MailFailureReason };

function getEmailUser(): string | undefined {
  return process.env.EMAIL_USER?.trim() || undefined;
}

function getEmailPass(): string | undefined {
  const pass = process.env.EMAIL_PASS || process.env.EMAIL_PASSWORD;
  return pass?.replace(/\s+/g, '') || undefined;
}

export function canSendRealMail(): boolean {
  return !!(getEmailUser() && getEmailPass());
}

export function getFromAddress(): string {
  return `"גן אירועים מייפל" <${getEmailUser() || 'maple.events.il@gmail.com'}>`;
}

let transporter: nodemailer.Transporter<SMTPTransport.SentMessageInfo> | null = null;

function getTransporter(): nodemailer.Transporter<SMTPTransport.SentMessageInfo> {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: getEmailUser(),
        pass: getEmailPass(),
      },
    });
  }
  return transporter;
}

export function resetTransporterForTests(): void {
  transporter = null;
}

function classifyMailError(error: unknown): MailFailureReason {
  const err = error as { code?: string; responseCode?: number };
  if (err?.code === 'EAUTH' || err?.responseCode === 535) return 'auth_failed';
  return 'unknown';
}

export function mailFailureMessage(reason: MailFailureReason): string {
  switch (reason) {
    case 'missing_config':
      return 'מייל לא מוגדר בשרת — הוסיפי EMAIL_USER ו-EMAIL_PASS (סיסמת אפליקציה מ-Google) בקובץ server/.env';
    case 'auth_failed':
      return 'Gmail דחה את ההתחברות — צרי סיסמת אפליקציה חדשה ב-myaccount.google.com/apppasswords (אחרי אימות דו-שלבי) ועדכני EMAIL_PASS ב-server/.env';
    default:
      return 'שליחת המייל נכשלה — בדקי את לוג השרת';
  }
}

export async function verifyEmailConnection(): Promise<MailDeliveryResult> {
  if (!canSendRealMail()) {
    logger.warn(
      'Email not configured — set EMAIL_USER and EMAIL_PASS (Google App Password) in server/.env',
    );
    return { ok: false, reason: 'missing_config' };
  }

  try {
    await getTransporter().verify();
    logger.info(`Email SMTP verified for ${getEmailUser()}`);
    return { ok: true };
  } catch (error) {
    const reason = classifyMailError(error);
    logger.error(`Email SMTP verification failed (${reason})`, {
      user: getEmailUser(),
      hint: mailFailureMessage(reason),
    });
    return { ok: false, reason };
  }
}

function optionalLogoAttachment(): NonNullable<nodemailer.SendMailOptions['attachments']> {
  if (fs.existsSync(LOGO_PATH)) {
    return [{ filename: 'logo.png', path: LOGO_PATH, cid: 'mapleLogo' }];
  }
  return [];
}

function logoHeaderHtml(): string {
  if (fs.existsSync(LOGO_PATH)) {
    return '<img src="cid:mapleLogo" alt="מיפל - גן אירועים בעיר" style="max-width: 200px; height: auto; display: block; margin: 0 auto;" />';
  }
  return '<div style="font-size: 1.5rem; font-weight: bold; color: #5a8f6b;">גן אירועים מייפל</div>';
}

function sanitizeMailAttachments(
  attachments: nodemailer.SendMailOptions['attachments'],
): nodemailer.SendMailOptions['attachments'] {
  if (!attachments?.length) return attachments;
  return attachments.filter((attachment) => {
    if ('path' in attachment && attachment.path && typeof attachment.path === 'string') {
      return fs.existsSync(attachment.path);
    }
    return true;
  });
}

export async function deliverMail(
  mailOptions: nodemailer.SendMailOptions,
  simulationLabel: string,
): Promise<MailDeliveryResult> {
  const safeOptions: nodemailer.SendMailOptions = {
    ...mailOptions,
    attachments: sanitizeMailAttachments(mailOptions.attachments),
  };

  if (!canSendRealMail()) {
    logger.info(`[MAILER SIMULATION] ${simulationLabel} → ${mailOptions.to}`);
    return { ok: true, simulated: true };
  }

  try {
    await getTransporter().sendMail(safeOptions);
    logger.info(`${simulationLabel} → ${mailOptions.to}`);
    return { ok: true };
  } catch (error) {
    const reason = classifyMailError(error);
    logger.error(`שגיאה בשליחת מייל (${simulationLabel}):`, error);
    return { ok: false, reason };
  }
}

// ==========================================
// 1. הקפצת אופציה (Bump Option)
// ==========================================
export const sendBumpEmail = async (
  clientEmail: string,
  clientName: string,
  eventDate: string,
  deadline: Date,
): Promise<MailDeliveryResult> => {
  const deadlineStr = deadline.toLocaleString('he-IL', { hour: '2-digit', minute: '2-digit' });
  const dateStr = new Date(eventDate).toLocaleDateString('he-IL');

  const mailOptions = {
    from: getFromAddress(),
    to: clientEmail,
    subject: `עדכון חשוב לגבי התאריך שלך במייפל (${dateStr}) ⏳`,
    html: `
      <div style="font-family: Arial, sans-serif; direction: rtl; text-align: right; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
        <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-bottom: 3px solid #d97706;">
          ${logoHeaderHtml()}
          <h2 style="color: #1f2937; margin: 15px 0 0 0;">החלטה דחופה נדרשת</h2>
        </div>
        <div style="padding: 25px;">
          <p style="font-size: 1.1rem;">שלום <strong>${clientName}</strong>,</p>
          <p style="font-size: 1.05rem; line-height: 1.5;">
            אנו מודים לך שבחרת להתעניין בקיום האירוע שלך בגן האירועים <strong>מייפל</strong>.<br/>
            התאריך ששמרת כאופציה (<strong>${dateStr}</strong>) הינו מבוקש מאוד, וכרגע יש לקוח נוסף שמעוניין לסגור אירוע במועד זה.
          </p>
          <div style="background-color: #fffbeb; border: 1px solid #fcd34d; border-radius: 6px; padding: 15px; margin: 25px 0; text-align: center;">
            <p style="color: #92400e; font-size: 1.1rem; margin: 0; font-weight: bold;">
              על מנת להבטיח את התאריך שלך, אנא צור איתנו קשר עד השעה ${deadlineStr}.
            </p>
            <p style="color: #d97706; font-size: 0.9rem; margin-top: 5px;">
              לאחר שעה זו, האופציה תשתחרר אוטומטית והתאריך יהיה פנוי ללקוח הבא.
            </p>
          </div>
          <p style="font-size: 1rem; margin-bottom: 30px;">
            נשמח לחגוג איתכם!<br/>
            <strong>צוות מייפל - גן אירועים בעיר</strong><br/>
            טלפון: 03-6777772
          </p>
        </div>
      </div>
    `,
    attachments: optionalLogoAttachment(),
  };

  const result = await deliverMail(mailOptions, `מייל הקפצת אופציה ל-${clientEmail}`);
  return result;
};

// ==========================================
// 2. התראה ללקוח על פרטים שחסרים לאירוע (נודניק)
// ==========================================
export const sendSelectionReminderEmail = async (
  clientEmail: string,
  clientName: string,
  missingItems: string[],
): Promise<boolean> => {
  const mailOptions = {
    from: getFromAddress(),
    to: clientEmail,
    subject: `תזכורת: השלמת פרטים לאירוע הקרוב שלכם במייפל 🍁`,
    html: `
      <div style="font-family: Arial, sans-serif; direction: rtl; text-align: right; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
        <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-bottom: 3px solid #6ee7b7;">
          ${logoHeaderHtml()}
          <h2 style="color: #1f2937; margin: 0;">מתכוננים לאירוע שלכם!</h2>
        </div>
        <div style="padding: 25px;">
          <p style="font-size: 1.1rem;">שלום <strong>${clientName}</strong>,</p>
          <p style="font-size: 1.05rem; line-height: 1.5;">
            האירוע שלכם ב<strong>מייפל</strong> הולך ומתקרב, ואנחנו מתרגשים יחד איתכם! 🎉<br/>
            שמנו לב שטרם סיימתם לבחור את הפרטים הבאים למערכת:
          </p>
          <ul style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 15px 35px; margin: 25px 0; color: #166534; font-size: 1.1rem; font-weight: bold;">
            ${missingItems.map((item) => `<li>${item}</li>`).join('')}
          </ul>
          <p style="font-size: 1rem; margin-bottom: 30px;">
            אנא היכנסו למערכת או צרו איתנו קשר בהקדם כדי שנוכל להיערך מראש ולהפיק לכם אירוע מושלם.<br/><br/>
            <strong>צוות מייפל 🍁</strong><br/>
            טלפון: 03-6777772
          </p>
        </div>
        <div style="background-color: #f3f4f6; padding: 15px; text-align: center; color: #6b7280; font-size: 0.85rem;">
          🤖 הודעה זו נשלחה אוטומטית ממערכת מייפל.<br/>
          <strong>ניתן להשיב למייל זה בכל שאלה, ונציג יחזור אליכם בהקדם.</strong>
        </div>
      </div>
    `,
    attachments: optionalLogoAttachment(),
  };

  const result = await deliverMail(mailOptions, `תזכורת בחירות ל-${clientEmail}`);
  return result.ok;
};

// ==========================================
// 3. התראה ללקוח על צ'ק ביטחון חסר (נודניק)
// ==========================================
export const sendSecurityCheckReminderEmail = async (
  clientEmail: string,
  clientName: string,
): Promise<boolean> => {
  const mailOptions = {
    from: getFromAddress(),
    to: clientEmail,
    subject: `תזכורת: מסירת צ'ק ביטחון לאירוע שלכם במייפל 🍁`,
    html: `
      <div style="font-family: Arial, sans-serif; direction: rtl; text-align: right; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
        <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-bottom: 3px solid #fca5a5;">
          ${logoHeaderHtml()}
          <h2 style="color: #1f2937; margin: 0;">עדכון סטטוס הזמנה</h2>
        </div>
        <div style="padding: 25px;">
          <p style="font-size: 1.1rem;">שלום <strong>${clientName}</strong>,</p>
          <p style="font-size: 1.05rem; line-height: 1.5;">
            מזל טוב על סגירת האירוע בגן האירועים <strong>מייפל</strong>!<br/>
            שמנו לב שעברו 24 שעות מחתימת החוזה וטרם התקבל או הועלה למערכת צ'ק ביטחון.
          </p>
          <div style="background-color: #fef2f2; border: 1px solid #fca5a5; border-radius: 6px; padding: 15px; margin: 25px 0; text-align: center;">
            <p style="color: #991b1b; font-size: 1rem; margin: 0; font-weight: bold;">
              נשמח לקבלו בהקדם האפשרי על מנת להבטיח את שריון התאריך שלכם באופן סופי.
            </p>
          </div>
          <p style="font-size: 1rem; margin-bottom: 30px;">
            תודה רבה,<br/>
            <strong>צוות מייפל 🍁</strong>
          </p>
        </div>
        <div style="background-color: #f3f4f6; padding: 15px; text-align: center; color: #6b7280; font-size: 0.85rem;">
          🤖 הודעה זו נשלחה אוטומטית ממערכת מייפל.<br/>
          <strong>ניתן להשיב למייל זה בכל שאלה, ונציג יחזור אליכם בהקדם.</strong>
        </div>
      </div>
    `,
    attachments: optionalLogoAttachment(),
  };

  const result = await deliverMail(mailOptions, `תזכורת צ'ק ביטחון ל-${clientEmail}`);
  return result.ok;
};

// ==========================================
// 4. התראה פנימית למנהל האולם
// ==========================================
export const sendManagerFinancialAlertEmail = async (
  managerEmail: string,
  alertType: string,
  clientName: string,
  details: string,
): Promise<boolean> => {
  const mailOptions = {
    from: `"מערכת התראות מייפל" <${getEmailUser() || 'maple.events.il@gmail.com'}>`,
    to: managerEmail,
    subject: `⚠️ התראת ניהול: ${alertType} - ${clientName}`,
    html: `
      <div style="font-family: Arial, sans-serif; direction: rtl; text-align: right; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #ef4444; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #ef4444; padding: 15px; text-align: center;">
          <h2 style="color: #fff; margin: 0;">התראת כספים ⚠️</h2>
        </div>
        <div style="padding: 25px; background-color: #fff;">
          <p><strong>לקוח:</strong> ${clientName}</p>
          <p><strong>סוג התראה:</strong> ${alertType}</p>
          <p><strong>פרטים:</strong> ${details}</p>
          <br/>
          <p style="color: #ef4444; font-weight: bold;">נדרש טיפול מול הלקוח בהקדם.</p>
        </div>
      </div>
    `,
  };

  const result = await deliverMail(mailOptions, `התראת מנהל ל-${managerEmail}`);
  return result.ok;
};

// ==========================================
// 4b. תזכורת תשלום בפיגור — ללקוח
// ==========================================
export const sendPaymentOverdueReminderEmail = async (
  clientEmail: string,
  clientName: string,
  bodyText: string,
  remainingAmount: number,
  missedDeadline: Date,
): Promise<boolean> => {
  const deadlineStr = missedDeadline.toLocaleDateString('he-IL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const formattedBody = bodyText.replace(/\n/g, '<br/>');

  const mailOptions = {
    from: getFromAddress(),
    to: clientEmail,
    subject: `תזכורת אדיבה: השלמת תשלום לאירוע שלכם במייפל 🍁`,
    html: `
      <div style="font-family: Arial, sans-serif; direction: rtl; text-align: right; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
        <div style="background-color: #fffbeb; padding: 20px; text-align: center; border-bottom: 3px solid #d97706;">
          ${logoHeaderHtml()}
          <h2 style="color: #92400e; margin: 0;">תזכורת לגבי תשלום האירוע</h2>
        </div>
        <div style="padding: 25px;">
          <p style="font-size: 1.1rem;">שלום <strong>${clientName}</strong>,</p>
          <p style="font-size: 1.05rem; line-height: 1.6;">${formattedBody}</p>
          <div style="background-color: #fef3c7; border: 1px solid #fcd34d; border-radius: 6px; padding: 15px; margin: 20px 0;">
            <strong>מועד תשלום:</strong> ${deadlineStr}<br/>
            <strong>יתרה לתשלום:</strong> ₪${Math.round(remainingAmount).toLocaleString('he-IL')}
          </div>
          <p style="font-size: 1rem;">
            לכל שאלה ניתן להשיב למייל זה או ליצור קשר בטלפון 03-6777772.<br/><br/>
            <strong>צוות מייפל 🍁</strong>
          </p>
        </div>
        <div style="background-color: #f3f4f6; padding: 15px; text-align: center; color: #6b7280; font-size: 0.85rem;">
          🤖 הודעה זו נשלחה אוטומטית ממערכת מייפל.
        </div>
      </div>
    `,
    attachments: optionalLogoAttachment(),
  };

  const result = await deliverMail(mailOptions, `תזכורת תשלום ל-${clientEmail}`);
  return result.ok;
};

// ==========================================
// 5. בקשת משוב לאחר סיום אירוע
// ==========================================
export const sendFeedbackRequestEmail = async (
  clientEmail: string,
  clientName: string | null,
  link: string,
): Promise<MailDeliveryResult> => {
  const name = clientName ? clientName.split(' ')[0] : 'לקוחות יקרים';

  const mailOptions = {
    from: getFromAddress(),
    to: clientEmail,
    subject: `איך היה האירוע שלכם? נשמח לשמוע! 🌟`,
    html: `
      <div style="font-family: Arial, sans-serif; direction: rtl; text-align: right; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
        <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-bottom: 3px solid #d8a051;">
          ${logoHeaderHtml()}
          <h2 style="color: #1f2937; margin: 0;">תודה שחגגתם איתנו! 🎉</h2>
        </div>
        <div style="padding: 25px;">
          <p style="font-size: 1.1rem;">שלום <strong>${name}</strong>,</p>
          <p style="font-size: 1.05rem; line-height: 1.5;">
            היה לנו לעונג עצום לארח אתכם ואת האורחים שלכם בגן האירועים <strong>מייפל</strong>.<br/>
            כדי שנוכל להמשיך לתת את השירות הטוב ביותר ולהשתפר, נשמח מאוד אם תקדישו דקה קטנה לדירוג החוויה שלכם בטופס הבא:
          </p>
          
          <div style="text-align: center; margin: 35px 0;">
            <a href="${link}" style="background-color: #d97706; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 1.1rem; display: inline-block;">למעבר לטופס המשוב (קצרצר)</a>
          </div>
          
          <p style="font-size: 0.9rem; color: #6b7280; text-align: center;">
            (שימו לב: מטעמי אבטחה, הקישור אישי וניתן למילוי פעם אחת בלבד)
          </p>
          
          <p style="font-size: 1rem; margin-top: 30px; margin-bottom: 10px;">
            בתודה מראש ובאהבה,<br/>
            <strong>צוות מייפל 🍁</strong>
          </p>
        </div>
        <div style="background-color: #f3f4f6; padding: 15px; text-align: center; color: #6b7280; font-size: 0.85rem;">
          🤖 הודעה זו נשלחה אוטומטית ממערכת מייפל.
        </div>
      </div>
    `,
    attachments: optionalLogoAttachment(),
  };

  const result = await deliverMail(mailOptions, `מייל משוב ל-${clientEmail}`);
  return result;
};

// ==========================================
// 6. הודעת עניין באופציה (מתענינים בתאריך שלך)
// ==========================================
function buildOptionInterestText(clientName: string, eventDate: string, customMessage?: string): string {
  if (customMessage?.trim()) return customMessage.trim();
  const dateStr = new Date(eventDate).toLocaleDateString('he-IL');
  return `שלום ${clientName}, מתענינים בתאריך שלך (${dateStr}) בגן האירועים מייפל. נשמח לשמוע ממך בהקדם.`;
}

export const sendOptionInterestEmail = async (
  clientEmail: string,
  clientName: string,
  eventDate: string,
  customMessage?: string,
): Promise<MailDeliveryResult> => {
  const bodyText = buildOptionInterestText(clientName, eventDate, customMessage);
  const dateStr = new Date(eventDate).toLocaleDateString('he-IL');
  const escapedBody = bodyText.replace(/\n/g, '<br/>');

  const mailOptions = {
    from: getFromAddress(),
    to: clientEmail,
    subject: `מתענינים בתאריך שלך במייפל (${dateStr}) 🍁`,
    html: `
      <div style="font-family: Arial, sans-serif; direction: rtl; text-align: right; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
        <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-bottom: 3px solid #d97706;">
          ${logoHeaderHtml()}
          <h2 style="color: #1f2937; margin: 15px 0 0 0;">מתענינים בתאריך שלך</h2>
        </div>
        <div style="padding: 25px;">
          <p style="font-size: 1.05rem; line-height: 1.6;">${escapedBody}</p>
          <p style="font-size: 1rem; margin-top: 30px;">
            <strong>צוות מייפל - גן אירועים בעיר</strong><br/>
            טלפון: 03-6777772
          </p>
        </div>
        <div style="background-color: #f3f4f6; padding: 15px; text-align: center; color: #6b7280; font-size: 0.85rem;">
          🤖 הודעה זו נשלחה ממערכת מייפל.<br/>
          <strong>ניתן להשיב למייל זה בכל שאלה, ונציג יחזור אליכם בהקדם.</strong>
        </div>
      </div>
    `,
    attachments: optionalLogoAttachment(),
  };

  return deliverMail(mailOptions, `הודעת עניין באופציה ל-${clientEmail}`);
};
