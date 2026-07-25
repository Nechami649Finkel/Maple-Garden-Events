import { Router } from 'express';
import { requireAuth } from '../middlewares/auth';
import { requireRole } from '../middlewares/requireRole';
import { RBAC } from '../config/rbac';
import { validate } from '../middlewares/validate';
import {
  createDesignGallerySchema,
  deleteDesignGallerySchema,
  listDesignGallerySchema,
  updateDesignGallerySchema,
} from '../validators/designGallery.validator';
import {
  assertUploadedFileMagicBytes,
  designGalleryController,
  designGalleryUpload,
} from '../controllers/designGallery.controller';

const router = Router();
router.use(requireAuth);

/** Active catalog for event-form gallery (managers, staff, production). */
router.get(
  '/',
  requireRole(...RBAC.EVENT_FORM_READ),
  validate(listDesignGallerySchema),
  designGalleryController.list,
);

/** Create design item with image (manager + production). */
router.post(
  '/',
  requireRole(...RBAC.MENU_WRITE),
  designGalleryUpload.single('file'),
  assertUploadedFileMagicBytes,
  validate(createDesignGallerySchema),
  designGalleryController.create,
);

router.put(
  '/:id',
  requireRole(...RBAC.MENU_WRITE),
  designGalleryUpload.single('file'),
  assertUploadedFileMagicBytes,
  validate(updateDesignGallerySchema),
  designGalleryController.update,
);

router.delete(
  '/:id',
  requireRole(...RBAC.MANAGER_ONLY),
  validate(deleteDesignGallerySchema),
  designGalleryController.remove,
);

export default router;
