import { Router, Request, Response } from 'express';
import { createOptionEntry } from '../models/option.model';

const router = Router();

// נתיב ליצירת אופציה חדשה
router.post('/', async (req: Request, res: Response) => {
  const { openedBy, menuId, clientName, eventDate } = req.body;

  // 1. בדיקת תקינות נתונים בסיסית (Validation)
  if (!openedBy || !menuId || !clientName || !eventDate) {
    return res.status(400).json({ 
      success: false, 
      message: 'חסרים נתונים חיוניים: וודא ששם נציג, תפריט, שם לקוח ותאריך הוזנו.' 
    });
  }

  try {
    // 2. קריאה למודל לביצוע השמירה ב-DB
    const newOption = await createOptionEntry(req.body);
    
    // 3. החזרת תשובה חיובית
    res.status(201).json({ 
      success: true, 
      message: 'האופציה נוצרה בהצלחה',
      data: newOption 
    });
    
  } catch (error) {
    // 4. ניהול שגיאות שרת
    console.error('Error creating option:', error);
    res.status(500).json({ 
      success: false, 
      message: 'שגיאת שרת פנימית בעת יצירת האופציה' 
    });
  }
});

export default router;