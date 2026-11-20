import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sdk = vi.hoisted(() => {
  const generateContent = vi.fn();
  const cacheCreate = vi.fn();
  return {
    cacheCreate,
    client: {
      caches: { create: cacheCreate },
      models: { generateContent },
    },
    generateContent,
  };
});

vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    constructor() {
      return sdk.client;
    }
  },
  Type: {
    ARRAY: 'ARRAY',
    NUMBER: 'NUMBER',
    OBJECT: 'OBJECT',
    STRING: 'STRING',
  },
}));

import {
  analyzeImageForPaint,
  generateShoppingList,
  isGeminiConfigured,
  validateAnalysisResult,
  validateShoppingList,
  visualizeColor,
} from './gemini';

const analysisResult = {
  condition: 'Good',
  description: 'A sound plaster wall.',
  estimatedAreaWarning: 'Measure before buying.',
  palettes: [
    {
      colors: [{ hex: '#AABBCC', name: 'Cloud White' }],
      description: 'A neutral palette.',
      name: 'Neutrals',
    },
  ],
  surfaceType: 'Plaster',
};

const shoppingList = {
  estimatedLaborCostGHS: 200,
  installationNotes: 'Prepare the wall first.',
  items: [
    {
      category: 'Paint',
      estimatedPriceGHS: 500,
      name: 'Emulsion',
      quantity: 1,
      reason: 'Top coat',
      unit: 'bucket',
    },
  ],
  totalMaterialCostGHS: 500,
};

const originalGeminiApiKey = process.env.GEMINI_API_KEY;

afterEach(() => {
  if (originalGeminiApiKey === undefined) {
    delete process.env.GEMINI_API_KEY;
  } else {
    process.env.GEMINI_API_KEY = originalGeminiApiKey;
  }
});

describe('Gemini response validation', () => {
  it('accepts a complete analysis result', () => {
    expect(validateAnalysisResult(analysisResult)).toEqual(analysisResult);
  });

  it.each([
    { ...analysisResult, surfaceType: undefined },
    { ...analysisResult, palettes: [{ name: 'Broken' }] },
    {
      ...analysisResult,
      palettes: [
        {
          ...analysisResult.palettes[0],
          colors: [{ hex: 123, name: 'Broken' }],
        },
      ],
    },
  ])('rejects malformed analysis results', (value) => {
    expect(() => validateAnalysisResult(value)).toThrow(
      'Invalid analysis response',
    );
  });

  it.each([
    ['oversized palette arrays', { ...analysisResult, palettes: Array(11).fill(analysisResult.palettes[0]) }],
    ['oversized color arrays', {
      ...analysisResult,
      palettes: [{
        ...analysisResult.palettes[0],
        colors: Array(21).fill(analysisResult.palettes[0].colors[0]),
      }],
    }],
    ['oversized strings', { ...analysisResult, description: 'x'.repeat(1_001) }],
    ['invalid hex colors', {
      ...analysisResult,
      palettes: [{
        ...analysisResult.palettes[0],
        colors: [{ hex: 'red', name: 'Broken' }],
      }],
    }],
  ])('rejects analysis results with %s', (_name, value) => {
    expect(() => validateAnalysisResult(value)).toThrow(
      'Invalid analysis response',
    );
  });

  it('accepts a complete shopping list', () => {
    expect(validateShoppingList(shoppingList)).toEqual(shoppingList);
  });

  it.each([
    { ...shoppingList, totalMaterialCostGHS: Number.NaN },
    {
      ...shoppingList,
      items: [{ ...shoppingList.items[0], category: 'Credential' }],
    },
    {
      ...shoppingList,
      items: [{ ...shoppingList.items[0], reason: undefined }],
    },
  ])('rejects malformed shopping lists', (value) => {
    expect(() => validateShoppingList(value)).toThrow(
      'Invalid shopping list response',
    );
  });

  it.each([
    ['oversized item arrays', { ...shoppingList, items: Array(101).fill(shoppingList.items[0]) }],
    ['oversized strings', { ...shoppingList, installationNotes: 'x'.repeat(2_001) }],
    ['out-of-range quantities', {
      ...shoppingList,
      items: [{ ...shoppingList.items[0], quantity: 10_001 }],
    }],
    ['negative costs', { ...shoppingList, totalMaterialCostGHS: -1 }],
    ['non-finite costs', { ...shoppingList, estimatedLaborCostGHS: Number.POSITIVE_INFINITY }],
  ])('rejects shopping lists with %s', (_name, value) => {
    expect(() => validateShoppingList(value)).toThrow(
      'Invalid shopping list response',
    );
  });
});

