import { NextFunction, Request, Response } from 'express';
import crypto from 'crypto';

// Middleware that enforces a double-submit cookie pattern for state-changing requests.
// It looks for a non-httpOnly cookie named `csrf_token` and requires either:
// - a matching `x-csrf-token` header, OR
// - a request body property `csrfToken` that matches the cookie (used for sendBeacon fallback)

export function csrfMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const method = req.method.toUpperCase();

  // Only protect state-changing methods
  if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
    return next();
  }

  const csrfCookie = req.cookies?.csrf_token as string | undefined;
  const hasAuthCookie =
    !!req.cookies?.access_token ||
    !!req.cookies?.refresh_token ||
    !!req.cookies?.csrf_token;
  const path = req.path || req.originalUrl || '';
  const isAuthBootstrap =
    path.startsWith('/auth/login') ||
    path.startsWith('/auth/signup') ||
    path.startsWith('/auth/refresh');

  // If we're not using cookie-based auth, CSRF protection is not applicable.
  if (!hasAuthCookie || isAuthBootstrap) {
    return next();
  }
  const headerToken = req.get('x-csrf-token') || undefined;
  const body = (req.body ?? {}) as Record<string, unknown>;
  const bodyToken =
    typeof body.csrfToken === 'string'
      ? body.csrfToken
      : typeof body.csrf_token === 'string'
        ? body.csrf_token
        : undefined;

  if (!csrfCookie) {
    return res.status(403).json({ message: 'Missing CSRF cookie' });
  }

  // Compare header first (preferred). Then body (sendBeacon fallback).
  if (headerToken && headerToken === csrfCookie) return next();
  if (bodyToken && bodyToken === csrfCookie) return next();

  return res.status(403).json({ message: 'Invalid CSRF token' });
}

export function generateCsrfToken(): string {
  return crypto.randomBytes(24).toString('hex');
}
