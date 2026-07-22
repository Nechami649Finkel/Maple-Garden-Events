import { Prisma } from '@prisma/client';
import { SLOT_LABELS, type TimeSlot } from './timeSlot';

export function isSlotUniqueViolation(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code !== 'P2002') return false;
  const target = error.meta?.target;
  if (Array.isArray(target)) {
    return target.includes('calendarDateId') && target.includes('timeSlot');
  }
  return String(target ?? '').includes('calendarDateId');
}

export function slotUniqueConflictError(slot: TimeSlot): Error {
  const err = new Error(`כבר קיים אירוע ב${SLOT_LABELS[slot]} בתאריך זה!`);
  (err as Error & { statusCode: number }).statusCode = 409;
  return err;
}
