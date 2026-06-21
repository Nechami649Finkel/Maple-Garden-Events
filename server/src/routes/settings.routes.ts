import { Router } from 'express';
import { settingsController } from '../controllers/settings.controller';

const router = Router();

// נתיבים להגדרות כלליות (מע"מ, מחירי בסיס)
router.get('/global', settingsController.getSettings);
router.put('/global', settingsController.updateSettings);

// נתיבים למחירון תוספות דינמי
router.get('/extras', settingsController.getExtras);
router.post('/extras', settingsController.addExtra);
router.put('/extras/:id', settingsController.updateExtra);

router.get('/staff', settingsController.getStaff);
router.post('/staff', settingsController.addStaff);
router.delete('/staff/:id', settingsController.deleteStaff);

export default router;