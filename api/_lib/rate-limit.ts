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

export const checkServerRateLimit = (
  key: string,
  now: number = Date.now(),
): RateLimitResult => {
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
