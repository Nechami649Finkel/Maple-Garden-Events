import express, { Router } from 'express';
import {
  handleWhatsAppWebhook,
  verifyWhatsAppWebhook,
} from '../controllers/whatsappWebhook.controller';
import { whatsappWebhookSignatureMiddleware } from '../middlewares/whatsappWebhookSignature';

const router = Router();

/** Meta webhook verification challenge */
router.get('/', verifyWhatsAppWebhook);

/**
 * Incoming messages / status updates.
 * Raw body required for X-Hub-Signature-256 verification.
 */
router.post(
  '/',
  express.raw({ type: 'application/json', limit: '1mb' }),
  whatsappWebhookSignatureMiddleware,
  handleWhatsAppWebhook,
);

export default router;
