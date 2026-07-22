/**
 * אימות בעלות על תאריכי אופציה לפני שחרור — מונע מחיקת אירועים של לקוחות אחרים (H8).
 */

import prisma from '../config/prisma';
import { HttpError, type TxClient } from './eventDateLock';

const OPTION_GROUP_WINDOW_MS = 120_000;

export type OptionGroupAnchor = {
  id: string;
  clientAFullName: string;
  clientAPhone: string;
  createdBy: string;
  createdAt: Date;
};

function optionGroupTimeRange(createdAt: Date) {
  return {
    gte: new Date(createdAt.getTime() - OPTION_GROUP_WINDOW_MS),
    lte: new Date(createdAt.getTime() + OPTION_GROUP_WINDOW_MS),
  };
}

/** תנאי DB ל-bookings השייכים לאותה קבוצת אופציה */
export function ownedOptionBookingWhere(anchor: OptionGroupAnchor, calendarDateIds: string[]) {
  return {
    calendarDateId: { in: calendarDateIds },
    clientAFullName: anchor.clientAFullName,
    clientAPhone: anchor.clientAPhone,
    createdBy: anchor.createdBy,
    isOption: true as const,
    createdAt: optionGroupTimeRange(anchor.createdAt),
  };
}

/**
 * מאמת שכל תאריך ב-releaseDateIds שייך לאופציה של ה-anchor.
 * @throws HttpError 400 אם יש תאריך שלא בבעלות הקבוצה
 */
export async function assertReleaseDatesOwnedByOptionGroup(
  tx: TxClient,
  anchor: OptionGroupAnchor,
  releaseDateIds: string[],
): Promise<void> {
  if (releaseDateIds.length === 0) return;

  const uniqueIds = [...new Set(releaseDateIds)];

  const owned = await tx.booking.findMany({
    where: ownedOptionBookingWhere(anchor, uniqueIds),
    select: { calendarDateId: true },
  });

  const ownedSet = new Set(owned.map((b) => b.calendarDateId));
  const unauthorized = uniqueIds.filter((id) => !ownedSet.has(id));

  if (unauthorized.length > 0) {
    throw new HttpError(
      'תאריכי שחרור לא שייכים לאופציה זו. לא ניתן למחוק תאריכים של לקוח אחר.',
      400,
    );
  }
}

/** מוחק רק bookings אופציה בבעלות הקבוצה ומשחרר תאריכים ריקים */
export async function releaseOwnedOptionDates(
  tx: TxClient,
  anchor: OptionGroupAnchor,
  releaseDateIds: string[],
): Promise<void> {
  if (releaseDateIds.length === 0) return;

  const uniqueIds = [...new Set(releaseDateIds)];

  await assertReleaseDatesOwnedByOptionGroup(tx, anchor, uniqueIds);

  await tx.booking.deleteMany({
    where: ownedOptionBookingWhere(anchor, uniqueIds),
  });

  for (const dateId of uniqueIds) {
    const remaining = await tx.booking.count({ where: { calendarDateId: dateId } });
    if (remaining === 0) {
      await tx.eventDate.update({
        where: { id: dateId },
        data: {
          status: 'AVAILABLE',
          optionExpiresAt: null,
          lockedBy: null,
          clientName: null,
          clientPhone: null,
          clientEmail: null,
        },
      });
    }
  }
}

/** מציאת bookings קשורים לאותה קבוצת אופציה (חלון ±2 דקות) */
export async function findRelatedOptionBookings(
  tx: TxClient | typeof prisma,
  anchor: OptionGroupAnchor,
) {
  return tx.booking.findMany({
    where: {
      clientAFullName: anchor.clientAFullName,
      clientAPhone: anchor.clientAPhone,
      createdBy: anchor.createdBy,
      isOption: true,
      createdAt: optionGroupTimeRange(anchor.createdAt),
    },
    include: { eventDate: true },
    orderBy: { eventDate: { date: 'asc' } },
  });
}
