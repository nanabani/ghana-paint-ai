import type { VercelRequest, VercelResponse } from '@vercel/node';
import { describe, expect, it, vi } from 'vitest';

import {
  MAX_BODY_BYTES,
  getClientIp,
  parseJsonBody,
  requireBase64Field,
  requireHexColorField,
  requireNumberField,
  requirePost,
  requireRecord,
  requireStringField,
  sendJson,
} from './http';

const request = (overrides: Partial<VercelRequest> = {}): VercelRequest =>
  ({
    body: undefined,
    headers: {},
    method: 'POST',
    ...overrides,
  }) as VercelRequest;

const response = (): VercelResponse => {
  const res = {
    setHeader: vi.fn(),
    status: vi.fn(),
    json: vi.fn(),
  };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res as unknown as VercelResponse;
};

describe('requirePost', () => {
  it('rejects non-POST methods with a JSON 405 response', () => {
    const req = request({ method: 'GET' });
    const res = response();

    expect(requirePost(req, res)).toBe(false);
    expect(res.setHeader).toHaveBeenCalledWith('Allow', 'POST');
    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({ error: 'Method not allowed' });
  });

  it('accepts POST requests without writing a response', () => {
    const res = response();

    expect(requirePost(request(), res)).toBe(true);
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe('parseJsonBody', () => {
  it('rejects requests without a JSON content type', () => {
    const req = request({
      body: '{}',
      headers: { 'content-type': 'text/plain' },
    });

    expect(() => parseJsonBody(req)).toThrowError(
      expect.objectContaining({
        message: 'Content-Type must be application/json',
        statusCode: 415,
      }),
    );
  });

  it('rejects requests whose declared body exceeds 4,000,000 bytes', () => {
    const req = request({
      body: '{}',
      headers: {
        'content-length': String(MAX_BODY_BYTES + 1),
        'content-type': 'application/json',
      },
    });

    expect(() => parseJsonBody(req)).toThrowError(
      expect.objectContaining({
        message: 'Request body too large',
        statusCode: 413,
      }),
    );
  });

  it('rejects a body whose actual UTF-8 size exceeds 4,000,000 bytes', () => {
    const req = request({
      body: JSON.stringify({ image: 'a'.repeat(MAX_BODY_BYTES) }),
      headers: { 'content-type': 'application/json' },
    });

    expect(() => parseJsonBody(req)).toThrowError(
      expect.objectContaining({ statusCode: 413 }),
    );
  });

  it('rejects malformed JSON', () => {
    const req = request({
      body: '{',
      headers: { 'content-type': 'application/json' },
    });

    expect(() => parseJsonBody(req)).toThrowError(
      expect.objectContaining({
        message: 'Invalid JSON body',
        statusCode: 400,
      }),
    );
  });

  it('returns an object body already parsed by Vercel', () => {
    const body = { image: 'YWJj' };
    const req = request({
      body,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });

    expect(parseJsonBody(req)).toBe(body);
  });
});

describe('field validators', () => {
  it('rejects non-object request bodies', () => {
    expect(() => requireRecord([])).toThrowError(
      expect.objectContaining({ statusCode: 400 }),
    );
  });

  it('rejects missing, blank, and oversized strings', () => {
    expect(() => requireStringField({}, 'name', { maxLength: 10 })).toThrow();
    expect(() =>
      requireStringField({ name: '   ' }, 'name', { maxLength: 10 }),
    ).toThrow();
    expect(() =>
      requireStringField({ name: '12345678901' }, 'name', { maxLength: 10 }),
    ).toThrow();
  });

  it('trims a valid bounded string', () => {
    expect(
      requireStringField({ name: '  Warm white  ' }, 'name', {
        maxLength: 20,
      }),
    ).toBe('Warm white');
  });

  it('rejects malformed base64 and oversized image fields', () => {
    expect(() => requireBase64Field({ image: 'not base64!' }, 'image', 100)).toThrow();
    expect(() =>
      requireBase64Field({ image: 'YQ==YQ==' }, 'image', 100),
    ).toThrow();
    expect(() =>
      requireBase64Field({ image: 'YWFh' }, 'image', 3),
    ).toThrow();
  });

  it('rejects malformed hex colors', () => {
    expect(() => requireHexColorField({ color: '#12GG00' }, 'color')).toThrow();
    expect(requireHexColorField({ color: 'a1B2c3' }, 'color')).toBe('#A1B2C3');
  });

  it('rejects non-finite and out-of-range numbers', () => {
    expect(() =>
      requireNumberField({ area: Number.NaN }, 'area', { min: 1, max: 10_000 }),
    ).toThrow();
    expect(() =>
      requireNumberField({ area: 0 }, 'area', { min: 1, max: 10_000 }),
    ).toThrow();
    expect(requireNumberField({ area: 25 }, 'area', { min: 1, max: 10_000 })).toBe(25);
  });
});

describe('HTTP helpers', () => {
  it('writes JSON with the requested status', () => {
    const res = response();

    sendJson(res, 429, { error: 'Too many requests' });

    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith({ error: 'Too many requests' });
  });

  it('uses the first forwarded client IP', () => {
    const req = request({
      headers: { 'x-forwarded-for': '203.0.113.8, 10.0.0.1' },
    });

    expect(getClientIp(req)).toBe('203.0.113.8');
  });

  it('falls back safely when no client IP header exists', () => {
    expect(getClientIp(request())).toBe('unknown');
  });
});
