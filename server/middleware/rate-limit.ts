import express from 'express';

const requestBuckets = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 200;

// Prune expired buckets every 5 minutes to prevent unbounded memory growth.
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of requestBuckets) {
    if (bucket.resetAt < now) {
      requestBuckets.delete(key);
    }
  }
}, 5 * 60_000).unref();

export const rateLimitMiddleware = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) => {
  // req.ip is the real client IP when `app.set('trust proxy', 1)` is set.
  const key = req.ip || 'unknown';
  const now = Date.now();
  const bucket = requestBuckets.get(key);

  if (!bucket || bucket.resetAt < now) {
    requestBuckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return next();
  }

  if (bucket.count >= RATE_LIMIT_MAX_REQUESTS) {
    return res.status(429).json({ error: 'Too many requests. Please try again later.' });
  }

  bucket.count += 1;
  return next();
};
