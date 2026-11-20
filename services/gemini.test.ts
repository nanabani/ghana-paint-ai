import { readFileSync } from 'node:fs';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  analyzeImageForPaint,
  generateShoppingList,
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
      category: 'Paint' as const,
      estimatedPriceGHS: 500,
      name: 'Emulsion',
      quantity: 1,
      reason: 'Top coat',
      unit: 'bucket',
    },
  ],
  totalMaterialCostGHS: 500,
};

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
    status,
  });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Gemini browser API client', () => {
  it('posts only the compressed image to the analyze endpoint and parses success', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValueOnce(jsonResponse(analysisResult));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      analyzeImageForPaint('compressed-image', 'unused-full-size-image'),
    ).resolves.toEqual(analysisResult);

    expect(fetchMock).toHaveBeenCalledWith('/api/analyze', {
      body: JSON.stringify({ base64Image: 'compressed-image' }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });
  });

  it('posts a cache-free analysis subset to the visualize endpoint and parses success', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValueOnce(
      jsonResponse('data:image/png;base64,visualized'),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      visualizeColor('image', 'Cloud White', '#AABBCC', {
        ...analysisResult,
        cacheName: 'cachedContents/must-not-leave-browser',
      }),
    ).resolves.toBe('data:image/png;base64,visualized');

    expect(fetchMock).toHaveBeenCalledWith('/api/visualize', {
      body: expect.any(String),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });
    const requestBody = JSON.parse(
      String(fetchMock.mock.calls[0]?.[1]?.body),
    );
    expect(requestBody).toEqual({
      analysisContext: {
        condition: 'Good',
        description: 'A sound plaster wall.',
        surfaceType: 'Plaster',
      },
      base64Image: 'image',
      colorHex: '#AABBCC',
      colorName: 'Cloud White',
    });
  });

  it('posts shopping inputs to the shopping-list endpoint and parses success', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValueOnce(jsonResponse(shoppingList));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      generateShoppingList('Plaster', 'Good', 'Cloud White', 20),
    ).resolves.toEqual(shoppingList);

    expect(fetchMock).toHaveBeenCalledWith('/api/shopping-list', {
      body: JSON.stringify({
        area: 20,
        condition: 'Good',
        selectedColor: 'Cloud White',
        surfaceType: 'Plaster',
      }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });
  });

  it.each([
    [
      'analyze',
      () => analyzeImageForPaint('image'),
    ],
    [
      'visualize',
      () => visualizeColor('image', 'Cloud White', '#AABBCC'),
    ],
    [
      'shopping list',
      () => generateShoppingList('Plaster', 'Good', 'Cloud White', 20),
    ],
  ])('surfaces stable JSON errors from %s', async (_name, operation) => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: 'Too many requests' }, 429),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(operation()).rejects.toThrow('Too many requests');
  });

  it.each([
    [
      'analysis',
      { ...analysisResult, palettes: [{ name: 'Missing nested fields' }] },
      () => analyzeImageForPaint('image'),
    ],
    [
      'visualization',
      'https://example.com/not-an-image-data-url.png',
      () => visualizeColor('image', 'Cloud White', '#AABBCC'),
    ],
    [
      'shopping list',
      {
        ...shoppingList,
        items: [{ ...shoppingList.items[0], quantity: Number.NaN }],
      },
      () => generateShoppingList('Plaster', 'Good', 'Cloud White', 20),
    ],
  ])(
    'rejects malformed successful %s payloads',
    async (_name, responseBody, operation) => {
      const fetchMock = vi.fn<typeof fetch>();
      fetchMock.mockResolvedValueOnce(jsonResponse(responseBody));
      vi.stubGlobal('fetch', fetchMock);

      await expect(operation()).rejects.toThrow(
        'Request failed. Please try again.',
      );
    },
  );

  it.each([
    ['analyze', () => analyzeImageForPaint('image')],
    [
      'visualize',
      () => visualizeColor('image', 'Cloud White', '#AABBCC'),
    ],
    [
      'shopping list',
      () => generateShoppingList('Plaster', 'Good', 'Cloud White', 20),
    ],
  ])('normalizes network rejection from %s', async (_name, operation) => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockRejectedValueOnce(
      new Error('network failure with private details'),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(operation()).rejects.toThrow(
      'Request failed. Please try again.',
    );
  });

  it('does not expose a non-JSON failure body', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValueOnce(
      new Response('upstream secret details', { status: 502 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(analyzeImageForPaint('image')).rejects.toThrow(
      'Request failed. Please try again.',
    );
  });

  it('keeps provider SDK and environment substitution out of browser code', () => {
    const serviceSource = readFileSync(
      new URL('./gemini.ts', import.meta.url),
      'utf8',
    );
    const viteSource = readFileSync(
      new URL('../vite.config.ts', import.meta.url),
      'utf8',
    );
    const htmlSource = readFileSync(
      new URL('../index.html', import.meta.url),
      'utf8',
    );

    expect(serviceSource).not.toContain('@google/genai');
    expect(serviceSource).not.toMatch(/\bprocess\.env\b|GEMINI_API_KEY|API_KEY/);
    expect(viteSource).not.toMatch(/\bloadEnv\b|\bdefine\s*:|\bprocess\.env\b/);
    expect(htmlSource).not.toContain('@google/genai');
  });

  it('uses the Vercel dev server for full-stack local development', () => {
    const packageJson = JSON.parse(
      readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
    ) as {
      scripts?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    expect(packageJson.scripts?.dev).toBe('vercel dev');
    expect(packageJson.scripts?.['dev:client']).toBe('vite');
    expect(packageJson.devDependencies?.vercel).toEqual(expect.any(String));
  });
});
