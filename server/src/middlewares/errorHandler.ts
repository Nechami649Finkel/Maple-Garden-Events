import { Request, Response, NextFunction } from 'express';
import { captureException } from '../config/sentry';
import { logger } from '../utils/logger';

export const catchAsync = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export const errorHandler = (err: any, req: Request, res: Response, _next: NextFunction) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'שגיאת שרת פנימית';

  logger.error('Unhandled error', {
    message,
    statusCode,
    stack: err.stack,
    method: req.method,
    url: req.originalUrl,
  });

  captureException(err, {
    statusCode,
    method: req.method,
    url: req.originalUrl,
  });

  res.status(statusCode).json({
    success: false,
    message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
};
