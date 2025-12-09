import { GoogleGenAI, Type, Schema } from "@google/genai";
import { AnalysisResult, ShoppingList } from "../types";

const API_KEY = process.env.API_KEY || '';

// Initialize the client
const ai = new GoogleGenAI({ apiKey: API_KEY });

/**
 * Compress image before sending to API (reduces token costs)
 */
export const compressImage = async (
  file: File,
  maxWidth: number = 1600,
  maxHeight: number = 1600,
  quality: number = 0.80
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Calculate new dimensions
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = width * ratio;
          height = height * ratio;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Image compression failed'));
              return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
              const base64 = reader.result as string;
              resolve(base64.split(',')[1]); // Remove data URL prefix
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

/**
 * Helpers to encode file to Base64
 */
export const fileToGenerativePart = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      // Remove the data URL prefix (e.g., "data:image/jpeg;base64,")
      const base64Data = base64String.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

/**
 * Analyzes the uploaded image to identify surface, condition, and suggest colors.
 */
export const analyzeImageForPaint = async (base64Image: string): Promise<AnalysisResult> => {
  const analysisSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      surfaceType: { type: Type.STRING, description: "The material of the wall/surface (e.g., Concrete, Plaster, Wood)" },
      condition: { type: Type.STRING, description: "Current condition of the surface (e.g., Peeling, Moldy, New, Good)" },
      estimatedAreaWarning: { type: Type.STRING, description: "A brief note about needing measurements." },
      palettes: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            description: { type: Type.STRING },
            colors: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING, description: "Creative paint name" },
                  hex: { type: Type.STRING, description: "Hex color code" }
                }
              }
            }
          }
        }
      }
    }
  };

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash', // Using available model for this API version
    contents: {
      parts: [
        { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
        { text: `Analyze this room image. Identify: 1) Surface material (Concrete/Plaster/Wood), 2) Condition (New/Good/Peeling/Moldy). Generate 3 color palettes:
1. "AI-CURATED SUGGESTION" - 3-4 premium colors for this architecture
2. "NEUCE PAINTS" - Use: Peach #FFE5B4, Terracotta #E2725B, Apple Green #8DB600, Navy #000080, Magnolia #F8F4E3
3. "AZAR PAINTS" - 4-5 common Ghanaian exterior colors` }
      ]
    },
    config: {
      responseMimeType: 'application/json',
      responseSchema: analysisSchema,
      systemInstruction: "You are a professional architectural consultant in Ghana. Be practical and aesthetic."
    }
  });

  if (!response.text) throw new Error("No analysis received from Gemini.");
  return JSON.parse(response.text) as AnalysisResult;
};

/**
 * Generates a visualized image with the new color applied.
 */
export const visualizeColor = async (base64Image: string, colorName: string, colorHex: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
          { text: `Repaint the walls in the image with the color ${colorName} (approximate hex: ${colorHex}). Keep the ceiling, floor, and fixtures unchanged. Maintain realistic lighting and shadows.` }
        ]
      }
    });

    // Check for errors in response
    if (response.candidates?.[0]?.finishReason === 'SAFETY') {
      throw new Error("Content was blocked for safety reasons. Try a different color.");
    }

    // Extract the image from the response
    const parts = response.candidates?.[0]?.content?.parts;
    if (parts) {
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
          return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
      }
    }
    
    throw new Error("Failed to generate visualization image. No image data in response.");
  } catch (error: any) {
    // Handle quota/rate limit errors
    if (error.status === 429 || error.error?.code === 429) {
      const retryAfter = error.error?.details?.find((d: any) => d['@type']?.includes('RetryInfo'))?.retryDelay;
      const retrySeconds = retryAfter ? parseInt(retryAfter.replace('s', '')) : 30;
      throw new Error(
        `API quota exceeded. Please wait ${retrySeconds} seconds and try again, or upgrade your API plan. ` +
        `Visit: https://ai.google.dev/gemini-api/docs/rate-limits`
      );
    }
    throw error;
  }
};

/**
 * Generates a detailed shopping list including hardware.
 * Optimized: No longer requires image (uses analysis results instead).
 */
export const generateShoppingList = async (
  surfaceType: string, 
  condition: string, 
  selectedColor: string, 
  area: number
): Promise<ShoppingList> => {
  const shoppingSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      items: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: "Product name (e.g. 20L Emulsion Bucket)" },
            category: { type: Type.STRING, enum: ['Paint', 'Primer', 'Hardware', 'Preparation', 'Other'] },
            quantity: { type: Type.NUMBER },
            unit: { type: Type.STRING },
            estimatedPriceGHS: { type: Type.NUMBER, description: "Price in Ghana Cedis" },
            reason: { type: Type.STRING, description: "Why this is needed (e.g. 'For rough surface')" }
          }
        }
      },
      totalMaterialCostGHS: { type: Type.NUMBER },
      estimatedLaborCostGHS: { type: Type.NUMBER },
      installationNotes: { type: Type.STRING }
    }
  };

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash', // Using available model for this API version
    contents: {
      parts: [
        // Removed image - we already have analysis results
        { text: `Create a detailed shopping list for painting a ${surfaceType} wall (Condition: ${condition}). The user has selected the color '${selectedColor}'. The estimated area is ${area} square meters. Include primer if needed for the condition. Include HIGH MARGIN hardware like brushes, rollers, trays, masking tape, and drop cloths. Prices should be realistic for the Ghanaian market in GHS.` }
      ]
    },
    config: {
      responseMimeType: 'application/json',
      responseSchema: shoppingSchema,
      systemInstruction: "You are a sales manager at a hardware store in Accra. You ensure the customer has EVERYTHING they need for a professional job, not just paint. Upsell necessary tools."
    }
  });

  if (!response.text) throw new Error("No shopping list received.");
  return JSON.parse(response.text) as ShoppingList;
};
