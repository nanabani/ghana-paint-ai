import { GoogleGenAI, Type, type Schema } from '@google/genai';

import { PAINT_COLORS, formatColorsForPrompt } from '../../data/paintColors';
import type { AnalysisResult, ShoppingList } from '../../types';

export type VisualizationAnalysisContext = Pick<
  AnalysisResult,
  'surfaceType' | 'condition' | 'description'
>;

const createClient = (): GoogleGenAI => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Gemini is not configured');
  }
  return new GoogleGenAI({ apiKey });
};

const analysisSchema: Schema = {
  type: Type.OBJECT,
  required: [
    'surfaceType',
    'condition',
    'description',
    'estimatedAreaWarning',
    'palettes',
  ],
  properties: {
    surfaceType: {
      type: Type.STRING,
      description: 'Wall material: Concrete/Plaster/Wood',
    },
    condition: {
      type: Type.STRING,
      description: 'Surface condition: New/Good/Peeling/Moldy',
    },
    description: {
      type: Type.STRING,
      description:
        "Simple, informative description: Key structural features (wall locations, columns, recesses) and treatment needs if any. Keep concise (1-2 sentences). Tone: clear and helpful. Example: 'Front and side walls visible with two columns. Requires primer for peeling areas.'",
    },
    estimatedAreaWarning: {
      type: Type.STRING,
      description: 'Note about measurements needed',
    },
    palettes: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        required: ['name', 'description', 'colors'],
        properties: {
          name: { type: Type.STRING },
          description: { type: Type.STRING },
          colors: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              required: ['name', 'hex'],
              properties: {
                name: { type: Type.STRING, description: 'Paint color name' },
                hex: { type: Type.STRING, description: 'Hex color code' },
              },
            },
            description:
              'Colors ordered by relevance - most recommended colors first, then alternatives',
          },
        },
      },
    },
  },
};

const shoppingSchema: Schema = {
  type: Type.OBJECT,
  required: [
    'items',
    'totalMaterialCostGHS',
    'estimatedLaborCostGHS',
    'installationNotes',
  ],
  properties: {
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        required: [
          'name',
          'category',
          'quantity',
          'unit',
          'estimatedPriceGHS',
          'reason',
        ],
        properties: {
          name: {
            type: Type.STRING,
            description: 'Product name (e.g. 20L Emulsion Bucket)',
          },
          category: {
            type: Type.STRING,
            enum: ['Paint', 'Primer', 'Hardware', 'Preparation', 'Other'],
          },
          quantity: { type: Type.NUMBER },
          unit: { type: Type.STRING },
          estimatedPriceGHS: {
            type: Type.NUMBER,
            description: 'Price in Ghana Cedis',
          },
          reason: {
            type: Type.STRING,
            description: "Why this is needed (e.g. 'For rough surface')",
          },
        },
      },
    },
    totalMaterialCostGHS: { type: Type.NUMBER },
    estimatedLaborCostGHS: { type: Type.NUMBER },
    installationNotes: { type: Type.STRING },
  },
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isString = (value: unknown): value is string => typeof value === 'string';

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isImageMimeType = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.length <= 100 &&
  /^image\/[A-Za-z0-9][A-Za-z0-9.+-]*$/.test(value);

export const validateAnalysisResult = (value: unknown): AnalysisResult => {
  if (
    !isRecord(value) ||
    !isString(value.surfaceType) ||
    !isString(value.condition) ||
    !isString(value.description) ||
    !isString(value.estimatedAreaWarning) ||
    !Array.isArray(value.palettes)
  ) {
    throw new Error('Invalid analysis response');
  }

  const palettesAreValid = value.palettes.every(
    (palette) =>
      isRecord(palette) &&
      isString(palette.name) &&
      isString(palette.description) &&
      Array.isArray(palette.colors) &&
      palette.colors.every(
        (color) =>
          isRecord(color) && isString(color.name) && isString(color.hex),
      ),
  );
  if (!palettesAreValid) {
    throw new Error('Invalid analysis response');
  }

  return value as unknown as AnalysisResult;
};

const shoppingCategories = new Set([
  'Paint',
  'Primer',
  'Hardware',
  'Preparation',
  'Other',
]);

export const validateShoppingList = (value: unknown): ShoppingList => {
  if (
    !isRecord(value) ||
    !Array.isArray(value.items) ||
    !isFiniteNumber(value.totalMaterialCostGHS) ||
    !isFiniteNumber(value.estimatedLaborCostGHS) ||
    !isString(value.installationNotes)
  ) {
    throw new Error('Invalid shopping list response');
  }

  const itemsAreValid = value.items.every(
    (item) =>
      isRecord(item) &&
      isString(item.name) &&
      isString(item.category) &&
      shoppingCategories.has(item.category) &&
      isFiniteNumber(item.quantity) &&
      isString(item.unit) &&
      isFiniteNumber(item.estimatedPriceGHS) &&
      isString(item.reason),
  );
  if (!itemsAreValid) {
    throw new Error('Invalid shopping list response');
  }

  return value as unknown as ShoppingList;
};

