import Redis from 'ioredis';
import { logger } from '../utils/logger';

/**
 * Redis is optional. Only connect when REDIS_URL is explicitly set.
 * Local Windows/dev without Redis must not spam reconnect errors on :6379.
 */
const redisUrl = (process.env.REDIS_URL || '').trim();

let redisClient: Redis | null = null;
let redisGaveUp = false;

if (!redisUrl) {
  logger.info('Redis disabled — caching skipped (set REDIS_URL to enable)');
} else {
  try {
    let errorLogCount = 0;

    redisClient = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      retryStrategy(times) {
        if (times > 5) {
          redisGaveUp = true;
          logger.warn('Redis unavailable — stopped reconnect attempts');
          return null;
        }
        return Math.min(times * 200, 2000);
      },
    });

    redisClient.on('error', (err) => {
      errorLogCount += 1;
      // Avoid flooding logs when Redis is down (e.g. local Windows without Docker).
      if (errorLogCount <= 3 || errorLogCount % 100 === 0) {
        logger.error('Redis connection error', { error: err, count: errorLogCount });
      }
    });

    redisClient.on('connect', () => {
      redisGaveUp = false;
      errorLogCount = 0;
      logger.info('Connected to Redis server');
    });
  } catch (err) {
    logger.error('Failed to initialize Redis client', { error: err });
    redisClient = null;
  }
}

export function isRedisAvailable(): boolean {
  return !!redisClient && redisClient.status === 'ready' && !redisGaveUp;
}

export { redisClient };
