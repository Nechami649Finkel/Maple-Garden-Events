import {
  DeleteObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { logger } from './logger';
import { getS3Client } from './s3Client';

const execFileAsync = promisify(execFile);

const LOCAL_MAX_BACKUPS = Number(process.env.BACKUP_RETENTION_COUNT || 7);
const REMOTE_RETENTION_DAYS = Number(process.env.BACKUP_RETENTION_DAYS || 30);

function isRemoteBackupEnabled(): boolean {
  return Boolean(
    process.env.S3_BACKUP_BUCKET &&
      process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY,
  );
}

function getBackupPrefix(): string {
  const tenant = process.env.TENANT_NAME || 'default-tenant';
  const base = (process.env.S3_BACKUP_PREFIX || 'database-backups').replace(/\/+$/, '');
  return `${base}/${tenant}/`;
}

async function compressSqlDump(sqlPath: string): Promise<string> {
  const archivePath = sqlPath.replace(/\.sql$/, '.tar.gz');
  const backupDir = path.dirname(sqlPath);
  const fileName = path.basename(sqlPath);

  await execFileAsync('tar', ['-czf', archivePath, '-C', backupDir, fileName], {
    env: process.env,
    windowsHide: true,
  });

  fs.unlinkSync(sqlPath);
  logger.info('Database backup compressed', { archivePath });
  return archivePath;
}

async function uploadBackupToS3(archivePath: string, objectKey: string): Promise<void> {
  const bucket = process.env.S3_BACKUP_BUCKET!;
  const s3 = getS3Client();
  const body = fs.readFileSync(archivePath);

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      Body: body,
      ContentType: 'application/gzip',
      Metadata: {
        tenant: process.env.TENANT_NAME || 'default-tenant',
        createdAt: new Date().toISOString(),
      },
    }),
  );

  logger.info('Database backup uploaded to remote storage', { bucket, objectKey });
}

async function pruneRemoteBackups(): Promise<void> {
  if (!isRemoteBackupEnabled()) return;

  const bucket = process.env.S3_BACKUP_BUCKET!;
  const prefix = getBackupPrefix();
  const s3 = getS3Client();
  const cutoffMs = Date.now() - REMOTE_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  let deletedCount = 0;
  let continuationToken: string | undefined;

  do {
    const response = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }),
    );

    for (const object of response.Contents ?? []) {
      if (!object.Key || !object.LastModified) continue;
      if (object.LastModified.getTime() >= cutoffMs) continue;

      await s3.send(
        new DeleteObjectCommand({
          Bucket: bucket,
          Key: object.Key,
        }),
      );
      deletedCount += 1;
      logger.info('Deleted remote backup past retention policy', {
        key: object.Key,
        lastModified: object.LastModified.toISOString(),
        retentionDays: REMOTE_RETENTION_DAYS,
      });
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  if (deletedCount > 0) {
    logger.info('Remote backup retention cleanup completed', {
      deletedCount,
      retentionDays: REMOTE_RETENTION_DAYS,
    });
  }
}

function pruneOldLocalBackups(backupDir: string): void {
  const files = fs
    .readdirSync(backupDir)
    .filter((f) => f.startsWith('maple-backup-') && f.endsWith('.tar.gz'))
    .map((f) => ({ name: f, mtime: fs.statSync(path.join(backupDir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);

  for (const old of files.slice(LOCAL_MAX_BACKUPS)) {
    fs.unlinkSync(path.join(backupDir, old.name));
    logger.info('Deleted old local backup', { fileName: old.name });
  }
}

export async function runDatabaseBackup(): Promise<string | null> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    logger.error('Backup skipped: DATABASE_URL not configured');
    return null;
  }

  const backupDir = process.env.BACKUP_DIR || path.join(process.cwd(), 'backups');
  fs.mkdirSync(backupDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const sqlPath = path.join(backupDir, `maple-backup-${timestamp}.sql`);
  let archivePath: string | null = null;

  try {
    await execFileAsync('pg_dump', [databaseUrl, '-f', sqlPath, '--no-owner', '--no-acl'], {
      env: process.env,
      windowsHide: true,
    });
    logger.info('Database dump created', { sqlPath });

    archivePath = await compressSqlDump(sqlPath);

    if (isRemoteBackupEnabled()) {
      const objectKey = `${getBackupPrefix()}maple-backup-${timestamp}.tar.gz`;
      await uploadBackupToS3(archivePath, objectKey);
      await pruneRemoteBackups();
      fs.unlinkSync(archivePath);
      logger.info('Local compressed backup removed after successful remote upload', { objectKey });
      return objectKey;
    }

    pruneOldLocalBackups(backupDir);
    logger.warn(
      'Remote backup storage is not configured — keeping compressed backup locally only',
      { archivePath },
    );
    return archivePath;
  } catch (err) {
    if (fs.existsSync(sqlPath)) {
      fs.unlinkSync(sqlPath);
    }
    if (archivePath && fs.existsSync(archivePath)) {
      fs.unlinkSync(archivePath);
    }
    logger.error('Database backup failed', { error: err });
    return null;
  }
}