export const analyzeImageForPaint = async (
  base64Image: string,
  _fullSizeImage?: string,
): Promise<AnalysisResult> => {
  const ai = createClient();
  const neuceColors = PAINT_COLORS.neuce || [];
  const azarColors = PAINT_COLORS.azar || [];

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: {
      parts: [
        { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
        {
          text: `Identify surface material, condition, and space type (interior/exterior).

For description: Write a simple, informative 1-2 sentence description covering:
- Key structural features (wall locations, columns, recesses, trim)
- Treatment needs if any (e.g., 'Requires primer for peeling areas' or 'No treatment needed')
Use clear, helpful language. Skip aesthetic details.

Generate 3 palettes:
1. "AI-CURATED SUGGESTION" - 3-4 colors from available Neuce and Azar collections
   Prioritize colors NOT in NEUCE/AZAR sections. Include: (a) colors similar to current wall, (b) complementary colors matching space style.
2. "NEUCE PAINTS" - 4-5 colors from Neuce collection (10 colors available)
3. "AZAR PAINTS" - 4-5 colors from Azar collection (10 colors available)

Order colors by relevance. Most recommended first. Use exact color names and hex codes from available collections.`,
        },
      ],
    },
    config: {
      responseMimeType: 'application/json',
      responseSchema: analysisSchema,
      systemInstruction: `Architectural consultant in Ghana. Write descriptions in simple, clear, helpful language.
Available paint colors:
- Neuce collection (10 colors): ${formatColorsForPrompt(neuceColors)}
- Azar collection (10 colors): ${formatColorsForPrompt(azarColors)}

For AI-CURATED: prioritize colors NOT in NEUCE/AZAR sections. Focus on complementary alternatives, trendy options, or unique combinations. Include colors similar to current wall (for identification) and new complementary colors (for alternatives). Match space style and lighting. Order colors strategically: first positions should mix (1) colors closest to current wall color, and (2) best recommended colors for the space. Most relevant first. Use exact name and hex from lists above.`,
    },
  });

  if (!response.text) {
    throw new Error('No analysis received from Gemini.');
  }
  return validateAnalysisResult(JSON.parse(response.text));
};

export const visualizeColor = async (
  base64Image: string,
  colorName: string,
  colorHex: string,
  analysisContext?: VisualizationAnalysisContext,
): Promise<string> => {
  const ai = createClient();
  const normalizedHex = colorHex.trim().toUpperCase().replace(/^#/, '');
  const normalizedHexWithHash = `#${normalizedHex}`;
  const enhancedPrompt = analysisContext
    ? `Paint all ${analysisContext.surfaceType} walls with ${colorName} (${normalizedHexWithHash}).
Surface: ${analysisContext.condition}. ${analysisContext.description}
Apply uniformly to all painted wall surfaces. Preserve windows, doors, furniture, sky, vegetation.`
    : `Paint all wall surfaces with ${colorName} (${normalizedHexWithHash}).
Apply uniformly. Preserve windows, doors, furniture, sky, vegetation.`;
  const systemInstruction = analysisContext
    ? `Paint visualization tool. Surface: ${analysisContext.surfaceType} (${analysisContext.condition}). Paint ALL painted wall surfaces uniformly with specified color. Preserve windows, doors, furniture, sky, vegetation.`
    : 'Paint visualization tool. Paint ALL painted wall surfaces uniformly. Preserve windows, doors, furniture, sky, vegetation.';
  const parts: Array<Record<string, unknown>> = [];

  parts.push({
    inlineData: { mimeType: 'image/jpeg', data: base64Image },
  });
  parts.push({ text: enhancedPrompt });

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: { parts },
    config: { systemInstruction },
  });

  if (response.candidates?.[0]?.finishReason === 'SAFETY') {
    throw new Error(
      'Content was blocked for safety reasons. Try a different color.',
    );
  }

  const responseParts = response.candidates?.[0]?.content?.parts;
  if (responseParts) {
    for (const part of responseParts) {
      if (part.inlineData?.data) {
        if (!isImageMimeType(part.inlineData.mimeType)) {
          throw new Error('Invalid visualization image response');
        }
        const inputBase64 = base64Image.replace(
          /^data:image\/[^;]+;base64,/,
          '',
        );
        if (inputBase64 === part.inlineData.data) {
          throw new Error(
            'The AI returned an unchanged image. Please try a different color or upload a clearer photo of the walls.',
          );
        }
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
  }

  throw new Error(
    'Failed to generate visualization image. No image data in response.',
  );
};

export const generateShoppingList = async (
  surfaceType: string,
  condition: string,
  selectedColor: string,
  area: number,
): Promise<ShoppingList> => {
  const ai = createClient();
  const response = await ai.models.generateContent({
    model: 'gemini-1.5-flash',
    contents: {
      parts: [
        {
          text: `Shopping list: ${surfaceType} wall, ${condition} condition, color '${selectedColor}', ${area}m². Include primer if needed. Add brushes, rollers, trays, masking tape, drop cloths. Prices in GHS.`,
        },
      ],
    },
    config: {
      responseMimeType: 'application/json',
      responseSchema: shoppingSchema,
      systemInstruction:
        'Hardware store sales manager in Koforidua. Include all necessary tools and materials.',
    },
  });

  if (!response.text) {
    throw new Error('No shopping list received.');
  }
  return validateShoppingList(JSON.parse(response.text));
};
