import { z } from 'zod';
import { DESIGN_GALLERY_CATEGORIES } from '../vendor/shared/gallery';

const categorySchema = z.enum(DESIGN_GALLERY_CATEGORIES);

export const listDesignGallerySchema = z.object({
  query: z
    .object({
      category: categorySchema.optional(),
      includeInactive: z
        .union([z.literal('true'), z.literal('false'), z.literal('1'), z.literal('0')])
        .optional(),
    })
    .optional(),
});

export const createDesignGallerySchema = z.object({
  body: z.object({
    name: z.string().trim().min(1).max(200),
    category: categorySchema,
    description: z.string().trim().max(1000).optional().or(z.literal('')),
    modelCode: z.string().trim().max(100).optional().or(z.literal('')),
    sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
  }),
});

export const updateDesignGallerySchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z
    .object({
      name: z.string().trim().min(1).max(200).optional(),
      category: categorySchema.optional(),
      description: z.string().trim().max(1000).nullable().optional(),
      modelCode: z.string().trim().max(100).nullable().optional(),
      sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
      isActive: z
        .union([z.boolean(), z.literal('true'), z.literal('false'), z.literal('1'), z.literal('0')])
        .optional(),
    })
    .strict(),
});

export const deleteDesignGallerySchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});
