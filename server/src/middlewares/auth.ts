import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { extractBearerToken } from '../utils/authCookie';

export interface AuthRequest extends Request {
  user?: { email: string; role: string; name: string };
}

export const requireAuth = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const token = extractBearerToken(req);

  if (!token) {
    res.status(401).json({ success: false, message: 'גישה נדחתה. חסר טוקן התחברות.' });
    return;
  }

  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      res.status(500).json({ success: false, message: 'שרת לא מוגדר לאימות (JWT_SECRET חסר).' });
      return;
    }
    const decoded = jwt.verify(token, secret) as { email: string; role: string; name: string };
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ success: false, message: 'טוקן לא תקין או שפג תוקפו.' });
  }
};