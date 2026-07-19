import { Request, Response, NextFunction } from 'express';
import { captureException } from '../config/sentry';
import { logger } from '../utils/logger';
import {
  DEFAULT_LOCALE,
  resolveLocaleFromRequest,
  resolveServerMessage,
  T,
  type ServerError,
} from '../i18n/getServerTranslation';

export const catchAsync = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export const errorHandler = (err: ServerError, req: Request, res: Response, _next: NextFunction) => {
  const statusCode = err.statusCode || 500;
  const locale = resolveLocaleFromRequest(req, DEFAULT_LOCALE);
  const message = resolveServerMessage(
    locale,
    err.message || T.SERVER.ERROR.INTERNAL,
    err.i18nParams,
  );

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
