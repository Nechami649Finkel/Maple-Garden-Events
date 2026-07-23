/**
 * Meta WhatsApp Cloud API webhook — verification challenge + inbound parse path.
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

jest.mock('../src/Services/whatsappCloud.service', () => {
  const actual = jest.requireActual('../src/Services/whatsappCloud.service') as typeof import('../src/Services/whatsappCloud.service');
  return {
    ...actual,
    sendWhatsAppCloudText: jest.fn(async () => ({ ok: true, messageId: 'wamid.OUT' })),
    resolveManagerWhatsAppPhone: jest.fn(() => '972501111111'),
    isWhatsAppCloudConfigured: jest.fn(() => true),
  };
});

import crypto from 'crypto';
import express from 'express';
import request from 'supertest';
import whatsappWebhookRoutes from '../src/routes/whatsappWebhook.routes';
import prisma from '../src/config/prisma';

function buildApp() {
  const app = express();
  app.use('/api/webhooks/whatsapp', whatsappWebhookRoutes);
  return app;
}

describe('WhatsApp Cloud webhook', () => {
  const previous = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.booking.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'booking-1',
        tenantId: 'tenant-1',
        eventCode: 'EVT-00001',
        clientAFullName: 'ישראל ישראלי',
        clientAPhone: '0501234567',
        clientBPhone: null,
        managerComments: null,
        eventDate: { date: new Date('2026-08-01'), status: 'BOOKED' },
      },
    ]);
    (prisma.whatsAppInboundMessage.create as jest.Mock).mockResolvedValue({ id: 'in-1' });
    (prisma.whatsAppInboundMessage.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (prisma.booking.update as jest.Mock).mockResolvedValue({ id: 'booking-1' });
    (prisma.tenant.findFirst as jest.Mock).mockResolvedValue({ id: 'tenant-1' });
  });

  afterEach(() => {
    process.env = { ...previous };
  });

  it('GET returns hub.challenge when verify token matches', async () => {
    process.env.WHATSAPP_VERIFY_TOKEN = 'maple-verify';
    const app = buildApp();
    const res = await request(app)
      .get('/api/webhooks/whatsapp')
      .query({
        'hub.mode': 'subscribe',
        'hub.verify_token': 'maple-verify',
        'hub.challenge': '12345challenge',
      });
    expect(res.status).toBe(200);
    expect(res.text).toBe('12345challenge');
  });

  it('GET rejects bad verify token', async () => {
    process.env.WHATSAPP_VERIFY_TOKEN = 'maple-verify';
    const app = buildApp();
    const res = await request(app)
      .get('/api/webhooks/whatsapp')
      .query({
        'hub.mode': 'subscribe',
        'hub.verify_token': 'wrong',
        'hub.challenge': '12345challenge',
      });
    expect(res.status).toBe(403);
  });

  it('POST accepts signed inbound text, persists and forwards to manager', async () => {
    process.env.WHATSAPP_APP_SECRET = 'test-app-secret';
    process.env.NODE_ENV = 'test';
    const app = buildApp();
    const payload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  {
                    from: '972501234567',
                    id: 'wamid.TEST',
                    timestamp: '1710000000',
                    type: 'text',
                    text: { body: 'שלום' },
                  },
                ],
              },
            },
          ],
        },
      ],
    };
    const raw = JSON.stringify(payload);
    const signature =
      'sha256=' +
      crypto.createHmac('sha256', 'test-app-secret').update(raw, 'utf8').digest('hex');

    const res = await request(app)
      .post('/api/webhooks/whatsapp')
      .set('Content-Type', 'application/json')
      .set('X-Hub-Signature-256', signature)
      .send(raw);

    expect(res.status).toBe(200);
    expect(prisma.whatsAppInboundMessage.create).toHaveBeenCalled();
    expect(prisma.booking.update).toHaveBeenCalled();
  });
});
