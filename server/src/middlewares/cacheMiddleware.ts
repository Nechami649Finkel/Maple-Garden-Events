import { Request, Response, NextFunction } from 'express';
import { redisClient } from '../config/redis';
import { logger } from '../utils/logger';

/**
 * Express middleware to cache responses in Redis.
 * @param prefix Cache key prefix (e.g., 'calendar')
 * @param expireSeconds How long the cache should live (default 1 hour)
 */
export const cacheMiddleware = (prefix: string, expireSeconds: number = 3600) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!redisClient) {
      return next(); // Skip caching if Redis is not configured/available
    }

    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Generate a consistent cache key based on URL and query params
    const cacheKey = `${prefix}:${req.originalUrl}`;

    try {
      if (redisClient.status !== 'ready') {
         // Connect if it's the first time
         await redisClient.connect().catch(() => {});
      }

      if (redisClient.status === 'ready') {
        const cachedData = await redisClient.get(cacheKey);
        
        if (cachedData) {
          logger.info(`Cache HIT for ${cacheKey}`);
          return res.json(JSON.parse(cachedData));
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
      if (redisClient && redisClient.status === 'ready' && res.statusCode >= 200 && res.statusCode < 300) {
        redisClient.set(cacheKey, JSON.stringify(body), 'EX', expireSeconds).catch(err => {
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
  if (!redisClient || redisClient.status !== 'ready') return;
  try {
    const keys = await redisClient.keys(`${prefix}:*`);
    if (keys.length > 0) {
      await redisClient.del(...keys);
      logger.info(`Invalidated cache for prefix ${prefix}`);
    }
  } catch (err) {
    logger.warn(`Failed to invalidate cache for ${prefix}`, { error: err });
  }
};
