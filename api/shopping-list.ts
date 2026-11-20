import type { VercelRequest, VercelResponse } from '@vercel/node';

import { generateShoppingList } from './_lib/gemini';
import {
  HttpError,
  getClientIp,
  parseJsonBody,
  requireNumberField,
  requirePost,
  requireRecord,
  requireStringField,
  sendJson,
} from './_lib/http';
import { checkServerRateLimit } from './_lib/rate-limit';

const MAX_TEXT_LENGTH = 100;

const handler = async (
  request: VercelRequest,
  response: VercelResponse,
): Promise<void> => {
  if (!requirePost(request, response)) {
    return;
  }

  const rateLimit = checkServerRateLimit(
    `shopping-list:${getClientIp(request)}`,
  );
  if (!rateLimit.allowed) {
    response.setHeader('Retry-After', String(rateLimit.retryAfterSeconds));
    sendJson(response, 429, { error: 'Too many requests' });
    return;
  }

  try {
    const body = requireRecord(await parseJsonBody(request));
    const surfaceType = requireStringField(body, 'surfaceType', {
      maxLength: MAX_TEXT_LENGTH,
    });
    const condition = requireStringField(body, 'condition', {
      maxLength: MAX_TEXT_LENGTH,
    });
    const selectedColor = requireStringField(body, 'selectedColor', {
      maxLength: MAX_TEXT_LENGTH,
    });
    const area = requireNumberField(body, 'area', { min: 1, max: 10_000 });

    if (!process.env.GEMINI_API_KEY) {
      sendJson(response, 503, { error: 'Service unavailable' });
      return;
    }

    const result = await generateShoppingList(
      surfaceType,
      condition,
      selectedColor,
      area,
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
