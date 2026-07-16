import { NextFunction, Request, Response } from 'express';

export function adminHeadersMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  // Strong transport and caching policies for admin-related responses
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  // For API responses (admin) prefer no-store
  res.set(
    'Cache-Control',
    'no-store, no-cache, must-revalidate, proxy-revalidate',
  );
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');

  next();
}
