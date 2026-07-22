import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';
import { logger } from './logger';
import {
  DEFAULT_LOCALE,
  getServerTranslation,
  T,
  type Locale,
  type Translator,
} from '../i18n/getServerTranslation';

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

import { getBrandConfig } from '../vendor/shared/brand/index';

export function getFromAddress(locale: Locale = DEFAULT_LOCALE): string {
  const brand = getBrandConfig();
  return `"${brand.messaging.emailFromName}" <${getEmailUser() || brand.supportEmail}>`;
}

function getAlertsFromAddress(locale: Locale = DEFAULT_LOCALE): string {
  const brand = getBrandConfig();
  return `"${brand.messaging.emailAlertsFromName}" <${getEmailUser() || brand.supportEmail}>`;
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

export function mailFailureMessage(
  reason: MailFailureReason,
  locale: Locale = DEFAULT_LOCALE,
): string {
  const { t } = getServerTranslation(locale);
  switch (reason) {
    case 'missing_config':
      return t(T.SERVER.MAIL.FAILURE.MISSING_CONFIG);
    case 'auth_failed':
      return t(T.SERVER.MAIL.FAILURE.AUTH_FAILED);
    default:
      return t(T.SERVER.MAIL.FAILURE.UNKNOWN);
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

function logoHeaderHtml(t: Translator['t']): string {
  if (fs.existsSync(LOGO_PATH)) {
    return `<img src="cid:mapleLogo" alt="${t(T.SERVER.COMMON.FROM_NAME)}" style="max-width: 200px; height: auto; display: block; margin: 0 auto;" />`;
  }
  return `<div style="font-size: 1.5rem; font-weight: bold; color: #5a8f6b;">${t(T.SERVER.COMMON.FROM_NAME)}</div>`;
}

function emailFooterHtml(t: Translator['t'], includeReply = true): string {
  return `
    <div style="background-color: #f3f4f6; padding: 15px; text-align: center; color: #6b7280; font-size: 0.85rem;">
      ${t(T.SERVER.COMMON.AUTO_FOOTER)}<br/>
      ${includeReply ? `<strong>${t(T.SERVER.COMMON.AUTO_FOOTER_REPLY)}</strong>` : ''}
    </div>`;
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

function formatLocaleDate(dateInput: string | Date, locale: Locale): string {
  return new Date(dateInput).toLocaleDateString(locale === 'he' ? 'he-IL' : 'en-US');
}

function formatLocaleDateTime(date: Date, locale: Locale): string {
  return date.toLocaleString(locale === 'he' ? 'he-IL' : 'en-US', { hour: '2-digit', minute: '2-digit' });
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
    logger.error(`Mail send error (${simulationLabel}):`, error);
    return { ok: false, reason };
  }
}

export const sendBumpEmail = async (
  clientEmail: string,
  clientName: string,
  eventDate: string,
  deadline: Date,
  locale: Locale = DEFAULT_LOCALE,
): Promise<MailDeliveryResult> => {
  const { t } = getServerTranslation(locale);
  const deadlineStr = formatLocaleDateTime(deadline, locale);
  const dateStr = formatLocaleDate(eventDate, locale);
  const team = t(T.SERVER.COMMON.TEAM_CITY);
  const phone = t(T.SERVER.COMMON.PHONE);

  const mailOptions = {
    from: getFromAddress(locale),
    to: clientEmail,
    subject: t(T.SERVER.MAIL.BUMP.SUBJECT, { date: dateStr }),
    html: `
      <div style="font-family: Arial, sans-serif; direction: rtl; text-align: right; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
        <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-bottom: 3px solid #d97706;">
          ${logoHeaderHtml(t)}
          <h2 style="color: #1f2937; margin: 15px 0 0 0;">${t(T.SERVER.MAIL.BUMP.HEADING)}</h2>
        </div>
        <div style="padding: 25px;">
          <p style="font-size: 1.1rem;">${t(T.SERVER.MAIL.BUMP.GREETING, { clientName })}</p>
          <p style="font-size: 1.05rem; line-height: 1.5;">${t(T.SERVER.MAIL.BUMP.BODY, { date: dateStr })}</p>
          <div style="background-color: #fffbeb; border: 1px solid #fcd34d; border-radius: 6px; padding: 15px; margin: 25px 0; text-align: center;">
            <p style="color: #92400e; font-size: 1.1rem; margin: 0; font-weight: bold;">
              ${t(T.SERVER.MAIL.BUMP.DEADLINE, { deadline: deadlineStr })}
            </p>
            <p style="color: #d97706; font-size: 0.9rem; margin-top: 5px;">
              ${t(T.SERVER.MAIL.BUMP.RELEASE_NOTE)}
            </p>
          </div>
          <p style="font-size: 1rem; margin-bottom: 30px;">${t(T.SERVER.MAIL.BUMP.CLOSING, { team, phone })}</p>
        </div>
      </div>
    `,
    attachments: optionalLogoAttachment(),
  };

  return deliverMail(mailOptions, t(T.SERVER.MAIL.BUMP.LOG_LABEL, { email: clientEmail }));
};

export const sendSelectionReminderEmail = async (
  clientEmail: string,
  clientName: string,
  missingItems: string[],
  locale: Locale = DEFAULT_LOCALE,
): Promise<boolean> => {
  const { t } = getServerTranslation(locale);
  const team = t(T.SERVER.COMMON.TEAM);
  const phone = t(T.SERVER.COMMON.PHONE);

  const mailOptions = {
    from: getFromAddress(locale),
    to: clientEmail,
    subject: t(T.SERVER.MAIL.SELECTION_REMINDER.SUBJECT),
    html: `
      <div style="font-family: Arial, sans-serif; direction: rtl; text-align: right; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
        <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-bottom: 3px solid #6ee7b7;">
          ${logoHeaderHtml(t)}
          <h2 style="color: #1f2937; margin: 0;">${t(T.SERVER.MAIL.SELECTION_REMINDER.HEADING)}</h2>
        </div>
        <div style="padding: 25px;">
          <p style="font-size: 1.1rem;">${t(T.SERVER.MAIL.SELECTION_REMINDER.GREETING, { clientName })}</p>
          <p style="font-size: 1.05rem; line-height: 1.5;">${t(T.SERVER.MAIL.SELECTION_REMINDER.BODY)}</p>
          <ul style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 15px 35px; margin: 25px 0; color: #166534; font-size: 1.1rem; font-weight: bold;">
            ${missingItems.map((item) => `<li>${item}</li>`).join('')}
          </ul>
          <p style="font-size: 1rem; margin-bottom: 30px;">${t(T.SERVER.MAIL.SELECTION_REMINDER.CLOSING, { team, phone })}</p>
        </div>
        ${emailFooterHtml(t)}
      </div>
    `,
    attachments: optionalLogoAttachment(),
  };

  const result = await deliverMail(mailOptions, t(T.SERVER.MAIL.SELECTION_REMINDER.LOG_LABEL, { email: clientEmail }));
  return result.ok;
};

export const sendSecurityCheckReminderEmail = async (
  clientEmail: string,
  clientName: string,
  locale: Locale = DEFAULT_LOCALE,
): Promise<boolean> => {
  const { t } = getServerTranslation(locale);
  const team = t(T.SERVER.COMMON.TEAM);

  const mailOptions = {
    from: getFromAddress(locale),
    to: clientEmail,
    subject: t(T.SERVER.MAIL.SECURITY_CHECK.SUBJECT),
    html: `
      <div style="font-family: Arial, sans-serif; direction: rtl; text-align: right; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
        <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-bottom: 3px solid #fca5a5;">
          ${logoHeaderHtml(t)}
          <h2 style="color: #1f2937; margin: 0;">${t(T.SERVER.MAIL.SECURITY_CHECK.HEADING)}</h2>
        </div>
        <div style="padding: 25px;">
          <p style="font-size: 1.1rem;">${t(T.SERVER.MAIL.SECURITY_CHECK.GREETING, { clientName })}</p>
          <p style="font-size: 1.05rem; line-height: 1.5;">${t(T.SERVER.MAIL.SECURITY_CHECK.BODY)}</p>
          <div style="background-color: #fef2f2; border: 1px solid #fca5a5; border-radius: 6px; padding: 15px; margin: 25px 0; text-align: center;">
            <p style="color: #991b1b; font-size: 1rem; margin: 0; font-weight: bold;">
              ${t(T.SERVER.MAIL.SECURITY_CHECK.ACTION)}
            </p>
          </div>
          <p style="font-size: 1rem; margin-bottom: 30px;">${t(T.SERVER.MAIL.SECURITY_CHECK.CLOSING, { team })}</p>
        </div>
        ${emailFooterHtml(t)}
      </div>
    `,
    attachments: optionalLogoAttachment(),
  };

  const result = await deliverMail(mailOptions, t(T.SERVER.MAIL.SECURITY_CHECK.LOG_LABEL, { email: clientEmail }));
  return result.ok;
};

export const sendManagerFinancialAlertEmail = async (
  managerEmail: string,
  alertType: string,
  clientName: string,
  details: string,
  locale: Locale = DEFAULT_LOCALE,
): Promise<boolean> => {
  const { t } = getServerTranslation(locale);

  const mailOptions = {
    from: getAlertsFromAddress(locale),
    to: managerEmail,
    subject: t(T.SERVER.MAIL.MANAGER_ALERT.SUBJECT, { alertType, clientName }),
    html: `
      <div style="font-family: Arial, sans-serif; direction: rtl; text-align: right; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #ef4444; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #ef4444; padding: 15px; text-align: center;">
          <h2 style="color: #fff; margin: 0;">${t(T.SERVER.MAIL.MANAGER_ALERT.HEADING)}</h2>
        </div>
        <div style="padding: 25px; background-color: #fff;">
          <p><strong>${t(T.SERVER.MAIL.MANAGER_ALERT.CLIENT)}</strong> ${clientName}</p>
          <p><strong>${t(T.SERVER.MAIL.MANAGER_ALERT.ALERT_TYPE)}</strong> ${alertType}</p>
          <p><strong>${t(T.SERVER.MAIL.MANAGER_ALERT.DETAILS)}</strong> ${details}</p>
          <br/>
          <p style="color: #ef4444; font-weight: bold;">${t(T.SERVER.MAIL.MANAGER_ALERT.ACTION)}</p>
        </div>
      </div>
    `,
  };

  const result = await deliverMail(mailOptions, t(T.SERVER.MAIL.MANAGER_ALERT.LOG_LABEL, { email: managerEmail }));
  return result.ok;
};

export const sendPaymentOverdueReminderEmail = async (
  clientEmail: string,
  clientName: string,
  bodyText: string,
  remainingAmount: number,
  missedDeadline: Date,
  locale: Locale = DEFAULT_LOCALE,
): Promise<boolean> => {
  const { t } = getServerTranslation(locale);
  const deadlineStr = formatLocaleDate(missedDeadline, locale);
  const formattedBody = bodyText.replace(/\n/g, '<br/>');
  const team = t(T.SERVER.COMMON.TEAM);
  const phone = t(T.SERVER.COMMON.PHONE);

  const mailOptions = {
    from: getFromAddress(locale),
    to: clientEmail,
    subject: t(T.SERVER.MAIL.PAYMENT_OVERDUE.SUBJECT),
    html: `
      <div style="font-family: Arial, sans-serif; direction: rtl; text-align: right; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
        <div style="background-color: #fffbeb; padding: 20px; text-align: center; border-bottom: 3px solid #d97706;">
          ${logoHeaderHtml(t)}
          <h2 style="color: #92400e; margin: 0;">${t(T.SERVER.MAIL.PAYMENT_OVERDUE.HEADING)}</h2>
        </div>
        <div style="padding: 25px;">
          <p style="font-size: 1.1rem;">${t(T.SERVER.MAIL.PAYMENT_OVERDUE.GREETING, { clientName })}</p>
          <p style="font-size: 1.05rem; line-height: 1.6;">${formattedBody}</p>
          <div style="background-color: #fef3c7; border: 1px solid #fcd34d; border-radius: 6px; padding: 15px; margin: 20px 0;">
            <strong>${t(T.SERVER.MAIL.PAYMENT_OVERDUE.DEADLINE)}</strong> ${deadlineStr}<br/>
            <strong>${t(T.SERVER.MAIL.PAYMENT_OVERDUE.REMAINING)}</strong> ₪${Math.round(remainingAmount).toLocaleString(locale === 'he' ? 'he-IL' : 'en-US')}
          </div>
          <p style="font-size: 1rem;">${t(T.SERVER.MAIL.PAYMENT_OVERDUE.CLOSING, { phone, team })}</p>
        </div>
        <div style="background-color: #f3f4f6; padding: 15px; text-align: center; color: #6b7280; font-size: 0.85rem;">
          ${t(T.SERVER.COMMON.AUTO_FOOTER)}
        </div>
      </div>
    `,
    attachments: optionalLogoAttachment(),
  };

  const result = await deliverMail(mailOptions, t(T.SERVER.MAIL.PAYMENT_OVERDUE.LOG_LABEL, { email: clientEmail }));
  return result.ok;
};

export const sendFeedbackRequestEmail = async (
  clientEmail: string,
  clientName: string | null,
  link: string,
  locale: Locale = DEFAULT_LOCALE,
): Promise<MailDeliveryResult> => {
  const { t } = getServerTranslation(locale);
  const name = clientName ? clientName.split(' ')[0] : t(T.SERVER.COMMON.DEAR_CUSTOMERS);
  const team = t(T.SERVER.COMMON.TEAM);

  const mailOptions = {
    from: getFromAddress(locale),
    to: clientEmail,
    subject: t(T.SERVER.MAIL.FEEDBACK.SUBJECT),
    html: `
      <div style="font-family: Arial, sans-serif; direction: rtl; text-align: right; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
        <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-bottom: 3px solid #d8a051;">
          ${logoHeaderHtml(t)}
          <h2 style="color: #1f2937; margin: 0;">${t(T.SERVER.MAIL.FEEDBACK.HEADING)}</h2>
        </div>
        <div style="padding: 25px;">
          <p style="font-size: 1.1rem;">${t(T.SERVER.MAIL.FEEDBACK.GREETING, { name })}</p>
          <p style="font-size: 1.05rem; line-height: 1.5;">${t(T.SERVER.MAIL.FEEDBACK.BODY)}</p>
          <div style="text-align: center; margin: 35px 0;">
            <a href="${link}" style="background-color: #d97706; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 1.1rem; display: inline-block;">${t(T.SERVER.MAIL.FEEDBACK.CTA)}</a>
          </div>
          <p style="font-size: 0.9rem; color: #6b7280; text-align: center;">${t(T.SERVER.MAIL.FEEDBACK.SECURITY_NOTE)}</p>
          <p style="font-size: 1rem; margin-top: 30px; margin-bottom: 10px;">${t(T.SERVER.MAIL.FEEDBACK.CLOSING, { team })}</p>
        </div>
        <div style="background-color: #f3f4f6; padding: 15px; text-align: center; color: #6b7280; font-size: 0.85rem;">
          ${t(T.SERVER.COMMON.AUTO_FOOTER)}
        </div>
      </div>
    `,
    attachments: optionalLogoAttachment(),
  };

  return deliverMail(mailOptions, t(T.SERVER.MAIL.FEEDBACK.LOG_LABEL, { email: clientEmail }));
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
  return t(T.SERVER.MAIL.OPTION_INTEREST.DEFAULT_BODY, { clientName, date: dateStr });
}

export const sendOptionInterestEmail = async (
  clientEmail: string,
  clientName: string,
  eventDate: string,
  customMessage?: string,
  locale: Locale = DEFAULT_LOCALE,
): Promise<MailDeliveryResult> => {
  const { t } = getServerTranslation(locale);
  const bodyText = buildOptionInterestText(t, clientName, eventDate, locale, customMessage);
  const dateStr = formatLocaleDate(eventDate, locale);
  const escapedBody = bodyText.replace(/\n/g, '<br/>');
  const team = t(T.SERVER.COMMON.TEAM_CITY);
  const phone = t(T.SERVER.COMMON.PHONE);

  const mailOptions = {
    from: getFromAddress(locale),
    to: clientEmail,
    subject: t(T.SERVER.MAIL.OPTION_INTEREST.SUBJECT, { date: dateStr }),
    html: `
      <div style="font-family: Arial, sans-serif; direction: rtl; text-align: right; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
        <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-bottom: 3px solid #d97706;">
          ${logoHeaderHtml(t)}
          <h2 style="color: #1f2937; margin: 15px 0 0 0;">${t(T.SERVER.MAIL.OPTION_INTEREST.HEADING)}</h2>
        </div>
        <div style="padding: 25px;">
          <p style="font-size: 1.05rem; line-height: 1.6;">${escapedBody}</p>
          <p style="font-size: 1rem; margin-top: 30px;"><strong>${team}</strong><br/>${phone}</p>
        </div>
        ${emailFooterHtml(t)}
      </div>
    `,
    attachments: optionalLogoAttachment(),
  };

  return deliverMail(mailOptions, t(T.SERVER.MAIL.OPTION_INTEREST.LOG_LABEL, { email: clientEmail }));
};
