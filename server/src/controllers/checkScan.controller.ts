import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import { logger } from '../utils/logger';
import { CheckScanError, scanCheckWithVision } from '../Services/checkScan.service';

export const checkScanController = {
  async scanCheck(req: AuthRequest, res: Response) {
    try {
      const imageBase64 =
        typeof req.body?.imageBase64 === 'string'
          ? req.body.imageBase64
          : typeof req.body?.image === 'string'
            ? req.body.image
            : '';

      if (!imageBase64.trim()) {
        res.status(400).json({
          success: false,
          error: 'חסרה תמונת צ׳ק. שלח imageBase64 בגוף הבקשה.',
        });
        return;
      }

      const details = await scanCheckWithVision(imageBase64);

      res.status(200).json({
        success: true,
        details,
      });
    } catch (err) {
      if (err instanceof CheckScanError) {
        logger.warn('Check scan rejected', { status: err.statusCode, message: err.message });
        res.status(err.statusCode).json({ success: false, error: err.message });
        return;
      }

      logger.error('Check scan failed', { err });
      res.status(500).json({
        success: false,
        error: 'שגיאה פנימית בסריקת הצ׳ק',
      });
    }
  },
};
