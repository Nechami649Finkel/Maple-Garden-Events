import express, { Router } from 'express';
import { handleEasyCountWebhook } from '../controllers/easyCount.controller';
import { webhookHmacMiddleware } from '../middlewares/webhookHmac';

const router = Router();

router.post(
  '/',
  express.raw({ type: 'application/json', limit: '1mb' }),
  webhookHmacMiddleware,
  handleEasyCountWebhook,
);

export default router;
