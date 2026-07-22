import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middlewares/auth';
import { requireRole } from '../middlewares/requireRole';
import { RBAC } from '../config/rbac';
import {
  assertUploadedFileMagicBytes,
  upload,
} from '../middlewares/uploadMiddleware';
import {
  assertAllowedS3ObjectKey,
  getPresignedDownloadUrl,
  InvalidS3ObjectKeyError,
  isS3StorageEnabled,
  uploadPrivateFile,
} from '../utils/s3Storage';
import {
  assertBookingAccess,
  BookingAccessDeniedError,
  extractBookingIdFromObjectKey,
} from '../utils/bookingAccess';

const router = Router();

function accessUserFromReq(req: AuthRequest) {
  if (!req.user) return null;
  return {
    userId: req.user.userId,
    email: req.user.email,
    role: req.user.role,
  };
}

router.get('/presigned', requireAuth, requireRole(...RBAC.MANAGEMENT), async (req: AuthRequest, res: Response) => {
  const key = typeof req.query.key === 'string' ? req.query.key : '';
  if (!key) {
    res.status(400).json({ success: false, message: 'חסר פרמטר key' });
    return;
  }

  if (!isS3StorageEnabled()) {
    res.status(503).json({ success: false, message: 'אחסון S3 לא מוגדר' });
    return;
  }

  let objectKey: string;
  try {
    objectKey = assertAllowedS3ObjectKey(key);
  } catch (err) {
    if (err instanceof InvalidS3ObjectKeyError) {
      res.status(400).json({ success: false, message: 'מפתח קובץ לא חוקי' });
      return;
    }
    throw err;
  }

  const bookingId = extractBookingIdFromObjectKey(objectKey);
  if (!bookingId) {
    res.status(400).json({ success: false, message: 'מפתח קובץ לא חוקי' });
    return;
  }

  try {
    await assertBookingAccess(accessUserFromReq(req), bookingId);
  } catch (err) {
    if (err instanceof BookingAccessDeniedError) {
      res.status(403).json({ success: false, message: err.message });
      return;
    }
    throw err;
  }

  try {
    const url = await getPresignedDownloadUrl(objectKey);
    res.json({ success: true, url, objectKey });
  } catch (err) {
    if (err instanceof InvalidS3ObjectKeyError) {
      res.status(400).json({ success: false, message: 'מפתח קובץ לא חוקי' });
      return;
    }
    res.status(500).json({ success: false, message: 'שגיאה ביצירת קישור זמני' });
  }
});

router.post(
  '/upload',
  requireAuth,
  requireRole(...RBAC.MANAGEMENT),
  upload.single('file'),
  assertUploadedFileMagicBytes,
  async (req: AuthRequest, res: Response) => {
    if (!isS3StorageEnabled()) {
      res.status(503).json({ success: false, message: 'אחסון S3 לא מוגדר' });
      return;
    }

    const file = req.file;
    const bookingId = typeof req.body.bookingId === 'string' ? req.body.bookingId : '';
    const category = typeof req.body.category === 'string' ? req.body.category : 'documents';

    if (!file || !bookingId) {
      res.status(400).json({ success: false, message: 'חסר קובץ או bookingId' });
      return;
    }

    const allowedCategories = ['contracts', 'checks', 'signatures', 'documents'];
    if (!allowedCategories.includes(category)) {
      res.status(400).json({ success: false, message: 'קטגוריה לא חוקית' });
      return;
    }

    try {
      const storedKey = await uploadPrivateFile({
        category,
        bookingId,
        fileName: file.originalname || 'upload.bin',
        contentType: file.mimetype || 'application/octet-stream',
        body: file.buffer,
        accessUser: accessUserFromReq(req),
      });
      const url = await getPresignedDownloadUrl(storedKey);
      res.json({ success: true, key: storedKey, url });
    } catch (err) {
      if (err instanceof BookingAccessDeniedError) {
        res.status(403).json({ success: false, message: err.message });
        return;
      }
      res.status(500).json({ success: false, message: 'שגיאה בהעלאת קובץ' });
    }
  },
);

export default router;
