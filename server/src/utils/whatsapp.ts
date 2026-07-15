// src/utils/whatsapp.ts
import { logger } from './logger';

export type WhatsAppSendResult = {
  sent: boolean;
  simulated: boolean;
  hasWhatsApp: boolean | null;
};

function isGreenApiConfigured(): boolean {
  return !!(process.env.GREEN_API_INSTANCE_ID && process.env.GREEN_API_TOKEN);
}

/** ממיר מספר ישראלי לפורמט בינלאומי ל-Green API (972...) */
export function formatPhoneForWhatsApp(rawPhone: string): string {
  const digits = rawPhone.replace(/\D/g, '');
  if (digits.startsWith('972')) return digits;
  if (digits.startsWith('0')) return `972${digits.slice(1)}`;
  return digits;
}

/** בודק אם למספר יש WhatsApp (Green API). null = API לא מוגדר. */
export async function checkHasWhatsApp(rawPhone: string): Promise<boolean | null> {
  if (!isGreenApiConfigured()) return null;

  const instanceId = process.env.GREEN_API_INSTANCE_ID!;
  const token = process.env.GREEN_API_TOKEN!;
  const phoneNumber = formatPhoneForWhatsApp(rawPhone);

  try {
    const res = await fetch(
      `https://api.green-api.com/waInstance${instanceId}/checkWhatsapp/${token}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber }),
      },
    );

    if (!res.ok) {
      logger.error('Green API checkWhatsapp failed', { status: res.status });
      return null;
    }

    const data = (await res.json()) as { existsWhatsapp?: boolean };
    return !!data.existsWhatsapp;
  } catch (error) {
    logger.error('Green API checkWhatsapp error', { error });
    return null;
  }
}

async function sendGreenApiMessage(rawPhone: string, message: string): Promise<boolean> {
  if (!isGreenApiConfigured()) return false;

  const instanceId = process.env.GREEN_API_INSTANCE_ID!;
  const token = process.env.GREEN_API_TOKEN!;
  const chatId = `${formatPhoneForWhatsApp(rawPhone)}@c.us`;

  try {
    const res = await fetch(
      `https://api.green-api.com/waInstance${instanceId}/sendMessage/${token}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, message }),
      },
    );

    if (!res.ok) {
      logger.error('Green API sendMessage failed', { status: res.status });
      return false;
    }

    logger.info('WhatsApp sent', { phone: rawPhone });
    return true;
  } catch (error) {
    logger.error('Green API sendMessage error', { error });
    return false;
  }
}

async function deliverWhatsApp(
  phone: string,
  message: string,
  type: string,
): Promise<WhatsAppSendResult> {
  if (isGreenApiConfigured()) {
    const hasWhatsApp = await checkHasWhatsApp(phone);
    if (hasWhatsApp === false) {
      logger.info('WhatsApp skipped — no WhatsApp on number', { phone, type });
      return { sent: false, simulated: false, hasWhatsApp: false };
    }

    const sent = await sendGreenApiMessage(phone, message);
    return { sent, simulated: false, hasWhatsApp: hasWhatsApp ?? true };
  }

  logger.info('WhatsApp simulation (API not configured)', { type, phone, message });
  return { sent: false, simulated: true, hasWhatsApp: null };
}

