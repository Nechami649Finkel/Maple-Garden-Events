/**
 * בדיקות אינטגרציה לשכבת האבטחה — SEC-01 עד SEC-05
 * RBAC | אימות מחיר בשרת | ביטול session בזמן אמת
 */

jest.mock('../src/config/env', () => ({
  validateEnv: jest.fn(),
}));

jest.mock('../src/utils/realtime', () => ({
  emitDateUpdated: jest.fn(),
  emitDateUpdatedMany: jest.fn(),
  emitBookingUpdated: jest.fn(),
  emitSettingsUpdated: jest.fn(),
}));

jest.mock('../src/config/prisma', () => jest.requireActual('./helpers/prismaMock'));

import request from 'supertest';
import { createSecurityTestApp } from './helpers/securityTestApp';
import {
  authorizedUserFindUnique,
  systemSettingsFindUnique,
} from './helpers/prismaMock';
import {
  TEST_EMAIL,
  csrfHeaders,
  defaultSystemSettings,
  signTestToken,
} from './helpers/authTestHelpers';

const BOOKING_ID = '11111111-1111-4111-8111-111111111111';

let app: ReturnType<typeof createSecurityTestApp>;

beforeAll(() => {
  app = createSecurityTestApp();
});

function mockDbUser(role: string, email = TEST_EMAIL) {
  authorizedUserFindUnique.mockResolvedValue({ email, role });
}

function mockDbUserMissing() {
  authorizedUserFindUnique.mockResolvedValue(null);
}

function mockDbUserDowngraded(email = TEST_EMAIL) {
  // JWT יclaim manager — DB מחזיר floor_staff (SEC-05)
  authorizedUserFindUnique.mockResolvedValue({ email, role: 'floor_staff' });
}

describe('שכבת אבטחה — SEC-01 עד SEC-05', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
      // טוקן עדיין טוען manager — השרת חייב להשתמש בתפקיד מה-DB
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
