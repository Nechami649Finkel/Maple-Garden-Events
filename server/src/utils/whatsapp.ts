import {
  DEFAULT_LOCALE,
  getServerTranslation,
  T,
  type Locale,
  type Translator,
} from '../i18n/getServerTranslation';

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
      console.error(`Green API checkWhatsapp failed (${res.status})`);
      return null;
    }

    const data = (await res.json()) as { existsWhatsapp?: boolean };
    return !!data.existsWhatsapp;
  } catch (error) {
    console.error('Green API checkWhatsapp error:', error);
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
      console.error(`Green API sendMessage failed (${res.status})`);
      return false;
    }

    console.log(`✅ WhatsApp sent to ${rawPhone}`);
    return true;
  } catch (error) {
    console.error('Green API sendMessage error:', error);
    return false;
  }
}

function formatLocaleDate(dateInput: string | Date, locale: Locale): string {
  return new Date(dateInput).toLocaleDateString(locale === 'he' ? 'he-IL' : 'en-US');
}

function formatLocaleDateTime(date: Date, locale: Locale): string {
  return date.toLocaleString(locale === 'he' ? 'he-IL' : 'en-US', { hour: '2-digit', minute: '2-digit' });
}

function whatsappFooter(t: Translator['t']): string {
  return `\n--------------------------\n🤖 _${t(T.SERVER.COMMON.AUTO_FOOTER)}_\n_${t(T.SERVER.COMMON.AUTO_FOOTER_REPLY)}_`;
}

async function deliverWhatsApp(
  phone: string,
  message: string,
  type: string,
  locale: Locale = DEFAULT_LOCALE,
): Promise<WhatsAppSendResult> {
  const { t } = getServerTranslation(locale);

  if (isGreenApiConfigured()) {
    const hasWhatsApp = await checkHasWhatsApp(phone);
    if (hasWhatsApp === false) {
      console.log(`[WHATSAPP] ${phone} — ${t(T.SERVER.WHATSAPP.NO_WHATSAPP, { type })}`);
      return { sent: false, simulated: false, hasWhatsApp: false };
    }

    const sent = await sendGreenApiMessage(phone, message);
    return { sent, simulated: false, hasWhatsApp: hasWhatsApp ?? true };
  }

  console.log(`\n[WHATSAPP SIMULATION - ${type}] ${phone}...`);
  console.log(`------------ message ------------\n${message}\n-------------------------------------`);
  console.log(`[WHATSAPP SIMULATION] (${t(T.SERVER.WHATSAPP.SIMULATION)})`);
  return { sent: false, simulated: true, hasWhatsApp: null };
}

export const sendBumpWhatsApp = async (
  clientPhone: string,
  clientName: string,
  eventDate: string,
  deadline: Date,
  locale: Locale = DEFAULT_LOCALE,
): Promise<WhatsAppSendResult> => {
  const { t } = getServerTranslation(locale);
  const deadlineStr = formatLocaleDateTime(deadline, locale);
  const dateStr = formatLocaleDate(eventDate, locale);
  const team = t(T.SERVER.COMMON.TEAM_CITY);
  const phone = t(T.SERVER.COMMON.PHONE);

  const message =
    `${t(T.SERVER.WHATSAPP.BUMP.GREETING, { clientName })}\n\n` +
    `${t(T.SERVER.WHATSAPP.BUMP.BODY, { date: dateStr })}\n\n` +
    `${t(T.SERVER.WHATSAPP.BUMP.URGENT)}\n` +
    `${t(T.SERVER.WHATSAPP.BUMP.DEADLINE, { deadline: deadlineStr })}\n` +
    `${t(T.SERVER.WHATSAPP.BUMP.RELEASE)}\n\n` +
    `${t(T.SERVER.WHATSAPP.BUMP.CLOSING, { team, phone })}` +
    whatsappFooter(t);

  return deliverWhatsApp(clientPhone, message, t(T.SERVER.WHATSAPP.BUMP.LOG_TYPE), locale);
};

