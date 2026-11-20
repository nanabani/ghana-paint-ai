import type { VercelRequest, VercelResponse } from '@vercel/node';

import {
  analyzeImageForPaint,
  isGeminiConfigured,
} from './_lib/gemini';
import {
  HttpError,
  getClientIp,
  parseJsonBody,
  requireBase64Field,
  requirePost,
  requireRecord,
  sendJson,
} from './_lib/http';
import { checkServerRateLimit } from './_lib/rate-limit';

const MAX_IMAGE_LENGTH = 3_900_000;

const handler = async (
  request: VercelRequest,
  response: VercelResponse,
): Promise<void> => {
  if (!requirePost(request, response)) {
    return;
  }

  try {
    const body = requireRecord(await parseJsonBody(request));
    const base64Image = requireBase64Field(
      body,
      'base64Image',
      MAX_IMAGE_LENGTH,
    );
    const fullSizeImage =
      body.fullSizeImage === undefined
        ? undefined
        : requireBase64Field(body, 'fullSizeImage', MAX_IMAGE_LENGTH);

    if (!isGeminiConfigured()) {
      sendJson(response, 503, { error: 'Service unavailable' });
      return;
    }

    const rateLimit = checkServerRateLimit(`gemini:${getClientIp(request)}`);
    if (!rateLimit.allowed) {
      response.setHeader('Retry-After', String(rateLimit.retryAfterSeconds));
      sendJson(response, 429, { error: 'Too many requests' });
      return;
    }

    const result = await analyzeImageForPaint(base64Image, fullSizeImage);
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
