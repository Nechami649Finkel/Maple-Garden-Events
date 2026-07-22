import { Socket } from 'socket.io';
import prisma from '../config/prisma';
import { AUTH_COOKIE_NAME, parseCookieHeader, verifyAuthToken } from '../utils/authCookie';
import { isValidRole } from './requireRole';

/** אימות WebSocket — JWT + בדיקת קיום משתמש ב-DB (כמו requireAuth). */
export async function socketAuthMiddleware(socket: Socket, next: (err?: Error) => void): Promise<void> {
  const cookies = parseCookieHeader(socket.handshake.headers.cookie);
  const tokenFromCookie = cookies[AUTH_COOKIE_NAME];

  const authHeader = socket.handshake.headers.authorization;
  const tokenFromBearer = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  const token = tokenFromCookie || tokenFromBearer;
  if (!token) {
    next(new Error('Unauthorized'));
    return;
  }

  try {
    const payload = verifyAuthToken(token);
    const dbUser = await prisma.authorizedUser.findUnique({
      where: { email: payload.email.toLowerCase().trim() },
    });

    if (!dbUser || !isValidRole(dbUser.role)) {
      next(new Error('Unauthorized'));
      return;
    }

    socket.data.user = {
      email: dbUser.email,
      role: dbUser.role,
      name: payload.name || dbUser.email,
    };
    next();
  } catch {
    next(new Error('Unauthorized'));
  }
}
