import sharp from 'sharp';

export const GALLERY_THUMB_MAX_WIDTH = 480;
export const GALLERY_THUMB_QUALITY = 72;

/**
 * Build a lightweight WebP thumbnail for gallery grids.
 * Falls back gracefully if the buffer is not a decodable image.
 */
export async function createGalleryThumbnail(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .rotate()
    .resize({
      width: GALLERY_THUMB_MAX_WIDTH,
      withoutEnlargement: true,
      fit: 'inside',
    })
    .webp({ quality: GALLERY_THUMB_QUALITY })
    .toBuffer();
}
