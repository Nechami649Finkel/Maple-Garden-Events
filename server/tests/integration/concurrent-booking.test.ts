/**
 * בדיקת אינטגרציה: double-booking תחת עומס מקביל
 *
 * דורש PostgreSQL אמיתי (DATABASE_URL) — אין mock ל-Prisma.
 * הרצה: npm run test:integration
 */

jest.mock('../../src/config/env', () => ({
  validateEnv: jest.fn(),
}));

jest.mock('../../src/utils/realtime', () => ({
  emitDateUpdated: jest.fn(),
  emitDateUpdatedMany: jest.fn(),
  emitBookingUpdated: jest.fn(),
  emitSettingsUpdated: jest.fn(),
}));

import request from 'supertest';
import type { Application } from 'express';
import prisma from '../../src/config/prisma';
import { createSecurityTestApp } from '../helpers/securityTestApp';
import { csrfHeaders, signTestToken, TEST_EMAIL } from '../helpers/authTestHelpers';
import {
  cleanupEventDateTree,
  createAvailableEventDate,
  ensureIntegrationFixtures,
  isDatabaseReachable,
  uniqueTestCalendarKey,
} from '../helpers/integrationDb';

const describeIntegration =
  process.env.RUN_INTEGRATION_TESTS === 'true' ? describe : describe.skip;

describeIntegration('Concurrent booking — pessimistic lock / 409', () => {
  let app: Application;
  let eventDateId: string;
  let calendarKey: string;

  beforeAll(async () => {
    const reachable = await isDatabaseReachable();
    if (!reachable) {
      throw new Error(
        'Database unreachable. Set DATABASE_URL and RUN_INTEGRATION_TESTS=true to run integration tests.',
      );
    }

    await ensureIntegrationFixtures();
    app = createSecurityTestApp();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    calendarKey = uniqueTestCalendarKey();
    const eventDate = await createAvailableEventDate(calendarKey);
    eventDateId = eventDate.id;
  });

  afterEach(async () => {
    if (eventDateId) {
      await cleanupEventDateTree(eventDateId);
    }
  });

  function buildConfirmedBookingBody(clientSuffix: string) {
    return {
      isOption: false,
      clientAFullName: `Concurrent Client ${clientSuffix}`,
      clientAPhone: '0501234567',
      clientAEmail: '',
      createdBy: 'Integration Test Agent',
      timeOfDay: 'evening',
      eventType: 'חתונה',
      guestCount: 120,
      finalPricePortion: 250,
      allSelectedDates: [calendarKey],
    };
  }

  /**
   * שולח בקשת POST /api/bookings עם auth + CSRF.
   * מחזיר את אובייקת התגובה של Supertest (לא await בפנים — לשימוש ב-Promise.all).
   */
  function postBookingConcurrently(clientSuffix: string) {
    const token = signTestToken('manager', TEST_EMAIL);
    const { cookie, header } = csrfHeaders();

    return request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', cookie)
      .set(header)
      .send(buildConfirmedBookingBody(clientSuffix));
  }

  it(
    'רק הזמנה אחת מצליחה — השנייה מקבלת 409 Conflict',
    async () => {
    /**
     * Promise.all מפעיל את שתי הבקשות באותו tick של ה-event loop,
     * כך שהן מגיעות לשרת כמעט במקביל. PostgreSQL FOR UPDATE גורם
     * לבקשה השנייה להמתין עד commit/rollback של הראשונה,
     * ואז assertSlotAvailableAfterLock / unique index דוחים אותה ב-409.
     */
    const [responseA, responseB] = await Promise.all([
      postBookingConcurrently('A'),
      postBookingConcurrently('B'),
    ]);

    const statuses = [responseA.status, responseB.status].sort((a, b) => a - b);

    expect(statuses).toEqual([201, 409]);

    const success = responseA.status === 201 ? responseA : responseB;
    const failure = responseA.status === 409 ? responseA : responseB;

    expect(success.body.success).toBe(true);
    expect(failure.body.success).toBe(false);

    const bookings = await prisma.booking.findMany({
      where: { calendarDateId: eventDateId },
    });

    expect(bookings).toHaveLength(1);
    expect(bookings[0].timeSlot).toBe('evening');
    expect(bookings[0].isOption).toBe(false);

    const updatedEventDate = await prisma.eventDate.findUnique({
      where: { id: eventDateId },
    });

    expect(updatedEventDate?.status).toBe('BOOKED');

    const eveningBookings = await prisma.booking.count({
      where: { calendarDateId: eventDateId, timeSlot: 'evening' },
    });
    expect(eveningBookings).toBe(1);
    },
    30_000,
  );
});
