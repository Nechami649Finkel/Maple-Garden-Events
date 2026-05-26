import { Router } from 'express';
import { calendarController } from '../controllers/calendar.controller';
const router = Router();

// שליפת כל התאריכים (צריך להעביר start ו-end כ-query params)
router.get('/dates', calendarController.getAllDates);

// נעילת תאריך לבדיקה
router.post('/lock/:dateId', calendarController.lockDate);

// שחרור תאריך
router.post('/release/:dateId', calendarController.releaseDate);

// הפיכת תאריך לאופציה
router.post('/option/:dateId', calendarController.createOption);

// סגירת אירוע סופי
router.post('/book-final/:dateId', calendarController.bookFinal);

export default router;