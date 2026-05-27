import { Router } from 'express';
import { calendarController } from '../controllers/calendar.controller';

const router = Router();

router.get('/dates',                    calendarController.getAllDates);
router.post('/lock/:dateStr',           calendarController.lockDate);
router.post('/release/:dateStr',        calendarController.releaseDate);
router.post('/option/:dateId',          calendarController.createOption);
router.post('/book-final/:dateId',      calendarController.bookFinal);

export default router;
