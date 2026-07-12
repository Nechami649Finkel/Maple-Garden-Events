import { Router } from 'express';
import { requireAuth } from '../middlewares/auth';
import { getEasyCountStatus } from '../controllers/easyCount.controller';

const router = Router();

router.use(requireAuth);
router.get('/status', getEasyCountStatus);

export default router;
