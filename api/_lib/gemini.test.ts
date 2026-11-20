import { beforeEach, describe, expect, it, vi } from 'vitest';

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
});

describe('Gemini server operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = 'test-key';
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