// ==========================================
// 1. הקפצת אופציה (Bump Option)
// ==========================================
export const sendBumpWhatsApp = async (
  clientPhone: string,
  clientName: string,
  eventDate: string,
  deadline: Date,
): Promise<WhatsAppSendResult> => {
  const deadlineStr = deadline.toLocaleString('he-IL', { hour: '2-digit', minute: '2-digit' });
  const dateStr = new Date(eventDate).toLocaleDateString('he-IL');

  // בוואטסאפ אנחנו משתמשים בכוכבית (*) כדי להדגיש טקסט (Bold)
  const message = `שלום *${clientName}*,\n\n` +
    `אנו מודים לך שבחרת להתעניין בקיום האירוע שלך בגן האירועים *מייפל* 🍁.\n` +
    `התאריך ששמרת כאופציה (*${dateStr}*) הינו מבוקש מאוד, וכרגע יש לקוח נוסף שמעוניין לסגור אירוע במועד זה.\n\n` +
    `⏳ *החלטה דחופה נדרשת:*\n` +
    `על מנת להבטיח את התאריך שלך, אנא צור איתנו קשר עד השעה *${deadlineStr}*.\n` +
    `לאחר שעה זו, האופציה תשתחרר אוטומטית והתאריך יהיה פנוי ללקוח הבא.\n\n` +
    `נשמח לחגוג איתכם!\n` +
    `*צוות מייפל - גן אירועים בעיר*\n` +
    `טלפון: 03-6777772\n` +
    `--------------------------\n` +
    `🤖 _הודעה זו נשלחה אוטומטית מהמערכת._\n` +
    `_ניתן להשיב להודעה זו בכל שאלה ונציג יחזור אליכם._`;

  return deliverWhatsApp(clientPhone, message, 'הקפצת אופציה');
};

const simulateWhatsApp = async (phone: string, message: string, type: string): Promise<boolean> => {
  const result = await deliverWhatsApp(phone, message, type);
  return result.sent;
};

// ==========================================
// 2. התראה על אי השלמת בחירות - נודניק לקוח
// ==========================================
export const sendSelectionReminderWhatsApp = async (clientPhone: string, clientName: string, missingItems: string[]) => {
  const message = `שלום *${clientName}*,\n\n` +
    `האירוע שלכם ב-*מייפל* הולך ומתקרב, ואנחנו מתרגשים יחד איתכם! 🎉\n` +
    `שמנו לב שטרם סיימתם לבחור את הפרטים הבאים למערכת:\n` +
    `*${missingItems.join(', ')}*\n\n` +
    `אנא היכנסו למערכת או צרו איתנו קשר בהקדם כדי שנוכל להיערך מראש ולהפיק לכם אירוע מושלם.\n\n` +
    `צוות מייפל 🍁\n` +
    `--------------------------\n` +
    `🤖 _הודעה זו נשלחה אוטומטית מהמערכת._\n` +
    `_ניתן להשיב להודעה זו בכל שאלה ונציג יחזור אליכם._`;

  return simulateWhatsApp(clientPhone, message, 'בחירות חסרות');
};

// ==========================================
// 3. התראה על חוסר בצ'ק ביטחון - נודניק לקוח
// ==========================================
export const sendSecurityCheckReminderWhatsApp = async (clientPhone: string, clientName: string) => {
  const message = `שלום *${clientName}*,\n\n` +
    `מזל טוב על סגירת האירוע בגן האירועים *מייפל*! 🍁\n` +
    `שמנו לב שעברו 24 שעות מחתימת החוזה וטרם התקבל צ'ק ביטחון כנדרש בחוזה.\n` +
    `נשמח לקבלו בהקדם כדי שנוכל להבטיח את שריון התאריך באופן סופי.\n\n` +
    `תודה,\nצוות מייפל\n` +
    `--------------------------\n` +
    `🤖 _הודעה זו נשלחה אוטומטית מהמערכת._\n` +
    `_ניתן להשיב להודעה זו בכל שאלה ונציג יחזור אליכם._`;

  return simulateWhatsApp(clientPhone, message, 'צ\'ק ביטחון - לקוח');
};

// ==========================================
// 4. התראות פיננסיות פנימיות - למנהל האולם
// ==========================================
export const sendManagerFinancialAlert = async (managerPhone: string, alertType: string, clientName: string, details: string) => {
  // התראות למנהל הן קצרות ופנימיות, לא צריך את הערת ה"הודעה אוטומטית"
  const message = `⚠️ *התראת מערכת - ניהול כספים* ⚠️\n\n` +
    `*לקוח:* ${clientName}\n` +
    `*סוג התראה:* ${alertType}\n` +
    `*פרטים:* ${details}\n\n` +
    `יש ליצור קשר עם הלקוח לטיפול מיידי.`;

  return simulateWhatsApp(managerPhone, message, 'התראת מנהל');
};

