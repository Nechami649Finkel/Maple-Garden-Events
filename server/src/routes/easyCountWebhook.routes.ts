import { Router } from 'express';
import { handleEasyCountWebhook } from '../controllers/easyCount.controller';

const router = Router();

router.post('/', handleEasyCountWebhook);

export default router;
