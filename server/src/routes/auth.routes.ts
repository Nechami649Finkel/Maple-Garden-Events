import { Router } from 'express';
import { login, logout, me } from '../controllers/auth.controller';
import { requireAuth } from '../middlewares/auth';
import prisma from '../config/prisma';

const router = Router();

router.post('/login', login);
router.post('/logout', logout);
router.get('/me', requireAuth, me);

router.get('/authorized-users', requireAuth, async (_req, res) => {
  const users = await prisma.authorizedUser.findMany();
  res.json(users);
});

router.post('/authorized-users', requireAuth, async (req, res) => {
  const { email } = req.body;
  const cleanEmail = email.toLowerCase().trim();
  const newUser = await prisma.authorizedUser.create({ data: { email: cleanEmail } });
  res.json(newUser);
});

router.delete('/authorized-users/:id', requireAuth, async (req, res) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  await prisma.authorizedUser.delete({ where: { id } });
  res.json({ success: true });
});

export default router;