const simulateWhatsApp = async (
  phone: string,
  message: string,
  type: string,
  locale: Locale = DEFAULT_LOCALE,
): Promise<boolean> => {
  const result = await deliverWhatsApp(phone, message, type, locale);
  return result.sent;
};

export const sendSelectionReminderWhatsApp = async (
  clientPhone: string,
  clientName: string,
  missingItems: string[],
  locale: Locale = DEFAULT_LOCALE,
) => {
  const { t } = getServerTranslation(locale);
  const message =
    `${t(T.SERVER.WHATSAPP.SELECTION_REMINDER.GREETING, { clientName })}\n\n` +
    `${t(T.SERVER.WHATSAPP.SELECTION_REMINDER.BODY, { items: missingItems.join(', ') })}\n\n` +
    `${t(T.SERVER.WHATSAPP.SELECTION_REMINDER.CLOSING, { team: t(T.SERVER.COMMON.TEAM) })}` +
    whatsappFooter(t);

  return simulateWhatsApp(
    clientPhone,
    message,
    t(T.SERVER.WHATSAPP.SELECTION_REMINDER.LOG_TYPE),
    locale,
  );
};

export const sendSecurityCheckReminderWhatsApp = async (
  clientPhone: string,
  clientName: string,
  locale: Locale = DEFAULT_LOCALE,
) => {
  const { t } = getServerTranslation(locale);
  const message =
    `${t(T.SERVER.WHATSAPP.SECURITY_CHECK.GREETING, { clientName })}\n\n` +
    `${t(T.SERVER.WHATSAPP.SECURITY_CHECK.BODY)}\n` +
    `${t(T.SERVER.WHATSAPP.SECURITY_CHECK.ACTION)}\n\n` +
    `${t(T.SERVER.WHATSAPP.SECURITY_CHECK.CLOSING, { team: t(T.SERVER.COMMON.TEAM) })}` +
    whatsappFooter(t);

  return simulateWhatsApp(
    clientPhone,
    message,
    t(T.SERVER.WHATSAPP.SECURITY_CHECK.LOG_TYPE),
    locale,
  );
};

export const sendManagerFinancialAlert = async (
  managerPhone: string,
  alertType: string,
  clientName: string,
  details: string,
  locale: Locale = DEFAULT_LOCALE,
) => {
  const { t } = getServerTranslation(locale);
  const message =
    `${t(T.SERVER.WHATSAPP.MANAGER_ALERT.HEADING)}\n\n` +
    `${t(T.SERVER.WHATSAPP.MANAGER_ALERT.CLIENT)} ${clientName}\n` +
    `${t(T.SERVER.WHATSAPP.MANAGER_ALERT.ALERT_TYPE)} ${alertType}\n` +
    `${t(T.SERVER.WHATSAPP.MANAGER_ALERT.DETAILS)} ${details}\n\n` +
    `${t(T.SERVER.WHATSAPP.MANAGER_ALERT.ACTION)}`;

  return simulateWhatsApp(
    managerPhone,
    message,
    t(T.SERVER.WHATSAPP.MANAGER_ALERT.LOG_TYPE),
    locale,
  );
};

export const sendPaymentOverdueReminderWhatsApp = async (
  clientPhone: string,
  clientName: string,
  bodyText: string,
  locale: Locale = DEFAULT_LOCALE,
): Promise<WhatsAppSendResult> => {
  const { t } = getServerTranslation(locale);
  const firstName = clientName?.split(' ')[0] || t(T.SERVER.COMMON.DEAR_GUEST);
  const message =
    `${t(T.SERVER.WHATSAPP.PAYMENT_OVERDUE.GREETING, { name: firstName })}\n\n${bodyText}\n\n` +
    `${t(T.SERVER.WHATSAPP.PAYMENT_OVERDUE.CLOSING, {
      team: t(T.SERVER.COMMON.TEAM_CITY),
      phone: t(T.SERVER.COMMON.PHONE),
    })}` +
    whatsappFooter(t);

  return deliverWhatsApp(
    clientPhone,
    message,
    t(T.SERVER.WHATSAPP.PAYMENT_OVERDUE.LOG_TYPE),
    locale,
  );
};

