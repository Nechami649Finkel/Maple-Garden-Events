import express from 'express';
import cookieParser from 'cookie-parser';
import { csrfProtection } from '../../src/middlewares/csrf';
import { errorHandler } from '../../src/middlewares/errorHandler';
import settingsRoutes from '../../src/routes/settings.routes';
import bookingRoutes from '../../src/routes/booking';

/**
 * אפליקציית Express מינימלית לבדיקות אבטחה —
 * טוענת רק את הנתיבים הרלוונטיים (ללא server.ts / cron / menu).
 */
export function createSecurityTestApp(): express.Application {
  const app = express();

  app.use(cookieParser());
  app.use(csrfProtection);
  app.use(express.json());

  app.use('/api/settings', settingsRoutes);
  app.use('/api/bookings', bookingRoutes);

  app.use(errorHandler);

  return app;
}
