import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { catchAsync } from '../middlewares/errorHandler';
import {
  assertUploadedFileMagicBytes,
  createMemoryUpload,
  UploadValidationError,
} from '../middlewares/uploadMiddleware';
import {
  deletePrivateFile,
  isS3StorageEnabled,
  isStoredS3Key,
  resolveFileUrl,
  uploadGalleryFile,
} from '../utils/s3Storage';
import {
  deleteLocalGalleryFile,
  isLocalGalleryUrl,
  saveLocalGalleryFile,
} from '../utils/galleryLocalStorage';
import type { DesignGalleryCategory } from '../vendor/shared/gallery';

const IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
]);

export const designGalleryUpload = createMemoryUpload({
  maxFileSizeBytes: 8 * 1024 * 1024,
  allowedMimeTypes: IMAGE_MIME_TYPES,
});

function tenantIdFrom(req: Request): string | null {
  return (req as any).user?.tenantId ?? null;
}

async function toDto(item: {
  id: string;
  category: string;
  name: string;
  description: string | null;
  modelCode: string | null;
  imageUrl: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  const resolved = (await resolveFileUrl(item.imageUrl)) || item.imageUrl;
  return {
    id: item.id,
    category: item.category,
    name: item.name,
    description: item.description,
    modelCode: item.modelCode,
    imageUrl: resolved,
    sortOrder: item.sortOrder,
    isActive: item.isActive,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

async function persistImage(
  tenantId: string,
  file: Express.Multer.File,
): Promise<string> {
  if (isS3StorageEnabled()) {
    return uploadGalleryFile({
      tenantId,
      fileName: file.originalname || 'design.jpg',
      contentType: file.mimetype || 'image/jpeg',
      body: file.buffer,
    });
  }
  return saveLocalGalleryFile({
    fileName: file.originalname || 'design.jpg',
    body: file.buffer,
  });
}

async function removeStoredImage(imageUrl: string | null | undefined): Promise<void> {
  if (!imageUrl) return;
  if (isStoredS3Key(imageUrl)) {
    await deletePrivateFile(imageUrl);
    return;
  }
  if (isLocalGalleryUrl(imageUrl)) {
    await deleteLocalGalleryFile(imageUrl);
  }
}

export const designGalleryController = {
  list: catchAsync(async (req: Request, res: Response) => {
    const tenantId = tenantIdFrom(req);
    if (!tenantId) return res.status(403).json({ error: 'Tenant context is missing.' });

    const category = typeof req.query.category === 'string' ? req.query.category : undefined;
    const includeInactiveRaw = req.query.includeInactive;
    const includeInactive =
      includeInactiveRaw === 'true' || includeInactiveRaw === '1';

    const role = (req as any).user?.role as string | undefined;
    const canSeeInactive = role === 'manager' || role === 'production';
    const showInactive = includeInactive && canSeeInactive;

    const items = await prisma.designGalleryItem.findMany({
      where: {
        tenantId,
        ...(category ? { category } : {}),
        ...(showInactive ? {} : { isActive: true }),
      },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'desc' }],
    });

    res.json(await Promise.all(items.map(toDto)));
  }),

  create: catchAsync(async (req: Request, res: Response) => {
    const tenantId = tenantIdFrom(req);
    if (!tenantId) return res.status(403).json({ error: 'Tenant context is missing.' });

    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, message: 'חסרה תמונה להעלאה' });
    }

    const name = String(req.body.name || '').trim();
    const category = String(req.body.category || '').trim() as DesignGalleryCategory;
    const description = String(req.body.description || '').trim() || null;
    const modelCode = String(req.body.modelCode || '').trim() || null;
    const sortOrder = Number.isFinite(Number(req.body.sortOrder))
      ? Number(req.body.sortOrder)
      : 0;

    if (!name) {
      return res.status(400).json({ success: false, message: 'יש להזין שם עיצוב' });
    }

    let imageUrl: string;
    try {
      imageUrl = await persistImage(tenantId, file);
    } catch (err) {
      if (err instanceof UploadValidationError) {
        return res.status(err.statusCode).json({ success: false, message: err.message });
      }
      return res.status(500).json({ success: false, message: 'שגיאה בהעלאת התמונה' });
    }

    const item = await prisma.designGalleryItem.create({
      data: {
        tenantId,
        name,
        category,
        description,
        modelCode,
        imageUrl,
        sortOrder,
      },
    });

    res.status(201).json({ success: true, item: await toDto(item) });
  }),

  update: catchAsync(async (req: Request, res: Response) => {
    const tenantId = tenantIdFrom(req);
    if (!tenantId) return res.status(403).json({ error: 'Tenant context is missing.' });

    const id = req.params.id as string;
    const existing = await prisma.designGalleryItem.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'פריט עיצוב לא נמצא' });
    }

    const data: {
      name?: string;
      category?: string;
      description?: string | null;
      modelCode?: string | null;
      sortOrder?: number;
      isActive?: boolean;
      imageUrl?: string;
    } = {};

    if (typeof req.body.name === 'string') data.name = req.body.name.trim();
    if (typeof req.body.category === 'string') data.category = req.body.category.trim();
    if (req.body.description !== undefined) {
      data.description = String(req.body.description || '').trim() || null;
    }
    if (req.body.modelCode !== undefined) {
      data.modelCode = String(req.body.modelCode || '').trim() || null;
    }
    if (req.body.sortOrder !== undefined && Number.isFinite(Number(req.body.sortOrder))) {
      data.sortOrder = Number(req.body.sortOrder);
    }
    if (typeof req.body.isActive === 'boolean') data.isActive = req.body.isActive;
    else if (req.body.isActive === 'true' || req.body.isActive === 'false') {
      data.isActive = req.body.isActive === 'true';
    }

    if (req.file) {
      try {
        data.imageUrl = await persistImage(tenantId, req.file);
        await removeStoredImage(existing.imageUrl);
      } catch {
        return res.status(500).json({ success: false, message: 'שגיאה בהעלאת התמונה' });
      }
    }

    const updated = await prisma.designGalleryItem.update({
      where: { id },
      data,
    });

    res.json({ success: true, item: await toDto(updated) });
  }),

  remove: catchAsync(async (req: Request, res: Response) => {
    const tenantId = tenantIdFrom(req);
    if (!tenantId) return res.status(403).json({ error: 'Tenant context is missing.' });

    const id = req.params.id as string;
    const existing = await prisma.designGalleryItem.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'פריט עיצוב לא נמצא' });
    }

    await prisma.designGalleryItem.delete({ where: { id } });
    await removeStoredImage(existing.imageUrl);

    res.json({ success: true });
  }),
};

export { assertUploadedFileMagicBytes };
