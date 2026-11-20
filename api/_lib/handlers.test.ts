import type { VercelRequest, VercelResponse } from '@vercel/node';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import analyzeHandler from '../analyze';
import shoppingListHandler from '../shopping-list';
import visualizeHandler from '../visualize';
import {
  analyzeImageForPaint,
  generateShoppingList,
  visualizeColor,
} from './gemini';

vi.mock('./gemini', () => ({
  analyzeImageForPaint: vi.fn(),
  generateShoppingList: vi.fn(),
  visualizeColor: vi.fn(),
}));

const mockedAnalyze = vi.mocked(analyzeImageForPaint);
const mockedGenerateShoppingList = vi.mocked(generateShoppingList);
const mockedVisualize = vi.mocked(visualizeColor);
const originalGeminiApiKey = process.env.GEMINI_API_KEY;

afterEach(() => {
  if (originalGeminiApiKey === undefined) {
    delete process.env.GEMINI_API_KEY;
  } else {
    process.env.GEMINI_API_KEY = originalGeminiApiKey;
  }
});

const request = (
  body: unknown,
  overrides: Partial<VercelRequest> = {},
): VercelRequest =>
  ({
    body,
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': '203.0.113.10',
    },
    method: 'POST',
    ...overrides,
  }) as VercelRequest;

const response = (): VercelResponse => {
  const res = {
    json: vi.fn(),
    setHeader: vi.fn(),
    status: vi.fn(),
  };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res as unknown as VercelResponse;
};

const expectJson = (
  res: VercelResponse,
  statusCode: number,
  body: unknown,
): void => {
  expect(res.status).toHaveBeenCalledWith(statusCode);
  expect(res.json).toHaveBeenCalledWith(body);
};

