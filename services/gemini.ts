import type { AnalysisResult, ShoppingList } from '../types';

const REQUEST_ERROR_MESSAGE = 'Request failed. Please try again.';

type AnalysisContext = Pick<
  AnalysisResult,
  'surfaceType' | 'condition' | 'description'
>;

interface ErrorResponse {
  error: string;
}

const isErrorResponse = (value: unknown): value is ErrorResponse => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const error = (value as Record<string, unknown>).error;
  return typeof error === 'string' && error.length > 0;
};

const postJson = async <ResponseBody, RequestBody>(
  endpoint: string,
  body: RequestBody,
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

  return responseBody as ResponseBody;
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

        const supportsWebP =
          canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
        const mimeType = supportsWebP ? 'image/webp' : 'image/jpeg';

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
          mimeType,
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
  return postJson<AnalysisResult, { base64Image: string }>('/api/analyze', {
    base64Image,
  });
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

  return postJson<string, typeof requestBody>('/api/visualize', requestBody);
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
  >('/api/shopping-list', {
    area,
    condition,
    selectedColor,
    surfaceType,
  });
