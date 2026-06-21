import { Router } from 'express';
import { calendarController } from '../controllers/calendar.controller';
import { calendarService } from '../Services/calendar.service'; // הייבוא החדש שהוספנו

const router = Router();

router.get('/dates',                    calendarController.getAllDates);
router.post('/lock/:dateStr',           calendarController.lockDate);
router.post('/release/:dateStr',        calendarController.releaseDate);
router.post('/option/:dateId',          calendarController.createOption);
router.post('/book-final/:dateId',      calendarController.bookFinal);

// --- הנתיב החדש שלנו לשמירת אופציה עם פרטי לקוח ---
router.post('/options', async (req, res) => {
  try {
    const { dates, clientName, clientPhone, clientEmail } = req.body;
    
    // קריאה לפונקציה שכתבנו (עם ההודעות המוסלשות בינתיים)
    const result = await calendarService.saveOptionHold(
      dates, 
      clientName, 
      clientPhone, 
      clientEmail
    );
    
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error('שגיאה בשמירת אופציה:', error);
    res.status(500).json({ error: 'אירעה שגיאה בשרת בעת שמירת האופציה' });
  }
});

export default router;