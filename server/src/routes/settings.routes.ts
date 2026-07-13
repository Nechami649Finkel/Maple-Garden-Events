import { Router } from 'express';
import { settingsController } from '../controllers/settings.controller';
import { requireAuth } from '../middlewares/auth';
import { requireRole } from '../middlewares/requireRole';
import { RBAC } from '../config/rbac';
import { validate } from '../middlewares/validate';
import {
  addExtraSchema,
  addStaffSchema,
  deleteExtraSchema,
  deleteStaffSchema,
  updateExtraSchema,
  updateSettingsSchema,
} from '../validators/settings.validator';

const router = Router();
router.use(requireAuth);

// הגדרות מתחם — Manager בלבד (PRD §2.3)
router.get('/global', requireRole(...RBAC.MANAGER_ONLY), settingsController.getSettings);
router.put('/global', requireRole(...RBAC.MANAGER_ONLY), validate(updateSettingsSchema), settingsController.updateSettings);

router.get('/extras', requireRole(...RBAC.MANAGER_ONLY), settingsController.getExtras);
router.post('/extras', requireRole(...RBAC.MANAGER_ONLY), validate(addExtraSchema), settingsController.addExtra);
router.put('/extras/:id', requireRole(...RBAC.MANAGER_ONLY), validate(updateExtraSchema), settingsController.updateExtra);
router.delete('/extras/:id', requireRole(...RBAC.MANAGER_ONLY), validate(deleteExtraSchema), settingsController.deleteExtra);

router.get('/staff', requireRole(...RBAC.MANAGER_ONLY), settingsController.getStaff);
router.post('/staff', requireRole(...RBAC.MANAGER_ONLY), validate(addStaffSchema), settingsController.addStaff);
router.delete('/staff/:id', requireRole(...RBAC.MANAGER_ONLY), validate(deleteStaffSchema), settingsController.deleteStaff);

export default router;
