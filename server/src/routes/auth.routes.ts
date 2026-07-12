import { Router } from 'express';
import { login, logout, me, refresh } from '../controllers/auth.controller';
import { requireAuth } from '../middlewares/auth';
import { requireRole, isValidRole } from '../middlewares/requireRole';
import { validate } from '../middlewares/validate';
import {
  addAuthorizedUserSchema,
  deleteAuthorizedUserSchema,
  loginSchema,
  updateAuthorizedUserRoleSchema,
} from '../validators/auth.validator';
import prisma from '../config/prisma';

const router = Router();

router.post('/login', validate(loginSchema), login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.get('/me', requireAuth, me);

router.get('/authorized-users', requireAuth, requireRole('manager'), async (_req, res) => {
  const users = await prisma.authorizedUser.findMany({ orderBy: { createdAt: 'asc' } });
  res.json(users);
});

router.post('/authorized-users', requireAuth, requireRole('manager'), validate(addAuthorizedUserSchema), async (req, res) => {
  const { email, role } = req.body as { email: string; role?: string };
  const cleanEmail = email.toLowerCase().trim();
  const userRole = role && isValidRole(role) ? role : 'manager';
  const newUser = await prisma.authorizedUser.create({ data: { email: cleanEmail, role: userRole } });
  res.json(newUser);
});

router.patch('/authorized-users/:id', requireAuth, requireRole('manager'), validate(updateAuthorizedUserRoleSchema), async (req, res) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { role } = req.body as { role: string };
  if (!isValidRole(role)) {
    return res.status(400).json({ success: false, message: 'תפקיד לא תקין.' });
  }
  const updated = await prisma.authorizedUser.update({
    where: { id },
    data: { role },
  });
  res.json(updated);
});

router.delete('/authorized-users/:id', requireAuth, requireRole('manager'), validate(deleteAuthorizedUserSchema), async (req, res) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  await prisma.authorizedUser.delete({ where: { id } });
  res.json({ success: true });
});

export default router;
