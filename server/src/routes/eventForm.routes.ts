import { Router } from 'express';
import { eventFormController } from '../controllers/eventForm.controller';

const router = Router();

router.get('/search',         eventFormController.searchBookings);
router.get('/',               eventFormController.getAllForms);

router.get('/:bookingId/pdf', eventFormController.generatePDF);
router.get('/:bookingId',     eventFormController.getForm);
router.post('/:bookingId',    eventFormController.upsertForm);
router.post('/:bookingId/tables', eventFormController.saveTables);
router.post('/:bookingId/send-email', eventFormController.sendEmail);

export default router;
