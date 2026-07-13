import { Router } from 'express';

import prisma from '../config/prisma';

import { requireAuth } from '../middlewares/auth';
import { requireRole } from '../middlewares/requireRole';
import { RBAC } from '../config/rbac';

import { validate } from '../middlewares/validate';

import { updateKashrutSchema } from '../validators/kashrut.validator';
import { emitSettingsUpdated } from '../utils/realtime';



const router = Router();

router.use(requireAuth);



router.get('/', requireRole(...RBAC.MENU_READ), async (_req, res) => {

  try {

    const kashruts = await prisma.kashrutCertificate.findMany();

    res.json(kashruts);

  } catch {

    res.status(500).json({ error: 'שגיאה בשליפת כשרויות' });

  }

});



router.put('/:id', requireRole(...RBAC.MENU_WRITE), validate(updateKashrutSchema), async (req, res) => {

  const { id } = req.params;

  const { imageUrl, validUntil } = req.body as { imageUrl?: string; validUntil?: string };



  try {

    const updated = await prisma.kashrutCertificate.update({

      where: { id: id as string },

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

});



export default router;

