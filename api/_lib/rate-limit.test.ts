import { describe, expect, it } from 'vitest';

import {
  RATE_LIMIT_MAX_REQUESTS,
  RATE_LIMIT_WINDOW_MS,
  checkServerRateLimit,
} from './rate-limit';

describe('checkServerRateLimit', () => {
  it('allows requests while capacity remains in the fixed window', () => {
    const key = 'capacity-test';

    for (let count = 0; count < RATE_LIMIT_MAX_REQUESTS; count += 1) {
      expect(checkServerRateLimit(key, 1_000)).toEqual({
        allowed: true,
        retryAfterSeconds: 0,
      });
    }
  });

  it('rejects requests after the fixed-window capacity is exhausted', () => {
    const key = 'exhaustion-test';

    for (let count = 0; count < RATE_LIMIT_MAX_REQUESTS; count += 1) {
      checkServerRateLimit(key, 10_000);
    }

    expect(checkServerRateLimit(key, 10_000)).toEqual({
      allowed: false,
      retryAfterSeconds: Math.ceil(RATE_LIMIT_WINDOW_MS / 1_000),
    });
  });

  it('starts a fresh window after the previous window expires', () => {
    const key = 'reset-test';
    const startedAt = 20_000;

    for (let count = 0; count < RATE_LIMIT_MAX_REQUESTS; count += 1) {
      checkServerRateLimit(key, startedAt);
    }
    expect(checkServerRateLimit(key, startedAt).allowed).toBe(false);

    expect(checkServerRateLimit(key, startedAt + RATE_LIMIT_WINDOW_MS)).toEqual({
      allowed: true,
      retryAfterSeconds: 0,
    });
  });

  it('reports a whole-second retry delay rounded up', () => {
    const key = 'retry-delay-test';
    const startedAt = 30_000;

    for (let count = 0; count < RATE_LIMIT_MAX_REQUESTS; count += 1) {
      checkServerRateLimit(key, startedAt);
    }

    expect(checkServerRateLimit(key, startedAt + 1).retryAfterSeconds).toBe(
      Math.ceil((RATE_LIMIT_WINDOW_MS - 1) / 1_000),
    );
  });
});
