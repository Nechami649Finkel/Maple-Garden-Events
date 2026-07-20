import prisma from '../config/prisma';
import { neonTransactionOptions } from './dbRetry';
import { logger } from './logger';

type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

const SETTINGS_ID = 'global';
const PAD_LENGTH = 5;
const CODE_PATTERN = /^(OPT|EVT)-(\d+)$/;

export type EventCodePrefix = 'OPT' | 'EVT';

export function isFormattedEventCode(eventCode: string): boolean {
  return CODE_PATTERN.test(eventCode);
}

export function formatEventCode(prefix: EventCodePrefix, sequence: number): string {
  return `${prefix}-${String(sequence).padStart(PAD_LENGTH, '0')}`;
}

export function convertOptionCodeToEventCode(eventCode: string): string | null {
  const match = eventCode.match(/^OPT-(\d+)$/);
  if (match) {
    return formatEventCode('EVT', parseInt(match[1], 10));
  }
  if (/^EVT-\d+$/.test(eventCode)) {
    return eventCode;
  }
  return null;
}

function maxSequenceFromBookings(eventCodes: { eventCode: string }[]): number {
  let max = 0;
  for (const { eventCode } of eventCodes) {
    const match = eventCode.match(CODE_PATTERN);
    if (match) {
      max = Math.max(max, parseInt(match[2], 10));
    }
  }
  return max;
}

// פונקציית עזר לניסיון התחברות עם השהיה
async function withRetry<T>(fn: () => Promise<T>, retries = 5, delay = 2000): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries <= 0) throw error;
    logger.warn('Connection failed, retrying', { delayMs: delay, retriesLeft: retries });
    await new Promise(resolve => setTimeout(resolve, delay));
    return withRetry(fn, retries - 1, delay);
  }
}

export async function initOrderSequence(): Promise<void> {
  // אנחנו עוטפים את הכל ב-withRetry כדי לתת ל-Neon זמן להתעורר
  await withRetry(async () => {
    const bookings = await prisma.booking.findMany({
      select: { eventCode: true },
    });
    const maxFromCodes = maxSequenceFromBookings(bookings);

    const settings = await prisma.systemSettings.findUnique({
      where: { id: SETTINGS_ID },
    });

    if (!settings) {
      await prisma.systemSettings.create({
        data: { id: SETTINGS_ID, tenantId: 'global', nextEventNumber: maxFromCodes },
      });
      return;
    }

    if (settings.nextEventNumber < maxFromCodes) {
      await prisma.systemSettings.update({
        where: { id: SETTINGS_ID },
        data: { nextEventNumber: maxFromCodes },
      });
    }
  });
}

async function allocateEventCodeInTx(
  tx: TransactionClient,
  prefix: EventCodePrefix
): Promise<string> {
  let settings = await tx.systemSettings.findUnique({
    where: { id: SETTINGS_ID },
  });

  if (!settings) {
    settings = await tx.systemSettings.create({
      data: { id: SETTINGS_ID, tenantId: 'global', nextEventNumber: 0 },
    });
  }

  const next = settings.nextEventNumber + 1;
  await tx.systemSettings.update({
    where: { id: SETTINGS_ID },
    data: { nextEventNumber: next },
  });

  return formatEventCode(prefix, next);
}

export async function allocateEventCode(
  prefix: EventCodePrefix,
  tx?: TransactionClient
): Promise<string> {
  if (tx) {
    return allocateEventCodeInTx(tx, prefix);
  }

  return prisma.$transaction(
    (innerTx) => allocateEventCodeInTx(innerTx, prefix),
    neonTransactionOptions
  );
}

export async function peekNextEventCodes(
  prefix: EventCodePrefix,
  count = 1
): Promise<string[]> {
  const settings = await prisma.systemSettings.findUnique({
    where: { id: SETTINGS_ID },
  });
  const base = settings?.nextEventNumber ?? 0;
  const safeCount = Math.max(1, count);

  return Array.from({ length: safeCount }, (_, index) =>
    formatEventCode(prefix, base + index + 1)
  );
}