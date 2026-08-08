import rateLimit from 'express-rate-limit';
import type { RequestHandler } from 'express';

// Creates two rate limiters for auth endpoints. If REDIS_URL is configured and
// the optional dependencies (ioredis + rate-limit-redis) are installed, a
// Redis-backed store will be used for cross-process limits. Otherwise falls
// back to in-memory store (suitable for dev).
export async function createAuthLimiters(): Promise<{
  minuteLimiter: RequestHandler;
  hourLimiter: RequestHandler;
}> {
  const perMinuteOptions = {
    windowMs: 60 * 1000,
    max: 10,
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: any, res: any) => {
      res.setHeader('Retry-After', String(60));
      res
        .status(429)
        .json({ message: 'Too many requests (per-minute). Try again later.' });
    },
  };

  const perHourOptions = {
    windowMs: 60 * 60 * 1000,
    max: 100,
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: any, res: any) => {
      res.setHeader('Retry-After', String(60 * 60));
      res
        .status(429)
        .json({ message: 'Too many requests (per-hour). Try again later.' });
    },
  };

  const redisUrl = process.env.REDIS_URL;

  if (redisUrl) {
    try {
      // Require optional dependencies at runtime so project doesn't fail if
      // they're not installed in development.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const IORedis = require('ioredis');
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const RedisStore = require('rate-limit-redis');

      const client = new IORedis(redisUrl);

      const minuteLimiter = rateLimit({
        ...perMinuteOptions,
        // rate-limit-redis accepts a `sendCommand` or `client` depending on version.
        store: new RedisStore({ client }),
      });

      const hourLimiter = rateLimit({
        ...perHourOptions,
        store: new RedisStore({ client }),
      });

      console.log('Using Redis-backed rate limiter');
      return { minuteLimiter, hourLimiter };
    } catch (err) {
      console.warn(
        'Redis rate limiter requested but optional packages not available:',
        err?.message || err,
      );
      // fall through to in-memory fallback
    }
  }

  // Fallback in-memory limiters
  const minuteLimiter = rateLimit({
    windowMs: perMinuteOptions.windowMs,
    max: perMinuteOptions.max,
    standardHeaders: perMinuteOptions.standardHeaders,
    legacyHeaders: perMinuteOptions.legacyHeaders,
    handler: perMinuteOptions.handler,
  });

  const hourLimiter = rateLimit({
    windowMs: perHourOptions.windowMs,
    max: perHourOptions.max,
    standardHeaders: perHourOptions.standardHeaders,
    legacyHeaders: perHourOptions.legacyHeaders,
    handler: perHourOptions.handler,
  });

  console.log('Using in-memory rate limiter (no Redis configured)');
  return { minuteLimiter, hourLimiter };
}
