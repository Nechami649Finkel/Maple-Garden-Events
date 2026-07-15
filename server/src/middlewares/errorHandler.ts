import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { captureException } from '../config/sentry';
import { logger } from '../utils/logger';
import { HmacVerificationError } from '../utils/hmac';
import { BookingAccessDeniedError } from '../utils/bookingAccess';
import { ForbiddenError, NotFoundError } from '../utils/httpErrors';
import { UploadValidationError } from './uploadMiddleware';

export const catchAsync = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

function resolveMulterError(err: multer.MulterError): { statusCode: number; message: string } {
  switch (err.code) {
    case 'LIMIT_FILE_SIZE':
      return { statusCode: 413, message: 'הקובץ גדול מדי.' };
    case 'LIMIT_FILE_COUNT':
    case 'LIMIT_UNEXPECTED_FILE':
    case 'LIMIT_FIELD_KEY':
    case 'LIMIT_FIELD_VALUE':
    case 'LIMIT_FIELD_COUNT':
    case 'LIMIT_PART_COUNT':
      return { statusCode: 400, message: 'בקשת העלאת קובץ לא תקינה.' };
    default:
      return { statusCode: 400, message: err.message || 'שגיאה בהעלאת קובץ.' };
  }
}

export const errorHandler = (err: any, req: Request, res: Response, _next: NextFunction) => {
  let statusCode = 500;
  let message = 'שגיאת שרת פנימית';

  if (err instanceof multer.MulterError) {
    ({ statusCode, message } = resolveMulterError(err));
  } else if (err instanceof HmacVerificationError) {
    statusCode = 401;
    message = 'חתימת webhook לא תקינה.';
  } else if (err instanceof BookingAccessDeniedError || err instanceof ForbiddenError) {
    statusCode = 403;
    message = err.message;
  } else if (err instanceof NotFoundError) {
    statusCode = 404;
    message = err.message;
  } else if (err instanceof UploadValidationError) {
    statusCode = err.statusCode || 400;
    message = err.message;
  } else if (typeof err?.statusCode === 'number') {
    statusCode = err.statusCode;
    message = err.message || message;
  } else if (err?.message) {
    message = err.message;
  }

  logger.error('Unhandled error', {
    message,
    statusCode,
    stack: err.stack,
    method: req.method,
    url: req.originalUrl,
    name: err?.name,
    code: err?.code,
  });

  if (statusCode >= 500) {
    captureException(err, {
      statusCode,
      method: req.method,
      url: req.originalUrl,
    });
  }

  res.status(statusCode).json({
    success: false,
    message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
};
