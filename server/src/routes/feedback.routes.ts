import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { feedbackController } from '../controllers/feedback.controller';
import { requireAuth } from '../middlewares/auth';
import { requireRole } from '../middlewares/requireRole';
import { RBAC } from '../config/rbac';
import { validate } from '../middlewares/validate';
import { feedbackTokenParamSchema, sendFeedbackAdminSchema, submitFeedbackSchema } from '../validators/feedback.validator';

const router = Router();

const feedbackLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'יותר מדי בקשות. נסה שוב מאוחר יותר.' },
});

router.get('/admin/list', requireAuth, requireRole(...RBAC.FEEDBACK_ADMIN), feedbackController.listAdmin);
router.get('/admin/stats', requireAuth, requireRole(...RBAC.FEEDBACK_ADMIN), feedbackController.statsAdmin);
router.post('/admin/send', requireAuth, requireRole(...RBAC.FEEDBACK_ADMIN), validate(sendFeedbackAdminSchema), feedbackController.sendAdmin);

router.get('/:token', feedbackLimiter, validate(feedbackTokenParamSchema), feedbackController.verifyToken);
router.post('/:token', feedbackLimiter, validate(submitFeedbackSchema), feedbackController.submitFeedback);

export default router;
