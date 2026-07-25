import { Request, Response, NextFunction } from 'express';
import { redisClient, isRedisAvailable } from '../config/redis';
import { logger } from '../utils/logger';

let connectAttemptInFlight: Promise<void> | null = null;
let skipRedisUntil = 0;

async function ensureRedisReady(): Promise<boolean> {
  if (!redisClient) return false;
  if (isRedisAvailable()) return true;
  if (Date.now() < skipRedisUntil) return false;

  if (!connectAttemptInFlight) {
    connectAttemptInFlight = redisClient
      .connect()
      .then(() => undefined)
      .catch(() => {
        // Back off for 30s so failed local Redis does not retry on every request.
        skipRedisUntil = Date.now() + 30_000;
      })
      .finally(() => {
        connectAttemptInFlight = null;
      });
  }

  await connectAttemptInFlight;
  return isRedisAvailable();
}

/**
 * Express middleware to cache responses in Redis.
 * @param prefix Cache key prefix (e.g., 'calendar')
 * @param expireSeconds How long the cache should live (default 1 hour)
 */
export const cacheMiddleware = (prefix: string, expireSeconds: number = 3600) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!redisClient) {
      return next(); // Skip caching if Redis is not configured
    }

    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Generate a consistent cache key based on URL and query params
    const cacheKey = `${prefix}:${req.originalUrl}`;

    try {
      const ready = await ensureRedisReady();
      if (ready) {
        const fetchPromise = redisClient.get(cacheKey);
        const timeoutPromise = new Promise<null>((_, reject) =>
          setTimeout(() => reject(new Error('Redis timeout')), 1000)
        );

        const cachedData = await Promise.race([fetchPromise, timeoutPromise]);

        if (cachedData) {
          logger.info(`Cache HIT for ${cacheKey}`);
          return res.json(JSON.parse(cachedData as string));
        }
      }
    } catch (err) {
      logger.warn(`Redis cache error for ${cacheKey}`, { error: err });
    }

    // Override res.json to intercept the response and cache it
    const originalJson = res.json.bind(res);
    res.json = (body: any) => {
      // Send response to client first
      originalJson(body);

      // Save to cache asynchronously
      if (isRedisAvailable() && res.statusCode >= 200 && res.statusCode < 300) {
        redisClient!.set(cacheKey, JSON.stringify(body), 'EX', expireSeconds).catch(err => {
          logger.warn(`Failed to set cache for ${cacheKey}`, { error: err });
        });
      }
      return res;
    };

    next();
  };
};

/**
 * Utility to invalidate cache by prefix.
 * Call this in POST/PUT/DELETE controllers to clear stale data.
 */
export const invalidateCache = async (prefix: string) => {
  if (!isRedisAvailable() || !redisClient) return;
  try {
    let cursor = '0';
    do {
      // ioredis returns [cursor, keys] for scan
      const res = await redisClient.scan(cursor, 'MATCH', `${prefix}:*`, 'COUNT', 100);
      cursor = res[0];
      const keys = res[1];

      if (keys.length > 0) {
        await redisClient.del(...keys);
      }
    } while (cursor !== '0');

    logger.info(`Invalidated cache for prefix ${prefix}`);
  } catch (err) {
    logger.warn(`Failed to invalidate cache for ${prefix}`, { error: err });
  }
};
