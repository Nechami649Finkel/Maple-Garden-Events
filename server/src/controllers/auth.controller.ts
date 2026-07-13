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

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

function issueSession(res: Response, email: string, name: string, role: string) {
  const accessToken = signAccessToken(email, name, role);
  const refreshToken = signRefreshToken(email, name, role);
  const csrfToken = generateCsrfToken();
  setSessionCookies(res, accessToken, refreshToken, csrfToken);
}

export const login = async (req: Request, res: Response) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ success: false, message: 'לא נשלח טוקן אימות.' });
  }

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload?.email) {
      return res.status(401).json({ success: false, message: 'טוקן אימות לא חוקי.' });
    }

    const googleUserEmail = payload.email.toLowerCase().trim();
    const userName = payload.name || 'מנהל מערכת';

    const user = await prisma.authorizedUser.findUnique({
      where: { email: googleUserEmail },
    });

    if (!user) {
      return res.status(403).json({
        success: false,
        message: 'אין למשתמש זה הרשאות גישה למערכת.',
      });
    }

    if (!isValidRole(user.role)) {
      return res.status(403).json({
        success: false,
        message: 'לחשבון זה לא הוקצה תפקיד תקף. פנה למנהל המערכת.',
      });
    }

    issueSession(res, googleUserEmail, userName, user.role);

    return res.status(200).json({
      success: true,
      message: 'התחברת בהצלחה',
      user: { role: user.role, name: userName, email: googleUserEmail },
    });
  } catch (error) {
    logger.error('Google authentication failed', { error });
    return res.status(401).json({ success: false, message: 'ההתחברות מול גוגל נכשלה.' });
  }
};

export const refresh = async (req: Request, res: Response) => {
  const refreshToken = extractRefreshToken(req);
  if (!refreshToken) {
    return res.status(401).json({ success: false, message: 'Refresh token חסר.' });
  }

  try {
    const user = verifyRefreshToken(refreshToken);

    const authorized = await prisma.authorizedUser.findUnique({
      where: { email: user.email },
    });
    if (!authorized) {
      clearSessionCookies(res);
      return res.status(403).json({ success: false, message: 'אין הרשאות גישה.' });
    }

    if (!isValidRole(authorized.role)) {
      clearSessionCookies(res);
      return res.status(403).json({ success: false, message: 'לחשבון זה אין תפקיד תקף.' });
    }

    issueSession(res, user.email, user.name, authorized.role);
    return res.status(200).json({ success: true });
  } catch {
    clearSessionCookies(res);
    return res.status(401).json({ success: false, message: 'Refresh token לא תקין או שפג תוקפו.' });
  }
};

export const logout = (_req: Request, res: Response) => {
  clearSessionCookies(res);
  res.status(200).json({ success: true, message: 'התנתקת בהצלחה.' });
};

export const me = catchAsync(async (req: AuthRequest, res: Response) => {
  res.status(200).json({ success: true, user: req.user });
});
