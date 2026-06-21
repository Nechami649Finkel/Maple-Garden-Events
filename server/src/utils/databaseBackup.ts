import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { logger } from './logger';

const execFileAsync = promisify(execFile);

const MAX_BACKUPS = Number(process.env.BACKUP_RETENTION_COUNT || 7);

export async function runDatabaseBackup(): Promise<string | null> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    logger.error('Backup skipped: DATABASE_URL not configured');
    return null;
  }

  const backupDir = process.env.BACKUP_DIR || path.join(process.cwd(), 'backups');
  fs.mkdirSync(backupDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filePath = path.join(backupDir, `maple-backup-${timestamp}.sql`);

  try {
    await execFileAsync('pg_dump', [databaseUrl, '-f', filePath, '--no-owner', '--no-acl'], {
      env: process.env,
      windowsHide: true,
    });
    logger.info('Database backup saved', { filePath });
    pruneOldBackups(backupDir);
    return filePath;
  } catch (err) {
    logger.error('pg_dump failed — ensure pg_dump is installed or use Neon automatic backups', { error: err });
    return null;
  }
}

function pruneOldBackups(backupDir: string): void {
  const files = fs.readdirSync(backupDir)
    .filter((f) => f.startsWith('maple-backup-') && f.endsWith('.sql'))
    .map((f) => ({ name: f, mtime: fs.statSync(path.join(backupDir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);

  for (const old of files.slice(MAX_BACKUPS)) {
    fs.unlinkSync(path.join(backupDir, old.name));
    logger.info('Deleted old backup', { fileName: old.name });
  }
}
