import { NextFunction, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';

// Fallback in-memory rate limiter for auth endpoints when Redis-backed limiter
// is not configured or available. This provides reasonable protection in dev.

const minuteLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
});

const hourLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

export async function authRateLimiter(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  // run minute limiter first, then hour limiter
  minuteLimiter(req, res, (err) => {
    if (err) return next(err);
    hourLimiter(req, res, next as any);
  });
}
