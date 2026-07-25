-- Lightweight thumbnails for design gallery grids
ALTER TABLE "DesignGalleryItem"
  ADD COLUMN IF NOT EXISTS "thumbnailUrl" TEXT;
