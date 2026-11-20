import type { VercelRequest, VercelResponse } from '@vercel/node';

export const MAX_BODY_BYTES = 4_000_000;

export class HttpError extends Error {
  readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
  }
}

export const sendJson = (
  response: VercelResponse,
  statusCode: number,
  body: unknown,
): void => {
  response.status(statusCode).json(body);
};

export const requirePost = (
  request: VercelRequest,
  response: VercelResponse,
): boolean => {
  if (request.method === 'POST') {
    return true;
  }

  response.setHeader('Allow', 'POST');
  sendJson(response, 405, { error: 'Method not allowed' });
  return false;
};

const firstHeaderValue = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

const bodySize = (body: unknown): number => {
  if (Buffer.isBuffer(body)) {
    return body.byteLength;
  }
  if (typeof body === 'string') {
    return Buffer.byteLength(body, 'utf8');
  }

  try {
    return Buffer.byteLength(JSON.stringify(body), 'utf8');
  } catch {
    throw new HttpError(400, 'Invalid JSON body');
  }
};

export const parseJsonBody = (request: VercelRequest): unknown => {
  const contentType = firstHeaderValue(request.headers['content-type']);
  if (contentType?.split(';', 1)[0].trim().toLowerCase() !== 'application/json') {
    throw new HttpError(415, 'Content-Type must be application/json');
  }

  const contentLength = firstHeaderValue(request.headers['content-length']);
  if (contentLength !== undefined) {
    const declaredBytes = Number(contentLength);
    if (Number.isFinite(declaredBytes) && declaredBytes > MAX_BODY_BYTES) {
      throw new HttpError(413, 'Request body too large');
    }
  }

  if (bodySize(request.body) > MAX_BODY_BYTES) {
    throw new HttpError(413, 'Request body too large');
  }

  if (typeof request.body !== 'string' && !Buffer.isBuffer(request.body)) {
    return request.body;
  }

  try {
    return JSON.parse(request.body.toString());
  } catch {
    throw new HttpError(400, 'Invalid JSON body');
  }
};

export const getClientIp = (request: VercelRequest): string => {
  const forwardedFor = firstHeaderValue(request.headers['x-forwarded-for']);
  if (forwardedFor) {
    return forwardedFor.split(',', 1)[0].trim() || 'unknown';
  }

  const realIp = firstHeaderValue(request.headers['x-real-ip']);
  return realIp?.trim() || request.socket?.remoteAddress || 'unknown';
};

export const requireRecord = (value: unknown): Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new HttpError(400, 'Request body must be a JSON object');
  }
  return value as Record<string, unknown>;
};

interface StringFieldOptions {
  maxLength: number;
  minLength?: number;
}

export const requireStringField = (
  record: Record<string, unknown>,
  field: string,
  options: StringFieldOptions,
): string => {
  const value = record[field];
  if (typeof value !== 'string') {
    throw new HttpError(400, `${field} must be a string`);
  }

  const normalized = value.trim();
  const minLength = options.minLength ?? 1;
  if (normalized.length < minLength || normalized.length > options.maxLength) {
    throw new HttpError(
      400,
      `${field} must be between ${minLength} and ${options.maxLength} characters`,
    );
  }
  return normalized;
};

export const requireBase64Field = (
  record: Record<string, unknown>,
  field: string,
  maxLength: number,
): string => {
  const value = requireStringField(record, field, { maxLength });
  const base64Pattern = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
  if (!base64Pattern.test(value)) {
    throw new HttpError(400, `${field} must be valid base64`);
  }
  return value;
};

export const requireHexColorField = (
  record: Record<string, unknown>,
  field: string,
): string => {
  const value = requireStringField(record, field, { maxLength: 7 });
  const match = /^#?([0-9a-f]{6})$/i.exec(value);
  if (!match) {
    throw new HttpError(400, `${field} must be a six-digit hex color`);
  }
  return `#${match[1].toUpperCase()}`;
};

interface NumberFieldOptions {
  min: number;
  max: number;
}

export const requireNumberField = (
  record: Record<string, unknown>,
  field: string,
  options: NumberFieldOptions,
): number => {
  const value = record[field];
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < options.min ||
    value > options.max
  ) {
    throw new HttpError(
      400,
      `${field} must be a number between ${options.min} and ${options.max}`,
    );
  }
  return value;
};
