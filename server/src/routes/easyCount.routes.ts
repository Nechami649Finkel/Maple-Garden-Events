import { Router } from 'express';
import { requireAuth } from '../middlewares/auth';
import { requireRole } from '../middlewares/requireRole';
import { RBAC } from '../config/rbac';
import { getEasyCountStatus } from '../controllers/easyCount.controller';

const router = Router();

router.use(requireAuth);
router.get('/status', requireRole(...RBAC.FINANCE_READ), getEasyCountStatus);

export default router;
