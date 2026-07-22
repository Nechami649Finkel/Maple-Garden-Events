import fs from 'fs/promises';
import path from 'path';
import prisma from '../config/prisma';
import { deliverMail, getFromAddress, mailFailureMessage, type MailDeliveryResult } from '../utils/mailer';
import { logger } from '../utils/logger';
import { sendGreetingWhatsApp } from '../utils/whatsapp';

const GREETING_UPLOAD_DIR = path.resolve(__dirname, '../../uploads/greetings');

export type GreetingClient = {
  name: string;
  email: string | null;
  phone: string | null;
};

export type GreetingSendStats = {
  emailSent: number;
  whatsappSent: number;
  emailSkipped: number;
  whatsappSkipped: number;
  skippedReasons: string[];
};

type AttachmentPayload = {
  filename: string;
  buffer: Buffer;
};

export function parseScheduledAt(scheduledDate: string, scheduledTime: string): Date {
  const scheduled = new Date(`${scheduledDate}T${scheduledTime}:00`);
  if (Number.isNaN(scheduled.getTime())) {
    throw new Error('תאריך או שעה לא תקינים');
  }
  return scheduled;
}

export function isFutureSchedule(scheduledAt: Date): boolean {
  return scheduledAt.getTime() > Date.now() + 30_000;
}

async function sendGreetingEmail(
  email: string,
  name: string,
  subject: string,
  message: string,
  attachment?: AttachmentPayload,
): Promise<MailDeliveryResult> {
  return deliverMail(
    {
      from: getFromAddress(),
      to: email,
      subject,
      html: `
      <div style="font-family: Arial, sans-serif; direction: rtl; text-align: right; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #1e293b; padding: 20px; text-align: center;">
          <h2 style="color: #fff; margin: 0;">גן אירועים מייפל 🍁</h2>
        </div>
        <div style="padding: 25px;">
          <p style="font-size: 1.05rem;">שלום <strong>${name}</strong>,</p>
          <div style="font-size: 1rem; line-height: 1.7; white-space: pre-line;">${message}</div>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
          <p style="color: #64748b; font-size: 0.85rem;">בברכה,<br/><strong>צוות מייפל - גן אירועים</strong></p>
        </div>
      </div>
    `,
      attachments: attachment
        ? [{ filename: attachment.filename, content: attachment.buffer }]
        : [],
    },
    `ברכה ל-${email}`,
  );
}

export function buildClientList(
  bookings: Array<{
    clientAFullName: string;
    clientAEmail: string | null;
    clientAPhone: string;
    clientBFullName: string | null;
    clientBEmail: string | null;
    clientBPhone: string | null;
  }>,
): GreetingClient[] {
  const clientMap = new Map<string, GreetingClient>();

  for (const b of bookings) {
    const phoneA = b.clientAPhone?.split(' | ')[0].trim() || null;
    if (!clientMap.has(b.clientAFullName)) {
      clientMap.set(b.clientAFullName, {
        name: b.clientAFullName,
        email: b.clientAEmail || null,
        phone: phoneA,
      });
    }
    if (b.clientBFullName) {
      const phoneB = b.clientBPhone?.split(' | ')[0].trim() || null;
      if (!clientMap.has(b.clientBFullName)) {
        clientMap.set(b.clientBFullName, {
          name: b.clientBFullName,
          email: b.clientBEmail || null,
          phone: phoneB,
        });
      }
    }
  }

  return Array.from(clientMap.values());
}

export async function fetchGreetingClients(): Promise<GreetingClient[]> {
  const bookings = await prisma.booking.findMany({
    select: {
      clientAFullName: true,
      clientAEmail: true,
      clientAPhone: true,
      clientBFullName: true,
      clientBEmail: true,
      clientBPhone: true,
    },
  });
  return buildClientList(bookings);
}

export async function sendToAllClients(
  clients: GreetingClient[],
  subject: string,
  message: string,
  attachment?: AttachmentPayload,
): Promise<GreetingSendStats> {
  const stats: GreetingSendStats = {
    emailSent: 0,
    whatsappSent: 0,
    emailSkipped: 0,
    whatsappSkipped: 0,
    skippedReasons: [],
  };

  for (const client of clients) {
    if (client.email) {
      const result = await sendGreetingEmail(client.email, client.name, subject, message, attachment);
      if (result.ok && !('simulated' in result && result.simulated)) {
        stats.emailSent++;
      } else {
        stats.emailSkipped++;
        if (!result.ok && result.reason) {
          stats.skippedReasons.push(mailFailureMessage(result.reason));
        } else if (result.ok && 'simulated' in result && result.simulated) {
          stats.skippedReasons.push('מייל: לא מוגדר בשרת (לא נשלח בפועל)');
        }
      }
    } else {
      stats.emailSkipped++;
      stats.skippedReasons.push(`ל-${client.name} חסר מייל`);
    }

    if (client.phone) {
      const waResult = await sendGreetingWhatsApp(client.phone, client.name, message);
      if (waResult.sent) {
        stats.whatsappSent++;
      } else {
        stats.whatsappSkipped++;
        if (waResult.hasWhatsApp === false) {
          stats.skippedReasons.push(`ל-${client.name} אין וואטסאפ`);
        } else if (waResult.simulated) {
          stats.skippedReasons.push('וואטסאפ: לא מוגדר (לא נשלח בפועל)');
        }
      }
    } else {
      stats.whatsappSkipped++;
    }
  }

  stats.skippedReasons = [...new Set(stats.skippedReasons)];
  logger.info(
    `[GREETING] מיילים: ${stats.emailSent}, וואטסאפ: ${stats.whatsappSent}, לקוחות: ${clients.length}`,
  );
  return stats;
}