// ==========================================
// 4b. תזכורת תשלום בפיגור — ללקוח
// ==========================================
export const sendPaymentOverdueReminderWhatsApp = async (
  clientPhone: string,
  clientName: string,
  bodyText: string,
): Promise<WhatsAppSendResult> => {
  const firstName = clientName?.split(' ')[0] || 'יקרים שלנו';
  const message =
    `שלום *${firstName}*,\n\n${bodyText}\n\n` +
    `*צוות מייפל - גן אירועים*\nטלפון: 03-6777772\n` +
    `--------------------------\n` +
    `🤖 _הודעה זו נשלחה אוטומטית מהמערכת._\n` +
    `_ניתן להשיב להודעה זו בכל שאלה ונציג יחזור אליכם._`;

  return deliverWhatsApp(clientPhone, message, 'תזכורת תשלום');
};

// ==========================================
// 5. בקשת משוב לאחר סיום אירוע (חדש!)
// ==========================================
export const sendFeedbackRequestWhatsApp = async (
  clientPhone: string,
  clientName: string | null,
  link: string,
): Promise<WhatsAppSendResult> => {
  const name = clientName ? clientName.split(' ')[0] : 'יקרים שלנו';
  const message = `היי *${name}*, תודה שחגגתם איתנו! 🎉\n\n` +
    `היה לנו לעונג לארח אתכם בגן האירועים *מייפל* 🍁.\n` +
    `נשמח מאוד אם תוכלו להקדיש דקה קטנה מזמנכם כדי לשתף אותנו איך היה, ולעזור לנו להמשיך להשתפר:\n\n` +
    `${link}\n\n` +
    `_(שימו לב: הקישור אישי וניתן למילוי פעם אחת בלבד)_\n\n` +
    `צוות האולם ❤️\n` +
    `--------------------------\n` +
    `🤖 _הודעה זו נשלחה אוטומטית מהמערכת._`;

  return deliverWhatsApp(clientPhone, message, 'בקשת משוב');
};

export const sendGreetingWhatsApp = async (
  clientPhone: string,
  clientName: string,
  message: string,
): Promise<WhatsAppSendResult> => {
  const formatted = `שלום *${clientName}*,\n\n${message}\n\n*צוות מייפל - גן אירועים*\nטלפון: 03-6777772\n--------------------------\n🤖 _הודעה זו נשלחה מהמערכת._`;
  return deliverWhatsApp(clientPhone, formatted, 'ברכה ללקוח');
};

// ==========================================
// פונקציית עזר להדפסת הלוגים (סימולציה של שליחה)
// ==========================================
function buildOptionInterestText(clientName: string, eventDate: string, customMessage?: string): string {
  if (customMessage?.trim()) return customMessage.trim();
  const dateStr = new Date(eventDate).toLocaleDateString('he-IL');
  return `שלום ${clientName}, מתענינים בתאריך שלך (${dateStr}) בגן האירועים מייפל. נשמח לשמוע ממך בהקדם.`;
}

// ==========================================
// 6. הודעת עניין באופציה (מתענינים בתאריך שלך)
// ==========================================
export const sendOptionInterestWhatsApp = async (
  clientPhone: string,
  clientName: string,
  eventDate: string,
  customMessage?: string,
): Promise<WhatsAppSendResult> => {
  const bodyText = buildOptionInterestText(clientName, eventDate, customMessage);
  const message = `${bodyText}\n\n*צוות מייפל - גן אירועים בעיר*\nטלפון: 03-6777772\n--------------------------\n🤖 _הודעה זו נשלחה מהמערכת._\n_ניתן להשיב להודעה זו בכל שאלה ונציג יחזור אליכם._`;

  return deliverWhatsApp(clientPhone, message, 'עניין באופציה');
};