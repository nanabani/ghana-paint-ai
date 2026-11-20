import type { VercelRequest, VercelResponse } from '@vercel/node';

import {
  type AnalysisWithCache,
  visualizeColor,
} from './_lib/gemini';
import {
  HttpError,
  getClientIp,
  parseJsonBody,
  requireBase64Field,
  requireHexColorField,
  requirePost,
  requireRecord,
  requireStringField,
  sendJson,
} from './_lib/http';
import { checkServerRateLimit } from './_lib/rate-limit';

const MAX_IMAGE_LENGTH = 3_900_000;
const MAX_NAME_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 1_000;
const MAX_CACHE_NAME_LENGTH = 256;

const validateAnalysisContext = (value: unknown): AnalysisWithCache => {
  const context = requireRecord(value);
  requireStringField(context, 'surfaceType', { maxLength: MAX_NAME_LENGTH });
  requireStringField(context, 'condition', { maxLength: MAX_NAME_LENGTH });
  requireStringField(context, 'description', {
    maxLength: MAX_DESCRIPTION_LENGTH,
  });
  if (context.cacheName !== undefined) {
    requireStringField(context, 'cacheName', {
      maxLength: MAX_CACHE_NAME_LENGTH,
    });
  }
  return context as unknown as AnalysisWithCache;
};

const handler = async (
  request: VercelRequest,
  response: VercelResponse,
): Promise<void> => {
  if (!requirePost(request, response)) {
    return;
  }

  const rateLimit = checkServerRateLimit(`visualize:${getClientIp(request)}`);
  if (!rateLimit.allowed) {
    response.setHeader('Retry-After', String(rateLimit.retryAfterSeconds));
    sendJson(response, 429, { error: 'Too many requests' });
    return;
  }

  try {
    const body = requireRecord(await parseJsonBody(request));
    const base64Image = requireBase64Field(
      body,
      'base64Image',
      MAX_IMAGE_LENGTH,
    );
    const colorName = requireStringField(body, 'colorName', {
      maxLength: MAX_NAME_LENGTH,
    });
    const colorHex = requireHexColorField(body, 'colorHex');
    const analysisContext =
      body.analysisContext === undefined
        ? undefined
        : validateAnalysisContext(body.analysisContext);

    if (!process.env.GEMINI_API_KEY) {
      sendJson(response, 503, { error: 'Service unavailable' });
      return;
    }

    const result = await visualizeColor(
      base64Image,
      colorName,
      colorHex,
      analysisContext,
    );
    sendJson(response, 200, result);
  } catch (error) {
    if (error instanceof HttpError) {
      sendJson(response, error.statusCode, { error: error.message });
      return;
    }
    sendJson(response, 502, { error: 'AI service request failed' });
  }
};

export default handler;
