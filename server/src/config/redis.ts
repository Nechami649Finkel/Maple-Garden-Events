import Redis from 'ioredis';
import { logger } from '../utils/logger';

// If REDIS_URL is not set, we'll try to connect to the local docker container by default
const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

// We create a lazily initialized client so the app doesn't crash if Redis is down
let redisClient: Redis | null = null;

try {
  redisClient = new Redis(redisUrl, {
    lazyConnect: true, // Connect when the first command is sent
    retryStrategy(times) {
      const delay = Math.min(times * 50, 2000);
      return delay;
    }
  });

  redisClient.on('error', (err) => {
    logger.error('Redis connection error', { error: err });
  });

  redisClient.on('connect', () => {
    logger.info('Connected to Redis server');
  });

} catch (err) {
  logger.error('Failed to initialize Redis client', { error: err });
}

export { redisClient };
