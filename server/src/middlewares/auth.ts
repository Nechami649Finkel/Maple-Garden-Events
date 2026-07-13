import { Request, Response, NextFunction } from 'express';
import prisma from '../config/prisma';
import { AuthUser, extractBearerToken, verifyAuthToken } from '../utils/authCookie';
import { isValidRole } from './requireRole';
import { catchAsync } from './errorHandler';

export interface AuthRequest extends Request {
  user?: AuthUser;
}

/**
 * אימות JWT + ביטול גישה בזמן אמת.
 * לאחר אימות החתימה — שולף את המשתמש מ-DB ומוודא שהוא עדיין מורשה
 * עם תפקיד תקף (מונע שימוש ב-JWT אחרי מחיקה/שינוי תפקיד).
 */
export const requireAuth = catchAsync(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = extractBearerToken(req);

  if (!token) {
    res.status(401).json({ success: false, message: 'גישה נדחתה. חסר טוקן התחברות.' });
    return;
  }

  let payload: AuthUser;
  try {
    payload = verifyAuthToken(token);
  } catch (error) {
    if (error instanceof Error && error.message === 'JWT_SECRET is not configured') {
      res.status(500).json({ success: false, message: 'שרת לא מוגדר לאימות (JWT_SECRET חסר).' });
      return;
    }
    res.status(401).json({ success: false, message: 'טוקן לא תקין או שפג תוקפו.' });
    return;
  }

  const email = payload.email.toLowerCase().trim();
  const dbUser = await prisma.authorizedUser.findUnique({ where: { email } });

  if (!dbUser) {
    res.status(401).json({
      success: false,
      message: 'החשבון הוסר מהמערכת. יש להתחבר מחדש.',
    });
    return;
  }

  if (!isValidRole(dbUser.role)) {
    res.status(401).json({
      success: false,
      message: 'לחשבון זה אין תפקיד תקף במערכת. פנה למנהל.',
    });
    return;
  }

  // תפקיד ואימייל תמיד מה-DB — לא מה-JTD (מונע הרחבת הרשאות)
  req.user = {
    email: dbUser.email,
    role: dbUser.role,
    name: payload.name || dbUser.email,
  };

  next();
});