describe('Gemini server operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = 'test-key';
  });

  it('reports whether Gemini is configured', () => {
    delete process.env.GEMINI_API_KEY;
    expect(isGeminiConfigured()).toBe(false);

    process.env.GEMINI_API_KEY = 'test-key';
    expect(isGeminiConfigured()).toBe(true);
  });

  it('requires all analysis schema fields and never creates cached content', async () => {
    sdk.generateContent.mockResolvedValueOnce({
      text: JSON.stringify(analysisResult),
    });

    await expect(
      analyzeImageForPaint('YWJj', 'ZGVm'),
    ).resolves.toEqual(analysisResult);

    const request = sdk.generateContent.mock.calls[0]?.[0];
    expect(request.config.responseSchema.required).toEqual([
      'surfaceType',
      'condition',
      'description',
      'estimatedAreaWarning',
      'palettes',
    ]);
    expect(sdk.cacheCreate).not.toHaveBeenCalled();
  });

  it('rejects malformed analysis JSON from Gemini', async () => {
    sdk.generateContent.mockResolvedValueOnce({
      text: JSON.stringify({ surfaceType: 'Plaster' }),
    });

    await expect(analyzeImageForPaint('YWJj')).rejects.toThrow(
      'Invalid analysis response',
    );
  });

  it('always sends the supplied image when visualizing with analysis context', async () => {
    sdk.generateContent.mockResolvedValueOnce({
      candidates: [
        {
          content: {
            parts: [
              {
                inlineData: {
                  data: 'ZGVm',
                  mimeType: 'image/png',
                },
              },
            ],
          },
        },
      ],
    });

    await expect(
      visualizeColor('YWJj', 'Cloud White', '#AABBCC', {
        condition: 'Good',
        description: 'A sound plaster wall.',
        surfaceType: 'Plaster',
      }),
    ).resolves.toBe('data:image/png;base64,ZGVm');

    const request = sdk.generateContent.mock.calls[0]?.[0];
    expect(request.contents.parts[0]).toEqual({
      inlineData: { data: 'YWJj', mimeType: 'image/jpeg' },
    });
    expect(request.contents.parts).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ cachedContent: expect.anything() })]),
    );
  });

  it.each([
    ['missing', undefined],
    ['non-image', 'text/plain'],
    ['oversized', `image/${'a'.repeat(100)}`],
    ['disallowed image', 'image/gif'],
  ])('rejects a visualization with a %s MIME type', async (_name, mimeType) => {
    sdk.generateContent.mockResolvedValueOnce({
      candidates: [
        {
          content: {
            parts: [{ inlineData: { data: 'ZGVm', mimeType } }],
          },
        },
      ],
    });

    await expect(
      visualizeColor('YWJj', 'Cloud White', '#AABBCC'),
    ).rejects.toThrow('Invalid visualization image response');
  });

  it.each([
    ['invalid base64', 'not base64!'],
    ['oversized base64', 'a'.repeat(4_000_001)],
  ])('rejects visualization %s payloads', async (_name, data) => {
    sdk.generateContent.mockResolvedValueOnce({
      candidates: [
        {
          content: {
            parts: [{ inlineData: { data, mimeType: 'image/jpeg' } }],
          },
        },
      ],
    });

    await expect(
      visualizeColor('YWJj', 'Cloud White', '#AABBCC'),
    ).rejects.toThrow('Invalid visualization image response');
  });

  it('requires all shopping schema fields and validates parsed JSON', async () => {
    sdk.generateContent.mockResolvedValueOnce({
      text: JSON.stringify(shoppingList),
    });

    await expect(
      generateShoppingList('Plaster', 'Good', 'Cloud White', 20),
    ).resolves.toEqual(shoppingList);

    const request = sdk.generateContent.mock.calls[0]?.[0];
    expect(request.config.responseSchema.required).toEqual([
      'items',
      'totalMaterialCostGHS',
      'estimatedLaborCostGHS',
      'installationNotes',
    ]);
  });

  it('rejects malformed shopping-list JSON from Gemini', async () => {
    sdk.generateContent.mockResolvedValueOnce({
      text: JSON.stringify({ items: [] }),
    });

    await expect(
      generateShoppingList('Plaster', 'Good', 'Cloud White', 20),
    ).rejects.toThrow('Invalid shopping list response');
  });
});
