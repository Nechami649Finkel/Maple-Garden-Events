import { Request, Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import prisma from '../config/prisma';
import { AuthRequest } from '../middlewares/auth';
import {
  clearSessionCookies,
  extractRefreshToken,
  generateCsrfToken,
  setSessionCookies,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../utils/authCookie';
import { catchAsync } from '../middlewares/errorHandler';
import { isValidRole } from '../middlewares/requireRole';
import { logger } from '../utils/logger';
import { getServerTranslation, resolveLocaleFromRequest, T } from '../i18n/getServerTranslation';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

function issueSession(res: Response, email: string, name: string, role: string) {
  const accessToken = signAccessToken(email, name, role);
  const refreshToken = signRefreshToken(email, name, role);
  const csrfToken = generateCsrfToken();
  setSessionCookies(res, accessToken, refreshToken, csrfToken);
}

export const login = async (req: Request, res: Response) => {
  const locale = resolveLocaleFromRequest(req);
  const { t } = getServerTranslation(locale);
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ success: false, message: t(T.SERVER.AUTH.NO_TOKEN) });
  }

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload?.email) {
      return res.status(401).json({ success: false, message: t(T.SERVER.AUTH.INVALID_TOKEN) });
    }

    const googleUserEmail = payload.email.toLowerCase().trim();
    const userName = payload.name || t(T.SERVER.AUTH.DEFAULT_ADMIN_NAME);

    const user = await prisma.authorizedUser.findUnique({
      where: { email: googleUserEmail },
    });

    if (!user) {
      return res.status(403).json({
        success: false,
        message: t(T.SERVER.AUTH.ACCESS_DENIED),
      });
    }

    if (!isValidRole(user.role)) {
      return res.status(403).json({
        success: false,
        message: t(T.SERVER.AUTH.INVALID_ROLE),
      });
    }

    issueSession(res, googleUserEmail, userName, user.role);

    return res.status(200).json({
      success: true,
      message: t(T.SERVER.AUTH.LOGIN_SUCCESS),
      user: { role: user.role, name: userName, email: googleUserEmail },
    });
  } catch (error) {
    logger.error('Google authentication failed', { error });
    return res.status(401).json({ success: false, message: t(T.SERVER.AUTH.GOOGLE_FAILED) });
  }
};

export const refresh = async (req: Request, res: Response) => {
  const locale = resolveLocaleFromRequest(req);
  const { t } = getServerTranslation(locale);
  const refreshToken = extractRefreshToken(req);
  if (!refreshToken) {
    return res.status(401).json({ success: false, message: t(T.SERVER.AUTH.REFRESH_MISSING) });
  }

  try {
    const user = verifyRefreshToken(refreshToken);

    const authorized = await prisma.authorizedUser.findUnique({
      where: { email: user.email },
    });
    if (!authorized) {
      clearSessionCookies(res);
      return res.status(403).json({ success: false, message: t(T.SERVER.AUTH.REFRESH_FORBIDDEN) });
    }

    if (!isValidRole(authorized.role)) {
      clearSessionCookies(res);
      return res.status(403).json({ success: false, message: t(T.SERVER.AUTH.REFRESH_INVALID_ROLE) });
    }

    issueSession(res, user.email, user.name, authorized.role);
    return res.status(200).json({ success: true });
  } catch {
    clearSessionCookies(res);
    return res.status(401).json({ success: false, message: t(T.SERVER.AUTH.REFRESH_INVALID) });
  }
};

export const logout = (req: Request, res: Response) => {
  const locale = resolveLocaleFromRequest(req);
  const { t } = getServerTranslation(locale);
  clearSessionCookies(res);
  res.status(200).json({ success: true, message: t(T.SERVER.AUTH.LOGOUT_SUCCESS) });
};

export const me = catchAsync(async (req: AuthRequest, res: Response) => {
  res.status(200).json({ success: true, user: req.user });
});
