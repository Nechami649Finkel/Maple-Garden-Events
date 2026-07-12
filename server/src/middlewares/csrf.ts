import { Request, Response, NextFunction } from 'express';
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME, tokensMatch } from '../utils/authCookie';

const CSRF_SKIP = [
  /^\/api\/auth\/login$/,
  /^\/api\/auth\/refresh$/,
  /^\/api\/feedback\/[^/]+$/,
  /^\/api\/webhooks\/easy-count$/,
];

function requestPath(req: Request): string {
  return req.originalUrl.split('?')[0];
}

export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  const method = req.method.toUpperCase();
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    next();
    return;
  }

  const path = requestPath(req);
  if (CSRF_SKIP.some((pattern) => pattern.test(path))) {
    next();
    return;
  }

  const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
  const headerToken = req.headers[CSRF_HEADER_NAME];

  if (!cookieToken || typeof headerToken !== 'string') {
    res.status(403).json({ success: false, message: 'CSRF token חסר.' });
    return;
  }

  if (!tokensMatch(cookieToken, headerToken)) {
    res.status(403).json({ success: false, message: 'CSRF token לא תקין.' });
    return;
  }

  next();
}
