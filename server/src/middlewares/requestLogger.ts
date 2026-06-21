import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  res.on('finish', () => {
    const entry = {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      durationMs: Date.now() - start,
      ip: req.ip,
    };

    if (res.statusCode >= 500) {
      logger.error('HTTP request failed', entry);
    } else if (res.statusCode >= 400) {
      logger.warn('HTTP client error', entry);
    } else {
      logger.info('HTTP request', entry);
    }
  });

  next();
}
