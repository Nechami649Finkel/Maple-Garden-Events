import prisma from '../config/prisma';
import { RBAC } from '../config/rbac';
import type { UserRole } from '../middlewares/requireRole';

const BOOKING_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const S3_KEY_BOOKING_RE =
  /^(?:contracts|checks|signatures|documents)\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\//i;

const FILE_ACCESS_ROLES = new Set<string>(RBAC.MANAGEMENT);

/** Single-tenant until Booking.orgId exists — override via APP_ORG_ID. */
const APP_ORG_ID = (process.env.APP_ORG_ID || 'maple-garden').trim();

export type BookingAccessUser = {
  userId?: string | null;
  email: string;
  role: string;
};

export type OrgContext = {
  orgId: string;
  userId: string;
  email: string;
  role: string;
};

export class BookingAccessDeniedError extends Error {
  readonly statusCode = 403;

  constructor(message = 'אין הרשאה להזמנה זו') {
    super(message);
    this.name = 'BookingAccessDeniedError';
  }
}

export function isValidBookingUuid(bookingId: string | null | undefined): boolean {
  return typeof bookingId === 'string' && BOOKING_UUID_RE.test(bookingId.trim());
}

/**
 * Extract bookingId from S3 object key: `contracts|{checks|signatures|documents}/{uuid}/...`
 * Returns null if the key shape is invalid or the id is not a UUID.
 */
export function extractBookingIdFromObjectKey(objectKey: string): string | null {
  const match = objectKey.match(S3_KEY_BOOKING_RE);
  if (!match?.[1] || !isValidBookingUuid(match[1])) return null;
  return match[1];
}

/**
 * Resolve the current "org" principal for file operations.
 * This deployment is single-tenant (no Booking.orgId); context is the DB-backed AuthorizedUser.
 * Fail-closed: returns null when the session cannot be verified.
 */
export async function getCurrentOrgContext(
  user: BookingAccessUser | null | undefined,
): Promise<OrgContext | null> {
  if (!user?.email?.trim() || !user.role) return null;
  if (!FILE_ACCESS_ROLES.has(user.role as UserRole)) return null;

  const email = user.email.toLowerCase().trim();
  const account = user.userId
    ? await prisma.authorizedUser.findUnique({
        where: { id: user.userId },
        select: { id: true, email: true, role: true },
      })
    : await prisma.authorizedUser.findUnique({
        where: { email },
        select: { id: true, email: true, role: true },
      });

  if (!account) return null;
  if (account.email.toLowerCase() !== email) return null;
  if (account.role !== user.role) return null;
  if (!FILE_ACCESS_ROLES.has(account.role as UserRole)) return null;

  return {
    orgId: APP_ORG_ID,
    userId: account.id,
    email: account.email,
    role: account.role,
  };
}

/**
 * Fail-closed booking access gate for S3 download/upload.
 * Verifies UUID, authenticated org principal, and that the booking exists.
 */
export async function assertBookingAccess(
  user: BookingAccessUser | null | undefined,
  bookingId: string,
): Promise<{ bookingId: string; org: OrgContext }> {
  if (!isValidBookingUuid(bookingId)) {
    throw new BookingAccessDeniedError('מזהה הזמנה לא חוקי');
  }

  const org = await getCurrentOrgContext(user);
  if (!org) {
    throw new BookingAccessDeniedError();
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId.trim() },
    select: { id: true },
  });

  if (!booking) {
    throw new BookingAccessDeniedError();
  }

  // When multi-tenancy lands: also require booking.orgId === org.orgId
  return { bookingId: booking.id, org };
}

/** @deprecated Prefer assertBookingAccess (throws) for fail-closed call sites. */
export async function isUserAuthorizedForBooking(
  user: BookingAccessUser | null | undefined,
  bookingId: string,
): Promise<boolean> {
  try {
    await assertBookingAccess(user, bookingId);
    return true;
  } catch (err) {
    if (err instanceof BookingAccessDeniedError) return false;
    throw err;
  }
}
