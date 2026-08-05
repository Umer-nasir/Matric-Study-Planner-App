import type { NextFunction, Request, Response } from "express";

interface RateBucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, RateBucket>();

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

const WINDOW_MS = positiveInteger(process.env["AI_RATE_LIMIT_WINDOW_MS"], 15 * 60 * 1000);
const MAX_REQUESTS = positiveInteger(process.env["AI_RATE_LIMIT_MAX"], 30);

export function aiRateLimit(req: Request, res: Response, next: NextFunction): void {
  const now = Date.now();
  const key = req.ip || req.socket.remoteAddress || "unknown";
  const current = buckets.get(key);
  const bucket = !current || current.resetAt <= now
    ? { count: 0, resetAt: now + WINDOW_MS }
    : current;

  bucket.count += 1;
  buckets.set(key, bucket);
  res.setHeader("RateLimit-Limit", String(MAX_REQUESTS));
  res.setHeader("RateLimit-Remaining", String(Math.max(0, MAX_REQUESTS - bucket.count)));
  res.setHeader("RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));

  if (bucket.count > MAX_REQUESTS) {
    res.setHeader("Retry-After", String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))));
    res.status(429).json({ ok: false, error: "Too many AI requests. Please wait a few minutes and try again." });
    return;
  }

  if (buckets.size > 5000) {
    for (const [bucketKey, value] of buckets) {
      if (value.resetAt <= now) buckets.delete(bucketKey);
    }
  }
  next();
}