describe('Gemini API handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = 'test-key';
  });

  it.each([
    ['analyze', analyzeHandler],
    ['visualize', visualizeHandler],
    ['shopping-list', shoppingListHandler],
  ])('allows only POST requests for %s', async (_name, handler) => {
    const res = response();

    await handler(request(undefined, { method: 'GET' }), res);

    expect(res.setHeader).toHaveBeenCalledWith('Allow', 'POST');
    expectJson(res, 405, { error: 'Method not allowed' });
  });

  it.each([
    ['analyze', analyzeHandler, { base64Image: 'YWJj' }],
    [
      'visualize',
      visualizeHandler,
      { base64Image: 'YWJj', colorHex: '#AABBCC', colorName: 'Cloud White' },
    ],
    [
      'shopping-list',
      shoppingListHandler,
      {
        area: 20,
        condition: 'Good',
        selectedColor: 'Cloud White',
        surfaceType: 'Plaster',
      },
    ],
  ])('returns a stable configuration error for %s', async (_name, handler, body) => {
    delete process.env.GEMINI_API_KEY;
    const res = response();

    await handler(request(body), res);

    expectJson(res, 503, { error: 'Service unavailable' });
  });

  it('rejects invalid analyze input before calling Gemini', async () => {
    const res = response();

    await analyzeHandler(request({ base64Image: 'not base64!' }), res);

    expectJson(res, 400, { error: 'base64Image must be valid base64' });
    expect(mockedAnalyze).not.toHaveBeenCalled();
  });

  it('rejects oversized optional analyze images', async () => {
    const res = response();

    await analyzeHandler(
      request({
        base64Image: 'YWJj',
        fullSizeImage: 'YWFh'.repeat(975_001),
      }),
      res,
    );

    expectJson(res, 400, {
      error: 'fullSizeImage must be between 1 and 3900000 characters',
    });
    expect(mockedAnalyze).not.toHaveBeenCalled();
  });

  it('rejects oversized visualization names before calling Gemini', async () => {
    const res = response();

    await visualizeHandler(
      request({
        base64Image: 'YWJj',
        colorHex: '#AABBCC',
        colorName: 'x'.repeat(101),
      }),
      res,
    );

    expectJson(res, 400, {
      error: 'colorName must be between 1 and 100 characters',
    });
    expect(mockedVisualize).not.toHaveBeenCalled();
  });

  it('rejects invalid visualization hex colors before calling Gemini', async () => {
    const res = response();

    await visualizeHandler(
      request({
        base64Image: 'YWJj',
        colorHex: '#GG0000',
        colorName: 'Cloud White',
      }),
      res,
    );

    expectJson(res, 400, {
      error: 'colorHex must be a six-digit hex color',
    });
    expect(mockedVisualize).not.toHaveBeenCalled();
  });

  it('rejects oversized analysis context fields before calling Gemini', async () => {
    const res = response();

    await visualizeHandler(
      request({
        analysisContext: {
          condition: 'Good',
          description: 'x'.repeat(1_001),
          surfaceType: 'Plaster',
        },
        base64Image: 'YWJj',
        colorHex: '#AABBCC',
        colorName: 'Cloud White',
      }),
      res,
    );

    expectJson(res, 400, {
      error: 'description must be between 1 and 1000 characters',
    });
    expect(mockedVisualize).not.toHaveBeenCalled();
  });

  it('rejects caller-supplied Gemini cache names', async () => {
    const res = response();

    await visualizeHandler(
      request({
        analysisContext: {
          cacheName: 'cachedContents/caller-controlled',
          condition: 'Good',
          description: 'Wall.',
          surfaceType: 'Plaster',
        },
        base64Image: 'YWJj',
        colorHex: '#AABBCC',
        colorName: 'Cloud White',
      }),
      res,
    );

    expectJson(res, 400, {
      error: 'analysisContext.cacheName is not allowed',
    });
    expect(mockedVisualize).not.toHaveBeenCalled();
  });

  it('rejects invalid shopping-list fields before calling Gemini', async () => {
    const res = response();

    await shoppingListHandler(
      request({
        area: 10_001,
        condition: 'Good',
        selectedColor: 'Cloud White',
        surfaceType: 'Plaster',
      }),
      res,
    );

    expectJson(res, 400, { error: 'area must be a number between 1 and 10000' });
    expect(mockedGenerateShoppingList).not.toHaveBeenCalled();
  });

  it('returns analysis results as JSON', async () => {
    const result = {
      condition: 'Good',
      description: 'A sound plaster wall.',
      estimatedAreaWarning: 'Measure before buying.',
      palettes: [],
      surfaceType: 'Plaster',
    };
    mockedAnalyze.mockResolvedValue(result);
    const res = response();

    await analyzeHandler(
      request({ base64Image: 'YWJj', fullSizeImage: 'ZGVm' }),
      res,
    );

    expect(mockedAnalyze).toHaveBeenCalledWith('YWJj', 'ZGVm');
    expectJson(res, 200, result);
  });

  it('returns visualization image data URLs as JSON', async () => {
    mockedVisualize.mockResolvedValue('data:image/png;base64,ZGVm');
    const res = response();
    const analysisContext = {
      condition: ' Good ',
      description: ' A sound plaster wall. ',
      estimatedAreaWarning: 'Measure before buying.',
      palettes: [],
      surfaceType: ' Plaster ',
    };

    await visualizeHandler(
      request({
        analysisContext,
        base64Image: 'YWJj',
        colorHex: 'aabbcc',
        colorName: ' Cloud White ',
      }),
      res,
    );

    expect(mockedVisualize).toHaveBeenCalledWith(
      'YWJj',
      'Cloud White',
      '#AABBCC',
      {
        condition: 'Good',
        description: 'A sound plaster wall.',
        surfaceType: 'Plaster',
      },
    );
    expect(mockedVisualize.mock.calls[0]?.[3]).not.toBe(analysisContext);
    expectJson(res, 200, 'data:image/png;base64,ZGVm');
  });

  it('returns shopping lists as JSON', async () => {
    const result = {
      estimatedLaborCostGHS: 200,
      installationNotes: 'Prepare the wall first.',
      items: [],
      totalMaterialCostGHS: 500,
    };
    mockedGenerateShoppingList.mockResolvedValue(result);
    const res = response();

    await shoppingListHandler(
      request({
        area: 20,
        condition: ' Good ',
        selectedColor: ' Cloud White ',
        surfaceType: ' Plaster ',
      }),
      res,
    );

    expect(mockedGenerateShoppingList).toHaveBeenCalledWith(
      'Plaster',
      'Good',
      'Cloud White',
      20,
    );
    expectJson(res, 200, result);
  });

  it.each([
    ['analyze', analyzeHandler, mockedAnalyze, { base64Image: 'YWJj' }],
    [
      'visualize',
      visualizeHandler,
      mockedVisualize,
      { base64Image: 'YWJj', colorHex: '#AABBCC', colorName: 'Cloud White' },
    ],
    [
      'shopping-list',
      shoppingListHandler,
      mockedGenerateShoppingList,
      {
        area: 20,
        condition: 'Good',
        selectedColor: 'Cloud White',
        surfaceType: 'Plaster',
      },
    ],
  ])(
    'normalizes provider failures for %s without exposing internals',
    async (_name, handler, operation, body) => {
      operation.mockRejectedValueOnce(
        new Error('provider rejected secret credential test-key'),
      );
      const res = response();

      await handler(request(body), res);

      expectJson(res, 502, { error: 'AI service request failed' });
      expect(res.json).not.toHaveBeenCalledWith(
        expect.objectContaining({ details: expect.anything() }),
      );
    },
  );

  it('rate limits analyze requests by client IP', async () => {
    mockedAnalyze.mockResolvedValue({
      condition: 'Good',
      description: 'Wall.',
      estimatedAreaWarning: 'Measure.',
      palettes: [],
      surfaceType: 'Plaster',
    });

    for (let count = 0; count < 10; count += 1) {
      await analyzeHandler(
        request(
          { base64Image: 'YWJj' },
          { headers: {
            'content-type': 'application/json',
            'x-forwarded-for': '198.51.100.42',
          } },
        ),
        response(),
      );
    }
    const res = response();

    await analyzeHandler(
      request(
        { base64Image: 'YWJj' },
        { headers: {
          'content-type': 'application/json',
          'x-forwarded-for': '198.51.100.42',
        } },
      ),
      res,
    );

    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', '60');
    expectJson(res, 429, { error: 'Too many requests' });
  });
});
