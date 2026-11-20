export const RATE_LIMIT_MAX_REQUESTS = 10;
export const RATE_LIMIT_WINDOW_MS = 60_000;

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

interface RateLimitWindow {
  count: number;
  startedAt: number;
}

const windows = new Map<string, RateLimitWindow>();
let nextPruneAt = 0;

const pruneExpiredWindows = (now: number): void => {
  if (now < nextPruneAt) {
    return;
  }

  for (const [key, window] of windows) {
    if (now - window.startedAt >= RATE_LIMIT_WINDOW_MS) {
      windows.delete(key);
    }
  }
  nextPruneAt = now + RATE_LIMIT_WINDOW_MS;
};

export const getServerRateLimitEntryCount = (): number => windows.size;

export const checkServerRateLimit = (
  key: string,
  now: number = Date.now(),
): RateLimitResult => {
  pruneExpiredWindows(now);
  const current = windows.get(key);

  if (!current || now - current.startedAt >= RATE_LIMIT_WINDOW_MS) {
    windows.set(key, { count: 1, startedAt: now });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (current.count >= RATE_LIMIT_MAX_REQUESTS) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil(
        (current.startedAt + RATE_LIMIT_WINDOW_MS - now) / 1_000,
      ),
    };
  }

  current.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
};