export const sendFeedbackRequestWhatsApp = async (
  clientPhone: string,
  clientName: string | null,
  link: string,
  locale: Locale = DEFAULT_LOCALE,
): Promise<WhatsAppSendResult> => {
  const { t } = getServerTranslation(locale);
  const name = clientName ? clientName.split(' ')[0] : t(T.SERVER.COMMON.DEAR_GUEST);
  const message =
    `${t(T.SERVER.WHATSAPP.FEEDBACK.GREETING, { name })}\n\n` +
    `${t(T.SERVER.WHATSAPP.FEEDBACK.BODY, { link })}\n` +
    `${t(T.SERVER.WHATSAPP.FEEDBACK.SECURITY_NOTE)}\n\n` +
    `${t(T.SERVER.WHATSAPP.FEEDBACK.CLOSING)}\n` +
    `\n--------------------------\n🤖 _${t(T.SERVER.COMMON.AUTO_FOOTER)}_`;

  return deliverWhatsApp(
    clientPhone,
    message,
    t(T.SERVER.WHATSAPP.FEEDBACK.LOG_TYPE),
    locale,
  );
};

export const sendGreetingWhatsApp = async (
  clientPhone: string,
  clientName: string,
  message: string,
  locale: Locale = DEFAULT_LOCALE,
): Promise<WhatsAppSendResult> => {
  const { t } = getServerTranslation(locale);
  const formatted =
    `${t(T.SERVER.WHATSAPP.GREETING.GREETING, { clientName })}\n\n${message}\n\n` +
    `${t(T.SERVER.WHATSAPP.GREETING.CLOSING, {
      team: t(T.SERVER.COMMON.TEAM_CITY),
      phone: t(T.SERVER.COMMON.PHONE),
    })}\n--------------------------\n🤖 _${t(T.SERVER.COMMON.AUTO_FOOTER)}_`;

  return deliverWhatsApp(
    clientPhone,
    formatted,
    t(T.SERVER.WHATSAPP.GREETING.LOG_TYPE),
    locale,
  );
};

function buildOptionInterestText(
  t: Translator['t'],
  clientName: string,
  eventDate: string,
  locale: Locale,
  customMessage?: string,
): string {
  if (customMessage?.trim()) return customMessage.trim();
  const dateStr = formatLocaleDate(eventDate, locale);
  return t(T.SERVER.WHATSAPP.OPTION_INTEREST.DEFAULT_BODY, { clientName, date: dateStr });
}

export const sendOptionInterestWhatsApp = async (
  clientPhone: string,
  clientName: string,
  eventDate: string,
  customMessage?: string,
  locale: Locale = DEFAULT_LOCALE,
): Promise<WhatsAppSendResult> => {
  const { t } = getServerTranslation(locale);
  const bodyText = buildOptionInterestText(t, clientName, eventDate, locale, customMessage);
  const message =
    `${bodyText}\n\n${t(T.SERVER.WHATSAPP.OPTION_INTEREST.CLOSING, {
      team: t(T.SERVER.COMMON.TEAM_CITY),
      phone: t(T.SERVER.COMMON.PHONE),
    })}\n--------------------------\n🤖 _${t(T.SERVER.COMMON.AUTO_FOOTER)}_\n_${t(T.SERVER.COMMON.AUTO_FOOTER_REPLY)}_`;

  return deliverWhatsApp(
    clientPhone,
    message,
    t(T.SERVER.WHATSAPP.OPTION_INTEREST.LOG_TYPE),
    locale,
  );
};
