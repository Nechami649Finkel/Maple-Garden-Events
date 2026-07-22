import express from 'express';
import cookieParser from 'cookie-parser';
import { csrfProtection } from '../../src/middlewares/csrf';
import { errorHandler } from '../../src/middlewares/errorHandler';
import settingsRoutes from '../../src/routes/settings.routes';
import bookingRoutes from '../../src/routes/booking';
import easyCountWebhookRoutes from '../../src/routes/easyCountWebhook.routes';
import filesRoutes from '../../src/routes/files.routes';
import checkInRoutes from '../../src/routes/checkIn.routes';

/**
 * אפליקציית Express מינימלית לבדיקות אבטחה —
 * webhook raw לפני express.json (כמו app.ts).
 */
export function createSecurityTestApp(): express.Application {
  const app = express();

  app.use(cookieParser());
  app.use(csrfProtection);
  app.use('/api/webhooks/easy-count', easyCountWebhookRoutes);
  app.use(express.json({ limit: '12mb' }));

  app.use('/api/settings', settingsRoutes);
  app.use('/api/bookings', bookingRoutes);
  app.use('/api/files', filesRoutes);
  app.use('/api/check-in', checkInRoutes);

  app.use(errorHandler);

  return app;
}
