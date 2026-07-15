/**
 * בדיקות אינטגרציה לשכבת האבטחה —
 * SEC-01..05 + S3 IDOR + check-in gate + webhook HMAC + upload limits
 */

jest.mock('../src/config/env', () => ({
  validateEnv: jest.fn(),
}));

jest.mock('../src/utils/realtime', () => ({
  emitDateUpdated: jest.fn(),
  emitDateUpdatedMany: jest.fn(),
  emitBookingUpdated: jest.fn(),
  emitCheckInUpdated: jest.fn(),
  emitSettingsUpdated: jest.fn(),
}));

jest.mock('../src/config/prisma', () => jest.requireActual('./helpers/prismaMock'));

jest.mock('../src/Services/easyCount', () => {
  const actual = jest.requireActual('../src/Services/easyCount') as typeof import('../src/Services/easyCount');
  return {
    ...actual,
    applyHallInvoicePayment: jest.fn().mockResolvedValue({
      bookingId: '11111111-1111-4111-8111-111111111111',
    }),
  };
});

jest.mock('../src/utils/s3Storage', () => {
  const actual = jest.requireActual('../src/utils/s3Storage') as typeof import('../src/utils/s3Storage');
  return {
    ...actual,
    isS3StorageEnabled: jest.fn(() => true),
    getPresignedDownloadUrl: jest.fn(async () => 'https://example.test/presigned'),
    uploadPrivateFile: jest.fn(async () => 's3:contracts/x/y'),
  };
});

import crypto from 'crypto';
import request from 'supertest';
import { createSecurityTestApp } from './helpers/securityTestApp';
import {
  authorizedUserFindUnique,
  bookingFindUnique,
  eventCheckInFindUnique,
  systemSettingsFindUnique,
} from './helpers/prismaMock';
import {
  TEST_EMAIL,
  csrfHeaders,
  defaultSystemSettings,
  signTestToken,
} from './helpers/authTestHelpers';

const BOOKING_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_BOOKING_ID = '22222222-2222-4222-8222-222222222222';
const WEBHOOK_SECRET = 'test-webhook-secret-security';
const FILE_UUID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

let app: ReturnType<typeof createSecurityTestApp>;

beforeAll(() => {
  process.env.EASY_COUNT_WEBHOOK_SECRET = WEBHOOK_SECRET;
  app = createSecurityTestApp();
});

function mockDbUser(role: string, email = TEST_EMAIL, id = 'auth-user-1') {
  authorizedUserFindUnique.mockResolvedValue({ id, email, role });
}

function mockDbUserMissing() {
  authorizedUserFindUnique.mockResolvedValue(null);
}

function mockDbUserDowngraded(email = TEST_EMAIL) {
  authorizedUserFindUnique.mockResolvedValue({ id: 'auth-user-1', email, role: 'floor_staff' });
}

function signWebhookBody(rawBody: string, secret = WEBHOOK_SECRET): string {
  return crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
}

function todayLocalDate(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0);
}

function daysAgoLocal(days: number): Date {
  const d = todayLocalDate();
  d.setDate(d.getDate() - days);
  return d;
}

/** Pick a timeOfDay slot that includes "now" so canEditCheckIn passes. */
function liveTimeOfDayForNow(): string {
  const hour = new Date().getHours();
  if (hour >= 8 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'noon';
  return 'evening';
}

function bookingFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: BOOKING_ID,
    guestCount: 120,
    clientAFullName: 'ישראל ישראלי',
    clientBFullName: null,
    clientAPhone: '0501234567',
    clientAIdNumber: '123456789',
    clientAEmail: 'a@test.com',
    totalPrice: 99999,
    basePrice: 50000,
    timeOfDay: liveTimeOfDayForNow(),
    eventType: 'אירוע',
    clientComments: null,
    eventForm: {
      eventTime: null,
      pricePerPortion: 250,
      totalPrice: 88888,
      notes: null,
    },
    eventDate: { date: todayLocalDate() },
    ...overrides,
  };
}