export function formatResultMessage(stats: GreetingSendStats, clientCount: number): string {
  const parts: string[] = [];
  if (stats.emailSent > 0) parts.push(`נשלחו ${stats.emailSent} מיילים`);
  if (stats.whatsappSent > 0) parts.push(`נשלחו ${stats.whatsappSent} הודעות וואטסאפ`);
  if (parts.length === 0) {
    return stats.skippedReasons[0] || 'לא נשלח — בדקי שיש ללקוחות מייל והגדרות Gmail בשרת.';
  }
  if (stats.skippedReasons.length > 0) {
    parts.push(`(${clientCount} לקוחות בסך הכל)`);
  }
  return parts.join(', ');
}

export async function saveGreetingAttachment(
  greetingId: string,
  file: Express.Multer.File,
): Promise<{ attachmentPath: string; attachmentName: string }> {
  await fs.mkdir(GREETING_UPLOAD_DIR, { recursive: true });
  const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
  const attachmentPath = path.join(GREETING_UPLOAD_DIR, `${greetingId}_${safeName}`);
  await fs.writeFile(attachmentPath, file.buffer);
  return { attachmentPath, attachmentName: file.originalname };
}

async function loadAttachment(
  attachmentPath: string | null,
  attachmentName: string | null,
): Promise<AttachmentPayload | undefined> {
  if (!attachmentPath || !attachmentName) return undefined;
  try {
    const buffer = await fs.readFile(attachmentPath);
    return { filename: attachmentName, buffer };
  } catch {
    logger.warn(`[GREETING] קובץ מצורף לא נמצא: ${attachmentPath}`);
    return undefined;
  }
}

async function removeAttachment(attachmentPath: string | null): Promise<void> {
  if (!attachmentPath) return;
  try {
    await fs.unlink(attachmentPath);
  } catch {
    // ignore missing file
  }
}

export async function scheduleGreeting(params: {
  tenantId: string;
  subject: string;
  message: string;
  scheduledAt: Date;
  file?: Express.Multer.File;
  createdBy?: string;
}) {
  const greeting = await prisma.scheduledGreeting.create({
    data: {
      tenantId: params.tenantId,
      subject: params.subject,
      message: params.message,
      scheduledAt: params.scheduledAt,
      createdBy: params.createdBy,
    },
  });

  if (params.file) {
    const saved = await saveGreetingAttachment(greeting.id, params.file);
    await prisma.scheduledGreeting.update({
      where: { id: greeting.id },
      data: saved,
    });
  }

  return greeting;
}

export async function processDueScheduledGreetings(): Promise<number> {
  const dueGreetings = await prisma.scheduledGreeting.findMany({
    where: {
      status: 'PENDING',
      scheduledAt: { lte: new Date() },
    },
    orderBy: { scheduledAt: 'asc' },
    take: 10,
  });

  if (dueGreetings.length === 0) return 0;

  for (const greeting of dueGreetings) {
    const claimed = await prisma.scheduledGreeting.updateMany({
      where: { id: greeting.id, status: 'PENDING' },
      data: { status: 'PROCESSING' },
    });

    if (claimed.count === 0) continue;

    try {
      const clients = await fetchGreetingClients();
      const attachment = await loadAttachment(greeting.attachmentPath, greeting.attachmentName);
      const stats = await sendToAllClients(clients, greeting.subject, greeting.message, attachment);

      if (stats.emailSent === 0 && stats.whatsappSent === 0) {
        await prisma.scheduledGreeting.update({
          where: { id: greeting.id },
          data: {
            status: 'FAILED',
            errorMessage: formatResultMessage(stats, clients.length),
            sendStats: stats,
          },
        });
        logger.warn(`[GREETING] ברכה מתוזמנת ${greeting.id} נכשלה — אין נמענים`);
        continue;
      }

      await prisma.scheduledGreeting.update({
        where: { id: greeting.id },
        data: {
          status: 'SENT',
          sentAt: new Date(),
          sendStats: stats,
          errorMessage: null,
        },
      });
      await removeAttachment(greeting.attachmentPath);
      logger.info(`[GREETING] ברכה מתוזמנת ${greeting.id} נשלחה בהצלחה`);
    } catch (error) {
      await prisma.scheduledGreeting.update({
        where: { id: greeting.id },
        data: {
          status: 'FAILED',
          errorMessage: error instanceof Error ? error.message : 'שגיאה לא ידועה',
        },
      });
      logger.error(`[GREETING] שגיאה בשליחת ברכה מתוזמנת ${greeting.id}:`, error);
    }
  }

  return dueGreetings.length;
}

export async function listScheduledGreetings(limit = 50) {
  return prisma.scheduledGreeting.findMany({
    orderBy: [{ scheduledAt: 'desc' }, { createdAt: 'desc' }],
    take: limit,
    select: {
      id: true,
      subject: true,
      message: true,
      scheduledAt: true,
      attachmentName: true,
      status: true,
      sentAt: true,
      sendStats: true,
      errorMessage: true,
      createdBy: true,
      createdAt: true,
    },
  });
}

export async function cancelScheduledGreeting(id: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  const greeting = await prisma.scheduledGreeting.findUnique({ where: { id } });
  if (!greeting) {
    return { ok: false, reason: 'ברכה מתוזמנת לא נמצאה.' };
  }
  if (greeting.status !== 'PENDING') {
    return { ok: false, reason: 'ניתן לבטל רק ברכות שעדיין ממתינות לשליחה.' };
  }

  await prisma.scheduledGreeting.update({
    where: { id },
    data: { status: 'CANCELLED' },
  });
  await removeAttachment(greeting.attachmentPath);
  return { ok: true };
}
