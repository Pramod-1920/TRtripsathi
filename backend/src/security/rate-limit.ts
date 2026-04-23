import rateLimit from 'express-rate-limit';
import type { RequestHandler } from 'express';

// Two layered rate limiters for auth endpoints:
//  - per-minute limiter: 5 requests / minute
//  - per-hour limiter: 20 requests / hour

export const perMinuteLimiter: RequestHandler = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res
      .status(429)
      .json({ message: 'Too many requests. Try again later (per-minute).' });
  },
});

export const perHourLimiter: RequestHandler = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    // Extra locking behavior can be implemented by recording blocked IPs in Redis if desired.
    res
      .status(429)
      .json({ message: 'Too many requests. Try again later (per-hour).' });
  },
});
