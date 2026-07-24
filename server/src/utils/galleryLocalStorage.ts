import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

const GALLERY_UPLOAD_DIR = path.resolve(__dirname, '../../uploads/gallery');
const PUBLIC_PREFIX = '/uploads/gallery';

export function isLocalGalleryUrl(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith(`${PUBLIC_PREFIX}/`);
}

export async function saveLocalGalleryFile(params: {
  fileName: string;
  body: Buffer;
}): Promise<string> {
  await fs.mkdir(GALLERY_UPLOAD_DIR, { recursive: true });
  const ext = path.extname(params.fileName).replace(/[^.a-zA-Z0-9]/g, '') || '.bin';
  const safeBase = path
    .basename(params.fileName, path.extname(params.fileName))
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 80);
  const storedName = `${randomUUID()}-${safeBase || 'image'}${ext}`;
  await fs.writeFile(path.join(GALLERY_UPLOAD_DIR, storedName), params.body);
  return `${PUBLIC_PREFIX}/${storedName}`;
}

export async function deleteLocalGalleryFile(publicUrl: string): Promise<void> {
  if (!isLocalGalleryUrl(publicUrl)) return;
  const fileName = path.basename(publicUrl);
  if (!fileName || fileName.includes('..')) return;
  try {
    await fs.unlink(path.join(GALLERY_UPLOAD_DIR, fileName));
  } catch {
    // Ignore missing files
  }
}

export function getGalleryUploadDir(): string {
  return GALLERY_UPLOAD_DIR;
}
