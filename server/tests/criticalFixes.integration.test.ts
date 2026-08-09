/**
 * Integration tests — webhook HMAC, S3 IDOR, getOrCreateCheckIn race
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
  };
});

import crypto from 'crypto';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { csrfProtection } from '../src/middlewares/csrf';
import { errorHandler } from '../src/middlewares/errorHandler';
import easyCountWebhookRoutes from '../src/routes/easyCountWebhook.routes';
import filesRoutes from '../src/routes/files.routes';
import checkInRoutes from '../src/routes/checkIn.routes';
import {
  authorizedUserFindUnique,
  bookingFindUnique,
  eventCheckInCreate,
  eventCheckInFindUnique,
} from './helpers/prismaMock';
import { TEST_EMAIL, signTestToken } from './helpers/authTestHelpers';

const BOOKING_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_BOOKING_ID = '22222222-2222-4222-8222-222222222222';
const WEBHOOK_SECRET = 'test-webhook-secret';

function createTestApp(): express.Application {
  const app = express();
  app.use(cookieParser());
  app.use(csrfProtection);
  // Route stack includes express.raw — mount before express.json (same as app.ts).
  app.use('/api/webhooks/easy-count', easyCountWebhookRoutes);
  app.use(express.json());
  app.use('/api/files', filesRoutes);
  app.use('/api/check-in', checkInRoutes);
  app.use(errorHandler);
  return app;
}

function signWebhookBody(rawBody: string, secret = WEBHOOK_SECRET): string {
  return crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
}

function mockDbUser(role: string, id = 'user-1') {
  authorizedUserFindUnique.mockResolvedValue({
    id,
    email: TEST_EMAIL,
    role,
    tenantId: 'tenant-1',
  });
}

describe('Critical fixes — webhook HMAC, S3 IDOR, check-in race', () => {
  const app = createTestApp();

  beforeAll(() => {
    process.env.EASY_COUNT_WEBHOOK_SECRET = WEBHOOK_SECRET;
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-security-tests';
  });

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.EASY_COUNT_WEBHOOK_SECRET = WEBHOOK_SECRET;
  });

  describe('Webhook HMAC — POST /api/webhooks/easy-count', () => {
    it('accepts a valid signature → 200', async () => {
      const rawBody = JSON.stringify({
        externalId: 'inv-valid-1',
        status: 'paid',
        amountPaid: 1500,
      });

      const res = await request(app)
        .post('/api/webhooks/easy-count')
        .set('Content-Type', 'application/json')
        .set('x-easycount-signature', signWebhookBody(rawBody))
        .send(rawBody);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('rejects an invalid signature → 401', async () => {
      const rawBody = JSON.stringify({
        externalId: 'inv-invalid-1',
        status: 'paid',
        amountPaid: 1500,
      });

      const res = await request(app)
        .post('/api/webhooks/easy-count')
        .set('Content-Type', 'application/json')
        .set('x-easycount-signature', 'deadbeef')
        .send(rawBody);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('S3 IDOR — GET /api/files/presigned', () => {
    it('returns 403 when booking is not authorized for the authenticated user', async () => {
      mockDbUser('manager');
      // Fail-closed: booking does not exist / not accessible
      bookingFindUnique.mockResolvedValue(null);

      const key = `contracts/${OTHER_BOOKING_ID}/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa-file.pdf`;
      const token = signTestToken('manager');

      const res = await request(app)
        .get('/api/files/presigned')
        .query({ key })
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/אין הרשאה/);
    });
  });

  describe('Race — concurrent getOrCreateCheckIn via GET /api/check-in/:bookingId', () => {
    it('handles two concurrent requests without 500', async () => {
      mockDbUser('manager');

      const bookingRow = {
        id: BOOKING_ID,
        guestCount: 100,
        clientAFullName: 'Test Client',
        clientBFullName: null,
        eventType: 'אירוע',
        clientComments: null,
        timeOfDay: 'evening',
        eventForm: null,
        eventDate: { date: new Date() },
      };

      const checkInRow = {
        id: 'checkin-1',
        bookingId: BOOKING_ID,
        familiesLabel: 'משפחת Client',
        orderedPortions: 100,
        customerSignature: null,
      };

      bookingFindUnique.mockResolvedValue(bookingRow);
      // First looks: miss → create; concurrent path still returns without 500
      eventCheckInFindUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValue(checkInRow);
      eventCheckInCreate.mockResolvedValue(checkInRow);

      const token = signTestToken('manager');

      const [first, second] = await Promise.all([
        request(app)
          .get(`/api/check-in/${BOOKING_ID}`)
          .set('Authorization', `Bearer ${token}`),
        request(app)
          .get(`/api/check-in/${BOOKING_ID}`)
          .set('Authorization', `Bearer ${token}`),
      ]);

      expect([200, 201]).toContain(first.status);
      expect(first.status).not.toBe(500);
      expect([200, 201, 204]).toContain(second.status);
      expect(second.status).not.toBe(500);
    });
  });
});
