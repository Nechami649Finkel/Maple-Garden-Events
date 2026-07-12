import { randomBytes, timingSafeEqual } from 'crypto';
import { Response } from 'express';
import jwt from 'jsonwebtoken';

export const AUTH_COOKIE_NAME = 'maple_session';
export const REFRESH_COOKIE_NAME = 'maple_refresh';
export const CSRF_COOKIE_NAME = 'maple_csrf';
export const CSRF_HEADER_NAME = 'x-csrf-token';

export type AuthUser = { email: string; role: string; name: string };
type TokenPayload = AuthUser & { type?: 'access' | 'refresh' };

const ACCESS_TOKEN_MS = 60 * 60 * 1000;
const REFRESH_TOKEN_MS = 7 * 24 * 60 * 60 * 1000;

function cookieBaseOptions() {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    secure: isProduction,
    sameSite: (isProduction ? 'strict' : 'lax') as 'strict' | 'lax',
    path: '/',
  };
}

export function generateCsrfToken(): string {
  return randomBytes(32).toString('hex');
}

export function setSessionCookies(res: Response, accessToken: string, refreshToken: string, csrfToken: string): void {
  const base = cookieBaseOptions();
  res.cookie(AUTH_COOKIE_NAME, accessToken, {
    ...base,
    httpOnly: true,
    maxAge: ACCESS_TOKEN_MS,
  });
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
    ...base,
    httpOnly: true,
    maxAge: REFRESH_TOKEN_MS,
  });
  res.cookie(CSRF_COOKIE_NAME, csrfToken, {
    ...base,
    httpOnly: false,
    maxAge: REFRESH_TOKEN_MS,
  });
}

export function clearSessionCookies(res: Response): void {
  const base = cookieBaseOptions();
  res.clearCookie(AUTH_COOKIE_NAME, { ...base, httpOnly: true });
  res.clearCookie(REFRESH_COOKIE_NAME, { ...base, httpOnly: true });
  res.clearCookie(CSRF_COOKIE_NAME, { ...base, httpOnly: false });
}

/** @deprecated use setSessionCookies */
export function setAuthCookie(res: Response, token: string): void {
  setSessionCookies(res, token, token, generateCsrfToken());
}

/** @deprecated use clearSessionCookies */
export function clearAuthCookie(res: Response): void {
  clearSessionCookies(res);
}

export function parseCookieHeader(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) return {};
  return Object.fromEntries(
    cookieHeader.split(';').map((part) => {
      const [key, ...rest] = part.trim().split('=');
      return [key, decodeURIComponent(rest.join('='))];
    }),
  );
}

export function extractBearerToken(req: { headers: { authorization?: string }; cookies?: Record<string, string> }): string | null {
  const fromCookie = req.cookies?.[AUTH_COOKIE_NAME];
  if (fromCookie) return fromCookie;

  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.split(' ')[1];
  }
  return null;
}

export function extractRefreshToken(req: { cookies?: Record<string, string> }): string | null {
  return req.cookies?.[REFRESH_COOKIE_NAME] || null;
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured');
  }
  return secret;
}

export function signAccessToken(email: string, name: string, role: string): string {
  return jwt.sign({ email, role, name, type: 'access' }, getJwtSecret(), { expiresIn: '1h' });
}

export function signRefreshToken(email: string, name: string, role: string): string {
  return jwt.sign({ email, role, name, type: 'refresh' }, getJwtSecret(), { expiresIn: '7d' });
}

export function verifyAuthToken(token: string): AuthUser {
  const decoded = jwt.verify(token, getJwtSecret()) as TokenPayload;
  if (decoded.type && decoded.type !== 'access') {
    throw new Error('Invalid access token');
  }
  return { email: decoded.email, role: decoded.role, name: decoded.name };
}

export function verifyRefreshToken(token: string): AuthUser {
  const decoded = jwt.verify(token, getJwtSecret()) as TokenPayload;
  if (decoded.type !== 'refresh') {
    throw new Error('Invalid refresh token');
  }
  return { email: decoded.email, role: decoded.role, name: decoded.name };
}

export function tokensMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
