import { Router } from 'express';
import { requireAuth } from '../middlewares/auth';
import { requireRole } from '../middlewares/requireRole';
import { RBAC } from '../config/rbac';
import { checkScanController } from '../controllers/checkScan.controller';

const router = Router();

/** Roles that upload deposit checks (bookings + event forms). */
const SCAN_ROLES = [...new Set([...RBAC.MANAGEMENT, ...RBAC.EVENT_FORM_WRITE])] as const;

router.post(
  '/',
  requireAuth,
  requireRole(...SCAN_ROLES),
  checkScanController.scanCheck,
);

export default router;
