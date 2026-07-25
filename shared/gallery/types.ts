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

/** Whether a stored form value refers to this gallery item. */
export function matchesDesignSelection(
  item: { name: string; modelCode?: string | null },
  storedValue: string | null | undefined,
): boolean {
  if (!storedValue?.trim()) return false;
  const value = storedValue.trim();
  const label = designItemSelectionLabel(item);
  if (value === label || value === item.name) return true;
  const code = item.modelCode?.trim();
  return Boolean(code && value === code);
}

/** Prefer model code for compact summary rows. */
export function designModelDisplay(
  item: { name: string; modelCode?: string | null } | null | undefined,
  storedValue?: string | null,
): string {
  const code = item?.modelCode?.trim();
  if (code) return code;
  const raw = (storedValue || item?.name || '').trim();
  if (!raw) return '';
  const sep = raw.includes(' — ') ? ' — ' : raw.includes(' - ') ? ' - ' : null;
  if (sep) {
    const left = raw.split(sep)[0]?.trim();
    if (left) return left;
  }
  return raw;
}
