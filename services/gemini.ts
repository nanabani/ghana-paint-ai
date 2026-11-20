import type { AnalysisResult, ShoppingList } from '../types';

const REQUEST_ERROR_MESSAGE = 'Request failed. Please try again.';

type AnalysisContext = Pick<
  AnalysisResult,
  'surfaceType' | 'condition' | 'description'
>;

interface ErrorResponse {
  error: string;
}

type ResponseValidator<ResponseBody> = (
  value: unknown,
) => value is ResponseBody;

const SHOPPING_CATEGORIES = new Set([
  'Paint',
  'Primer',
  'Hardware',
  'Preparation',
  'Other',
]);

const IMAGE_DATA_URL_PATTERN =
  /^data:image\/[A-Za-z0-9.+-]+;base64,[A-Za-z0-9+/]+={0,2}$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isString = (value: unknown): value is string =>
  typeof value === 'string';

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isErrorResponse = (value: unknown): value is ErrorResponse => {
  if (!isRecord(value)) {
    return false;
  }

  const error = value.error;
  return typeof error === 'string' && error.length > 0;
};

const isAnalysisResult = (value: unknown): value is AnalysisResult => {
  if (
    !isRecord(value) ||
    !isString(value.surfaceType) ||
    !isString(value.condition) ||
    !isString(value.description) ||
    !isString(value.estimatedAreaWarning) ||
    !Array.isArray(value.palettes)
  ) {
    return false;
  }

  return value.palettes.every(
    (palette) =>
      isRecord(palette) &&
      isString(palette.name) &&
      isString(palette.description) &&
      Array.isArray(palette.colors) &&
      palette.colors.every(
        (color) =>
          isRecord(color) &&
          isString(color.name) &&
          isString(color.hex),
      ),
  );
};

const isVisualizationResult = (value: unknown): value is string =>
  isString(value) && IMAGE_DATA_URL_PATTERN.test(value);

const isShoppingList = (value: unknown): value is ShoppingList => {
  if (
    !isRecord(value) ||
    !Array.isArray(value.items) ||
    !isFiniteNumber(value.totalMaterialCostGHS) ||
    !isFiniteNumber(value.estimatedLaborCostGHS) ||
    !isString(value.installationNotes)
  ) {
    return false;
  }

  return value.items.every(
    (item) =>
      isRecord(item) &&
      isString(item.name) &&
      isString(item.category) &&
      SHOPPING_CATEGORIES.has(item.category) &&
      isFiniteNumber(item.quantity) &&
      isString(item.unit) &&
      isFiniteNumber(item.estimatedPriceGHS) &&
      isString(item.reason),
  );
};

const postJson = async <ResponseBody, RequestBody>(
  endpoint: string,
  body: RequestBody,
  validateResponse: ResponseValidator<ResponseBody>,
): Promise<ResponseBody> => {
  let response: Response;
  try {
    response = await fetch(endpoint, {
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });
  } catch {
    throw new Error(REQUEST_ERROR_MESSAGE);
  }

  let responseBody: unknown;
  try {
    responseBody = await response.json();
  } catch {
    throw new Error(REQUEST_ERROR_MESSAGE);
  }

  if (!response.ok) {
    if (isErrorResponse(responseBody)) {
      throw new Error(responseBody.error);
    }
    throw new Error(REQUEST_ERROR_MESSAGE);
  }

  if (!validateResponse(responseBody)) {
    throw new Error(REQUEST_ERROR_MESSAGE);
  }

  return responseBody;
};

/**
 * Compress image before sending to API (reduces token costs)
 * OPTIMIZATION Step 2.3: Adaptive compression based on file size
 */
export const compressImage = async (
  file: File,
  maxWidth: number = 1600,
  maxHeight: number = 1600,
  quality: number = 0.80,
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width *= ratio;
          height *= ratio;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        let adaptiveQuality = quality;
        if (file.size > 5 * 1024 * 1024) {
          adaptiveQuality = 0.70;
        } else if (file.size < 500 * 1024) {
          adaptiveQuality = 0.85;
        }

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              canvas.toBlob(
                (jpegBlob) => {
                  if (!jpegBlob) {
                    reject(new Error('Image compression failed'));
                    return;
                  }
                  const blobReader = new FileReader();
                  blobReader.onloadend = () => {
                    const base64 = blobReader.result as string;
                    resolve(base64.split(',')[1]);
                  };
                  blobReader.onerror = reject;
                  blobReader.readAsDataURL(jpegBlob);
                },
                'image/jpeg',
                adaptiveQuality,
              );
              return;
            }
            const blobReader = new FileReader();
            blobReader.onloadend = () => {
              const base64 = blobReader.result as string;
              resolve(base64.split(',')[1]);
            };
            blobReader.onerror = reject;
            blobReader.readAsDataURL(blob);
          },
          'image/jpeg',
          adaptiveQuality,
        );
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const fileToGenerativePart = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      resolve(base64String.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const analyzeImageForPaint = async (
  base64Image: string,
  fullSizeImage?: string,
): Promise<AnalysisResult & { cacheName?: string }> => {
  void fullSizeImage;
  return postJson<AnalysisResult, { base64Image: string }>(
    '/api/analyze',
    { base64Image },
    isAnalysisResult,
  );
};

export const visualizeColor = async (
  base64Image: string,
  colorName: string,
  colorHex: string,
  analysisContext?: AnalysisResult & { cacheName?: string },
): Promise<string> => {
  const requestBody: {
    base64Image: string;
    colorName: string;
    colorHex: string;
    analysisContext?: AnalysisContext;
  } = {
    base64Image,
    colorName,
    colorHex,
  };

  if (analysisContext) {
    requestBody.analysisContext = {
      condition: analysisContext.condition,
      description: analysisContext.description,
      surfaceType: analysisContext.surfaceType,
    };
  }

  return postJson<string, typeof requestBody>(
    '/api/visualize',
    requestBody,
    isVisualizationResult,
  );
};

export const generateShoppingList = async (
  surfaceType: string,
  condition: string,
  selectedColor: string,
  area: number,
): Promise<ShoppingList> =>
  postJson<
    ShoppingList,
    {
      surfaceType: string;
      condition: string;
      selectedColor: string;
      area: number;
    }
  >(
    '/api/shopping-list',
    {
      area,
      condition,
      selectedColor,
      surfaceType,
    },
    isShoppingList,
  );
