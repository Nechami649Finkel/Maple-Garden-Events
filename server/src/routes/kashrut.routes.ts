import { Router } from 'express';
import prisma from '../config/prisma';
import { requireAuth, type AuthRequest } from '../middlewares/auth';
import { requireRole } from '../middlewares/requireRole';
import { RBAC } from '../config/rbac';
import { validate } from '../middlewares/validate';
import { updateKashrutSchema } from '../validators/kashrut.validator';
import { emitSettingsUpdated } from '../utils/realtime';

const router = Router();

router.use(requireAuth);

const DEFAULT_CERT = {
  nameKey: 'main',
  displayName: 'תעודת כשרות',
  isGlobalCertificate: true,
};

async function ensureTenantCertificate(tenantId: string) {
  const existing = await prisma.kashrutCertificate.findMany({
    where: { tenantId },
    orderBy: { updatedAt: 'desc' },
  });
  if (existing.length > 0) return existing;

  const created = await prisma.kashrutCertificate.create({
    data: { ...DEFAULT_CERT, tenantId },
  });
  return [created];
}

router.get('/', requireRole(...RBAC.MENU_READ), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      res.status(403).json({ error: 'Tenant context is missing.' });
      return;
    }

    const kashruts = await ensureTenantCertificate(tenantId);
    res.json(kashruts);
  } catch {
    res.status(500).json({ error: 'שגיאה בשליפת כשרויות' });
  }
});

router.put(
  '/:id',
  requireRole(...RBAC.MENU_WRITE),
  validate(updateKashrutSchema),
  async (req: AuthRequest, res) => {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      res.status(403).json({ error: 'Tenant context is missing.' });
      return;
    }

    const { id } = req.params;
    const { imageUrl, validUntil } = req.body as { imageUrl?: string; validUntil?: string };

    try {
      const owned = await prisma.kashrutCertificate.findFirst({
        where: { id: id as string, tenantId },
      });
      if (!owned) {
        res.status(404).json({ error: 'תעודה לא נמצאה' });
        return;
      }

      const updated = await prisma.kashrutCertificate.update({
        where: { id: owned.id },
        data: {
          ...(imageUrl !== undefined ? { imageUrl } : {}),
          ...(validUntil !== undefined && validUntil !== ''
            ? { validUntil: new Date(validUntil) }
            : validUntil === ''
              ? { validUntil: null }
              : {}),
        },
      });

      res.json({ success: true, data: updated });
      emitSettingsUpdated();
    } catch {
      res.status(500).json({ error: 'שגיאה בשמירה' });
    }
  },
);

export default router;
