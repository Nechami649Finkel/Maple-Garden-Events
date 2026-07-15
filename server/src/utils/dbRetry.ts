import type { Prisma } from '@prisma/client';
import { logger } from './logger';

const RETRYABLE_MESSAGE_FRAGMENTS = [
  'connection pool',
  "Can't reach database server",
  'Connection terminated',
  'ECONNRESET',
  'ETIMEDOUT',
];

function isRetryableDbError(error: unknown): boolean {
  const code = (error as { code?: string })?.code;
  if (code === 'P1001' || code === 'P1002' || code === 'P1017') return true;
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return RETRYABLE_MESSAGE_FRAGMENTS.some((fragment) =>
    message.includes(fragment.toLowerCase())
  );
}

export async function withDbRetry<T>(
  fn: () => Promise<T>,
  retries = 5,
  delayMs = 2000
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries <= 0 || !isRetryableDbError(error)) throw error;
    logger.warn('DB connection failed, retrying', { delayMs, retriesLeft: retries });
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    return withDbRetry(fn, retries - 1, delayMs);
  }
}

export const neonTransactionOptions: {
  maxWait: number;
  timeout: number;
  isolationLevel?: Prisma.TransactionIsolationLevel;
} = {
  maxWait: 15000,
  timeout: 30000,
};
