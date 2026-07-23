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

import crypto from 'crypto';
import express from 'express';
import request from 'supertest';
import whatsappWebhookRoutes from '../src/routes/whatsappWebhook.routes';

function buildApp() {
  const app = express();
  app.use('/api/webhooks/whatsapp', whatsappWebhookRoutes);
  return app;
}

describe('WhatsApp Cloud webhook', () => {
  const previous = { ...process.env };

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

  it('POST accepts signed inbound text message', async () => {
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
  });
});
