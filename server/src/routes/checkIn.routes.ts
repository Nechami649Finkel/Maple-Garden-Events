import { Router } from 'express';
import { checkInController } from '../controllers/checkIn.controller';
import { requireAuth } from '../middlewares/auth';
import { requireRole } from '../middlewares/requireRole';
import { RBAC } from '../config/rbac';
import { validate } from '../middlewares/validate';
import { bookingIdParamSchema, updateCheckInSchema } from '../validators/checkIn.validator';

const router = Router();
router.use(requireAuth);

router.get('/:bookingId', requireRole(...RBAC.CHECK_IN), validate(bookingIdParamSchema), checkInController.getCheckIn);
router.put('/:bookingId', requireRole(...RBAC.CHECK_IN), validate(updateCheckInSchema), checkInController.updateCheckIn);

export default router;
