import { NextFunction, Request, Response } from 'express';
import multer, { type FileFilterCallback } from 'multer';

export const DEFAULT_MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Whitelist for greeting attachments + booking document uploads */
export const ALLOWED_UPLOAD_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
]);

export class UploadValidationError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'UploadValidationError';
    this.statusCode = statusCode;
  }
}

export type CreateUploadOptions = {
  maxFileSizeBytes?: number;
  allowedMimeTypes?: ReadonlySet<string>;
};

function isAllowedMime(
  mime: string,
  allowed: ReadonlySet<string>,
): boolean {
  return allowed.has(mime.toLowerCase());
}

/** Basic content sniffing against claimed MIME (buffer available after memoryStorage). */
export function matchesMagicBytes(buffer: Buffer, mimeType: string): boolean {
  if (!buffer?.length) return false;
  const mime = mimeType.toLowerCase();

  const startsWith = (...bytes: number[]) =>
    bytes.every((b, i) => buffer[i] === b);

  if (mime === 'image/jpeg' || mime === 'image/jpg') {
    return startsWith(0xff, 0xd8, 0xff);
  }
  if (mime === 'image/png') {
    return startsWith(0x89, 0x50, 0x4e, 0x47);
  }
  if (mime === 'image/gif') {
    return buffer.toString('ascii', 0, 6) === 'GIF87a'
      || buffer.toString('ascii', 0, 6) === 'GIF89a';
  }
  if (mime === 'image/webp') {
    return (
      buffer.length >= 12
      && buffer.toString('ascii', 0, 4) === 'RIFF'
      && buffer.toString('ascii', 8, 12) === 'WEBP'
    );
  }
  if (mime === 'application/pdf') {
    return buffer.toString('ascii', 0, 4) === '%PDF';
  }
  // Legacy OLE (.doc / .xls)
  if (
    mime === 'application/msword'
    || mime === 'application/vnd.ms-excel'
  ) {
    return startsWith(0xd0, 0xcf, 0x11, 0xe0);
  }
  // OOXML (.docx / .xlsx) — ZIP container
  if (
    mime
      === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    || mime
      === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ) {
    return startsWith(0x50, 0x4b, 0x03, 0x04)
      || startsWith(0x50, 0x4b, 0x05, 0x06)
      || startsWith(0x50, 0x4b, 0x07, 0x08);
  }
  // text/plain: reject obvious binary (NUL in first 512 bytes)
  if (mime === 'text/plain') {
    const sample = buffer.subarray(0, Math.min(buffer.length, 512));
    return !sample.includes(0x00);
  }

  return false;
}

export function createMemoryUpload(options: CreateUploadOptions = {}) {
  const maxFileSizeBytes = options.maxFileSizeBytes ?? DEFAULT_MAX_UPLOAD_BYTES;
  const allowedMimeTypes = options.allowedMimeTypes ?? ALLOWED_UPLOAD_MIME_TYPES;

  const fileFilter = (
    _req: Request,
    file: Express.Multer.File,
    cb: FileFilterCallback,
  ) => {
    if (isAllowedMime(file.mimetype, allowedMimeTypes)) {
      cb(null, true);
      return;
    }
    cb(
      new UploadValidationError(
        'סוג קובץ לא מורשה. מותרים: תמונות, PDF ומסמכי Office.',
      ),
    );
  };

  return multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: maxFileSizeBytes,
      files: 1,
    },
    fileFilter,
  });
}

/**
 * Run after upload.single(...) — verifies buffer magic bytes match claimed MIME.
 * Skipped when no file was uploaded (optional attachment endpoints).
 */
export function assertUploadedFileMagicBytes(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const file = req.file;
  if (!file) {
    next();
    return;
  }

  if (!matchesMagicBytes(file.buffer, file.mimetype)) {
    next(
      new UploadValidationError(
        'תוכן הקובץ אינו תואם לסוג המוצהר (magic bytes).',
      ),
    );
    return;
  }

  next();
}

/** Shared default uploader for files + greeting attachments */
export const upload = createMemoryUpload();
