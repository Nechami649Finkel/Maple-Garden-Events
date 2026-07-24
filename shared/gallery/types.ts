/** Design gallery category IDs (stored in DesignGalleryItem.category). */
export const DESIGN_GALLERY_CATEGORIES = [
  'tablecloths',
  'napkins',
  'centerpieces',
  'bridgeChair',
] as const;

export type DesignGalleryCategory = (typeof DESIGN_GALLERY_CATEGORIES)[number];

/** Maps gallery category → EventForm string field. */
export const DESIGN_CATEGORY_TO_FORM_FIELD = {
  tablecloths: 'tableclothId',
  napkins: 'napkinId',
  centerpieces: 'centerpiece',
  bridgeChair: 'bridgeChair',
} as const satisfies Record<DesignGalleryCategory, string>;

export type DesignFormField =
  (typeof DESIGN_CATEGORY_TO_FORM_FIELD)[DesignGalleryCategory];

export type DesignGalleryItemDto = {
  id: string;
  category: DesignGalleryCategory | string;
  name: string;
  description?: string | null;
  modelCode?: string | null;
  /** Resolved URL for display (presigned S3 or local path). */
  imageUrl: string;
  sortOrder: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export function isDesignGalleryCategory(value: string): value is DesignGalleryCategory {
  return (DESIGN_GALLERY_CATEGORIES as readonly string[]).includes(value);
}

/** Label stored on the event form when a gallery item is selected. */
export function designItemSelectionLabel(item: {
  name: string;
  modelCode?: string | null;
}): string {
  const code = item.modelCode?.trim();
  if (code) return `${code} — ${item.name}`;
  return item.name;
}
