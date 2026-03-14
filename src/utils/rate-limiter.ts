interface RateLimitEntry {
  timestamps: number[];
}

const transferLimits = new Map<number, RateLimitEntry>();
const quoteLimits = new Map<number, RateLimitEntry>();

const TRANSFER_LIMIT = 5;
const TRANSFER_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const QUOTE_LIMIT = 1;
const QUOTE_WINDOW_MS = 2000; // 2 seconds

function checkLimit(
  store: Map<number, RateLimitEntry>,
  userId: number,
  limit: number,
  windowMs: number,
): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  let entry = store.get(userId);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(userId, entry);
  }

  // Prune expired timestamps
  entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);

  if (entry.timestamps.length >= limit) {
    const oldest = entry.timestamps[0]!;
    const retryAfterMs = windowMs - (now - oldest);
    return { allowed: false, retryAfterMs };
  }

  entry.timestamps.push(now);
  return { allowed: true, retryAfterMs: 0 };
}

export function checkTransferLimit(userId: number): {
  allowed: boolean;
  retryAfterMs: number;
} {
  return checkLimit(transferLimits, userId, TRANSFER_LIMIT, TRANSFER_WINDOW_MS);
}

export function checkQuoteLimit(userId: number): {
  allowed: boolean;
  retryAfterMs: number;
} {
  return checkLimit(quoteLimits, userId, QUOTE_LIMIT, QUOTE_WINDOW_MS);
}

// Periodic cleanup of stale entries to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [userId, entry] of transferLimits) {
    entry.timestamps = entry.timestamps.filter(t => now - t < TRANSFER_WINDOW_MS);
    if (entry.timestamps.length === 0) transferLimits.delete(userId);
  }
  for (const [userId, entry] of quoteLimits) {
    entry.timestamps = entry.timestamps.filter(t => now - t < QUOTE_WINDOW_MS);
    if (entry.timestamps.length === 0) quoteLimits.delete(userId);
  }
}, 60 * 60 * 1000).unref();

export function formatRetryAfter(ms: number): string {
  const seconds = Math.ceil(ms / 1000);
  if (seconds < 60) return `${seconds} seconds`;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} minute${minutes > 1 ? 's' : ''}`;
}
