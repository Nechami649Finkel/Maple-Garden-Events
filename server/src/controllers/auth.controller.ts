import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import prisma from '../config/prisma';
import { AuthRequest } from '../middlewares/auth';
import { clearAuthCookie, setAuthCookie } from '../utils/authCookie';
import { catchAsync } from '../middlewares/errorHandler';
import { logger } from '../utils/logger';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

function signManagerToken(email: string, name: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured');
  }
  return jwt.sign({ email, role: 'manager', name }, secret, { expiresIn: '30d' });
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

    const managerToken = signManagerToken(googleUserEmail, userName);
    setAuthCookie(res, managerToken);

    return res.status(200).json({
      success: true,
      message: 'התחברת בהצלחה',
      user: { role: 'manager', name: userName, email: googleUserEmail },
    });
  } catch (error) {
    logger.error('Google authentication failed', { error });
    return res.status(401).json({ success: false, message: 'ההתחברות מול גוגל נכשלה.' });
  }
};

export const logout = (_req: Request, res: Response) => {
  clearAuthCookie(res);
  res.status(200).json({ success: true, message: 'התנתקת בהצלחה.' });
};

export const me = catchAsync(async (req: AuthRequest, res: Response) => {
  res.status(200).json({ success: true, user: req.user });
});