describe('שכבת אבטחה — SEC-01 עד SEC-05', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.EASY_COUNT_WEBHOOK_SECRET = WEBHOOK_SECRET;
    systemSettingsFindUnique.mockResolvedValue(defaultSystemSettings());
  });

  describe('SEC-01: RBAC — floor_staff לא יכול לגשת להגדרות', () => {
    it('GET /api/settings/global עם תפקיד floor_staff → 403', async () => {
      mockDbUser('floor_staff');
      const token = signTestToken('floor_staff');

      const res = await request(app)
        .get('/api/settings/global')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/אין הרשאה/);
    });
  });

  describe('SEC-02: RBAC — staff לא יכול להפיק חשבונית', () => {
    it('POST /api/bookings/:id/invoice עם תפקיד staff → 403', async () => {
      mockDbUser('staff');
      const token = signTestToken('staff');
      const { cookie, header } = csrfHeaders();

      const res = await request(app)
        .post(`/api/bookings/${BOOKING_ID}/invoice`)
        .set('Authorization', `Bearer ${token}`)
        .set('Cookie', cookie)
        .set(header)
        .send({ amount: 1000 });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/אין הרשאה/);
    });
  });

  describe('SEC-03: אימות מחיר — מניפולציית calculatedTotals', () => {
    it('POST /api/bookings עם baseTotal: 1 ו-300 אורחים → 400', async () => {
      mockDbUser('manager');
      const token = signTestToken('manager');
      const { cookie, header } = csrfHeaders();

      const res = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${token}`)
        .set('Cookie', cookie)
        .set(header)
        .send({
          isOption: true,
          createdBy: 'נציג בדיקה',
          clientAFullName: 'לקוח בדיקה',
          clientAPhone: '0501234567',
          allSelectedDates: ['2026-12-15'],
          guestCount: 300,
          finalPricePortion: 100,
          eventType: 'חתונה',
          calculatedTotals: {
            baseTotal: 1,
            hallExtrasTotal: 0,
            externalExtrasTotal: 0,
            hallTotal: 1,
          },
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/אינו תואם לחישוב המערכת/);
    });
  });

  describe('SEC-04: ביטול session — משתמש שנמחק מ-DB', () => {
    it('GET /api/bookings עם JWT תקף אך משתמש לא קיים → 401', async () => {
      mockDbUserMissing();
      const token = signTestToken('manager');

      const res = await request(app)
        .get('/api/bookings')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/הוסר מהמערכת/);
    });
  });

  describe('SEC-05: הורדת תפקיד בזמן אמת — JWT manager, DB floor_staff', () => {
    it('GET /api/settings/global עם JWT manager אך DB floor_staff → 403', async () => {
      mockDbUserDowngraded();
      const token = signTestToken('manager');

      const res = await request(app)
        .get('/api/settings/global')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/אין הרשאה/);
    });
  });
});

describe('SEC-06: S3 IDOR — GET /api/files/presigned', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.EASY_COUNT_WEBHOOK_SECRET = WEBHOOK_SECRET;
  });

  it('returns 403 when booking is not authorized for the user', async () => {
    mockDbUser('manager');
    bookingFindUnique.mockResolvedValue(null);
    const token = signTestToken('manager');
    const key = `contracts/${OTHER_BOOKING_ID}/${FILE_UUID}-file.pdf`;

    const res = await request(app)
      .get('/api/files/presigned')
      .query({ key })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('returns 200 when user is authorized for the booking', async () => {
    mockDbUser('manager');
    bookingFindUnique.mockResolvedValue({ id: BOOKING_ID });
    const token = signTestToken('manager');
    const key = `contracts/${BOOKING_ID}/${FILE_UUID}-file.pdf`;

    const res = await request(app)
      .get('/api/files/presigned')
      .query({ key })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.url).toMatch(/^https:\/\//);
  });
});

describe('SEC-07: Check-in access gate — floor_staff', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.EASY_COUNT_WEBHOOK_SECRET = WEBHOOK_SECRET;
  });

  it('returns 403 when event is not today', async () => {
    mockDbUser('floor_staff');
    bookingFindUnique.mockResolvedValue(
      bookingFixture({
        eventDate: { date: daysAgoLocal(3) },
        timeOfDay: 'evening',
      }),
    );
    const token = signTestToken('floor_staff');

    const res = await request(app)
      .get(`/api/check-in/${BOOKING_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/יום האירוע|קבלה/);
  });

  it('returns 200 on event day and strips PII/pricing fields', async () => {
    jest.useFakeTimers({ advanceTimers: true });
    jest.setSystemTime(new Date(2026, 6, 15, 20, 30, 0)); // evening slot

    mockDbUser('floor_staff');
    const booking = bookingFixture({
      eventDate: { date: new Date(2026, 6, 15, 12, 0, 0) },
      timeOfDay: 'evening',
    });
    bookingFindUnique.mockResolvedValue(booking);
    eventCheckInFindUnique.mockResolvedValue({
      id: 'ci-1',
      bookingId: BOOKING_ID,
      familiesLabel: 'משפחת ישראלי',
      orderedPortions: 120,
      customerSignature: 'data:image/png;base64,xxx',
      hallReceivedConfirmed: false,
    });
    const token = signTestToken('floor_staff');

    try {
      const res = await request(app)
        .get(`/api/check-in/${BOOKING_ID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.booking.clientAPhone).toBeUndefined();
      expect(res.body.data.booking.clientAIdNumber).toBeUndefined();
      expect(res.body.data.booking.totalPrice).toBeUndefined();
      expect(res.body.data.checkIn.customerSignature).toBeUndefined();
      expect(res.body.data.eventForm?.pricePerPortion).toBeUndefined();
      expect(res.body.data.eventForm?.totalPrice).toBeUndefined();
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('SEC-08: Webhook HMAC — POST /api/webhooks/easy-count', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.EASY_COUNT_WEBHOOK_SECRET = WEBHOOK_SECRET;
  });

  it('returns 401 when signature header is missing', async () => {
    const rawBody = JSON.stringify({ externalId: 'inv-miss', status: 'paid' });

    const res = await request(app)
      .post('/api/webhooks/easy-count')
      .set('Content-Type', 'application/json')
      .send(rawBody);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 when HMAC signature is invalid', async () => {
    const rawBody = JSON.stringify({ externalId: 'inv-bad', status: 'paid' });

    const res = await request(app)
      .post('/api/webhooks/easy-count')
      .set('Content-Type', 'application/json')
      .set('x-easycount-signature', '00'.repeat(32))
      .send(rawBody);

    expect(res.status).toBe(401);
  });

  it('returns 200 for a valid signature and payload', async () => {
    const rawBody = JSON.stringify({
      externalId: 'inv-ok',
      status: 'paid',
      amountPaid: 500,
    });

    const res = await request(app)
      .post('/api/webhooks/easy-count')
      .set('Content-Type', 'application/json')
      .set('x-easycount-signature', signWebhookBody(rawBody))
      .send(rawBody);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('SEC-09: File upload — size limit and magic bytes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.EASY_COUNT_WEBHOOK_SECRET = WEBHOOK_SECRET;
    mockDbUser('manager');
  });

  it('POST /api/bookings/send-greeting with >10MB file → 413', async () => {
    const token = signTestToken('manager');
    const { cookie, header } = csrfHeaders();
    const oversized = Buffer.alloc(10 * 1024 * 1024 + 1, 0xff);
    // JPEG magic so size limit fails before/alongside content checks
    oversized[0] = 0xff;
    oversized[1] = 0xd8;
    oversized[2] = 0xff;

    const res = await request(app)
      .post('/api/bookings/send-greeting')
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', cookie)
      .set(header)
      .field('subject', 'ברכה')
      .field('message', 'תוכן ברכה לבדיקה')
      .attach('attachment', oversized, { filename: 'big.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(413);
  });

  it('POST /api/bookings/send-greeting with spoofed .jpg (script body) → 400', async () => {
    const token = signTestToken('manager');
    const { cookie, header } = csrfHeaders();
    const spoofed = Buffer.from('#!/bin/sh\necho pwned\n', 'utf8');

    const res = await request(app)
      .post('/api/bookings/send-greeting')
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', cookie)
      .set(header)
      .field('subject', 'ברכה')
      .field('message', 'תוכן ברכה לבדיקה')
      .attach('attachment', spoofed, { filename: 'evil.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(String(res.body.message)).toMatch(/magic bytes|סוג קובץ|תוכן הקובץ/i);
  });
});
