import { Router } from 'express';
import { eventFormController } from '../controllers/eventForm.controller';
import { requireAuth } from '../middlewares/auth';
import { requireRole } from '../middlewares/requireRole';
import { RBAC } from '../config/rbac';
import { validate } from '../middlewares/validate';
import {
  bookingIdParamSchema,
  saveEventFormTablesSchema,
  upsertEventFormSchema,
} from '../validators/eventForm.validator';

const router = Router();
router.use(requireAuth);

router.get('/search', requireRole(...RBAC.EVENT_FORM_READ), eventFormController.searchBookings);
router.get('/', requireRole(...RBAC.EVENT_FORM_READ), eventFormController.getAllForms);

router.get('/:bookingId/pdf', requireRole(...RBAC.EVENT_FORM_READ), validate(bookingIdParamSchema), eventFormController.generatePDF);
router.get('/:bookingId', requireRole(...RBAC.EVENT_FORM_READ), validate(bookingIdParamSchema), eventFormController.getForm);
router.post('/:bookingId', requireRole(...RBAC.EVENT_FORM_WRITE), validate(upsertEventFormSchema), eventFormController.upsertForm);
router.post('/:bookingId/tables', requireRole(...RBAC.EVENT_FORM_WRITE), validate(saveEventFormTablesSchema), eventFormController.saveTables);
router.post('/:bookingId/send-email', requireRole(...RBAC.EVENT_FORM_WRITE), validate(bookingIdParamSchema), eventFormController.sendEmail);

export default router;
