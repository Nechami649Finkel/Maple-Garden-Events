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
import { createGalleryThumbnail } from '../utils/galleryThumbnails';
import { logger } from '../utils/logger';
import type { DesignGalleryCategory } from '@maple/shared/gallery';

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

type StoredImagePair = {
  imageUrl: string;
  thumbnailUrl: string | null;
};

async function toDto(item: {
  id: string;
  category: string;
  name: string;
  description: string | null;
  modelCode: string | null;
  imageUrl: string;
  thumbnailUrl?: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  const [resolvedFull, resolvedThumb] = await Promise.all([
    resolveFileUrl(item.imageUrl),
    item.thumbnailUrl ? resolveFileUrl(item.thumbnailUrl) : Promise.resolve(null),
  ]);
  const imageUrl = resolvedFull || item.imageUrl;
  const thumbnailUrl = resolvedThumb || item.thumbnailUrl || imageUrl;
  return {
    id: item.id,
    category: item.category,
    name: item.name,
    description: item.description,
    modelCode: item.modelCode,
    imageUrl,
    thumbnailUrl,
    sortOrder: item.sortOrder,
    isActive: item.isActive,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

async function persistImagePair(
  tenantId: string,
  file: Express.Multer.File,
): Promise<StoredImagePair> {
  let thumbnailUrl: string | null = null;
  try {
    const thumbBuffer = await createGalleryThumbnail(file.buffer);
    if (isS3StorageEnabled()) {
      thumbnailUrl = await uploadGalleryFile({
        tenantId,
        fileName: 'thumb.webp',
        contentType: 'image/webp',
        body: thumbBuffer,
      });
    } else {
      thumbnailUrl = await saveLocalGalleryFile({
        fileName: 'thumb.webp',
        body: thumbBuffer,
      });
    }
  } catch (err) {
    logger.warn('Failed to generate gallery thumbnail — using full image in grid', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  const imageUrl = isS3StorageEnabled()
    ? await uploadGalleryFile({
        tenantId,
        fileName: file.originalname || 'design.jpg',
        contentType: file.mimetype || 'image/jpeg',
        body: file.buffer,
      })
    : await saveLocalGalleryFile({
        fileName: file.originalname || 'design.jpg',
        body: file.buffer,
      });

  return { imageUrl, thumbnailUrl };
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

    let pair: StoredImagePair;
    try {
      pair = await persistImagePair(tenantId, file);
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
        imageUrl: pair.imageUrl,
        thumbnailUrl: pair.thumbnailUrl,
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
      thumbnailUrl?: string | null;
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
        const pair = await persistImagePair(tenantId, req.file);
        data.imageUrl = pair.imageUrl;
        data.thumbnailUrl = pair.thumbnailUrl;
        await Promise.all([
          removeStoredImage(existing.imageUrl),
          removeStoredImage(existing.thumbnailUrl),
        ]);
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
    await Promise.all([
      removeStoredImage(existing.imageUrl),
      removeStoredImage(existing.thumbnailUrl),
    ]);

    res.json({ success: true });
  }),
};

export { assertUploadedFileMagicBytes };
