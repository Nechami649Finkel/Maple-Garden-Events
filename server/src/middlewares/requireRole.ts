import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';

export const USER_ROLES = ['manager', 'staff', 'production', 'floor_staff'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export function isValidRole(role: string): role is UserRole {
  return (USER_ROLES as readonly string[]).includes(role);
}

export function requireRole(...allowed: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'גישה נדחתה. חסר טוקן התחברות.' });
      return;
    }

    if (!allowed.includes(req.user.role as UserRole)) {
      res.status(403).json({ success: false, message: 'אין הרשאה לפעולה זו.' });
      return;
    }

    next();
  };
}
