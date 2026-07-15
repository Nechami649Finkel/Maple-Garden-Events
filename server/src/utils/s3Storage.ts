import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { logger } from './logger';
import {
  assertBookingAccess,
  type BookingAccessUser,
} from './bookingAccess';

const S3_KEY_PREFIX = 's3:';
const DEFAULT_PRESIGN_TTL = Number(process.env.S3_PRESIGN_TTL_SECONDS || 3600);

/** Matches uploadPrivateFile layout: {category}/{bookingId}/{uuid}-{safeName} */
const UUID =
  '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const ALLOWED_S3_OBJECT_KEY_RE = new RegExp(
  `^(contracts|checks|signatures|documents)/${UUID}/[A-Za-z0-9._-]+$`,
  'i',
);

export class InvalidS3ObjectKeyError extends Error {
  constructor(message = 'INVALID_S3_KEY') {
    super(message);
    this.name = 'InvalidS3ObjectKeyError';
  }
}

export function isS3StorageEnabled(): boolean {
  return Boolean(process.env.S3_BUCKET);
}

export function isStoredS3Key(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.startsWith(S3_KEY_PREFIX);
}

export function toStoredS3Key(objectKey: string): string {
  return `${S3_KEY_PREFIX}${objectKey}`;
}

export function fromStoredS3Key(stored: string): string {
  return stored.startsWith(S3_KEY_PREFIX) ? stored.slice(S3_KEY_PREFIX.length) : stored;
}

/**
 * Normalize and validate an S3 object key for download/delete.
 * Blocks path traversal, bare keys, and keys outside the allowed prefix layout.
 */
export function assertAllowedS3ObjectKey(storedOrKey: string): string {
  if (typeof storedOrKey !== 'string' || !storedOrKey.trim()) {
    throw new InvalidS3ObjectKeyError();
  }

  const raw = storedOrKey.trim();
  // Avoid isStoredS3Key() here — its `value is string` predicate narrows the false branch to `never`.
  let key = raw.startsWith(S3_KEY_PREFIX) ? fromStoredS3Key(raw) : raw;
  try {
    key = decodeURIComponent(key);
  } catch {
    throw new InvalidS3ObjectKeyError();
  }

  if (
    !key
    || key.includes('..')
    || key.includes('\\')
    || key.includes('\0')
    || key.startsWith('/')
    || key.includes('//')
  ) {
    throw new InvalidS3ObjectKeyError();
  }

  if (!ALLOWED_S3_OBJECT_KEY_RE.test(key)) {
    throw new InvalidS3ObjectKeyError();
  }

  return key;
}

function createS3Client(): S3Client {
  const region = process.env.AWS_REGION || 'il-central-1';
  const config: S3ClientConfig = { region };

  const endpoint = process.env.S3_ENDPOINT;
  if (endpoint) {
    config.endpoint = endpoint;
    config.forcePathStyle = true;
  }

  if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    config.credentials = {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    };
  }

  return new S3Client(config);
}

function getBucket(): string {
  const bucket = process.env.S3_BUCKET?.trim();
  if (!bucket) throw new Error('S3_BUCKET is not configured');
  return bucket;
}

export async function uploadPrivateFile(params: {
  category: string;
  bookingId: string;
  fileName: string;
  contentType: string;
  body: Buffer;
  /** Authenticated principal — access is asserted before any S3 write. */
  accessUser: BookingAccessUser | null | undefined;
}): Promise<string> {
  await assertBookingAccess(params.accessUser, params.bookingId);

  const bucket = getBucket();
  const safeName = params.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const objectKey = `${params.category}/${params.bookingId}/${randomUUID()}-${safeName}`;
  const s3 = createS3Client();

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      Body: params.body,
      ContentType: params.contentType,
      ServerSideEncryption: 'AES256',
    }),
  );

  logger.info('Uploaded private file to S3', { bucket, objectKey, category: params.category });
  return toStoredS3Key(objectKey);
}

export async function getPresignedDownloadUrl(storedOrKey: string, expiresIn = DEFAULT_PRESIGN_TTL): Promise<string> {
  const objectKey = assertAllowedS3ObjectKey(storedOrKey);
  const bucket = getBucket();
  const s3 = createS3Client();

  return getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: bucket, Key: objectKey }),
    { expiresIn },
  );
}

export async function resolveFileUrl(value: string | null | undefined): Promise<string | null> {
  if (!value) return null;
  if (!isStoredS3Key(value)) return value;
  if (!isS3StorageEnabled()) {
    logger.warn('S3 key in DB but S3_BUCKET not configured', { key: value });
    return null;
  }
  return getPresignedDownloadUrl(value);
}

export async function deletePrivateFile(storedOrKey: string): Promise<void> {
  if (!isS3StorageEnabled()) return;
  const objectKey = assertAllowedS3ObjectKey(storedOrKey);
  const bucket = getBucket();
  const s3 = createS3Client();
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: objectKey }));
}
