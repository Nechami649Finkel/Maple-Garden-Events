import { Router, Request, Response } from 'express';
import { createOptionEntry } from '../models/option.model';
import { requireAuth } from '../middlewares/auth';
import { requireRole } from '../middlewares/requireRole';
import { RBAC } from '../config/rbac';

const router = Router();
router.use(requireAuth);

router.post('/', requireRole(...RBAC.MANAGEMENT), async (req: Request, res: Response) => {
  const { openedBy, menuId, clientName, eventDate } = req.body;

  if (!openedBy || !menuId || !clientName || !eventDate) {
    return res.status(400).json({ 
      success: false, 
      message: 'חסרים נתונים חיוניים: וודא ששם נציג, תפריט, שם לקוח ותאריך הוזנו.' 
    });
  }

  try {
    const newOption = await createOptionEntry(req.body);
    
    res.status(201).json({ 
      success: true, 
      message: 'האופציה נוצרה בהצלחה',
      data: newOption 
    });
    
  } catch (error) {
    console.error('Error creating option:', error);
    res.status(500).json({ 
      success: false, 
      message: 'שגיאת שרת פנימית בעת יצירת האופציה' 
    });
  }
});

export default router;
