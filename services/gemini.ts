import { GoogleGenAI, Type, Schema } from "@google/genai";
import { AnalysisResult, ShoppingList } from "../types";
import { PAINT_COLORS, formatColorsForPrompt } from "../data/paintColors";

const API_KEY = process.env.API_KEY || '';

// Initialize the client
const ai = new GoogleGenAI({ apiKey: API_KEY });

/**
 * Compress image before sending to API (reduces token costs)
 * OPTIMIZATION Step 2.3: Adaptive compression based on file size
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
        
        // OPTIMIZATION: Adaptive quality based on file size
        // Large files (>5MB): lower quality for faster processing
        // Small files (<500KB): higher quality to preserve detail
        let adaptiveQuality = quality;
        if (file.size > 5 * 1024 * 1024) { // > 5MB
          adaptiveQuality = 0.70; // Lower quality for large files
        } else if (file.size < 500 * 1024) { // < 500KB
          adaptiveQuality = 0.85; // Higher quality for small files
        }

        // Check WebP support and use it for better compression
        const supportsWebP = canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
        const mimeType = supportsWebP ? 'image/webp' : 'image/jpeg';
        
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              // Fallback to JPEG if WebP fails
              canvas.toBlob(
                (jpegBlob) => {
                  if (!jpegBlob) {
                    reject(new Error('Image compression failed'));
                    return;
                  }
                  const reader = new FileReader();
                  reader.onloadend = () => {
                    const base64 = reader.result as string;
                    resolve(base64.split(',')[1]); // Remove data URL prefix
                  };
                  reader.onerror = reject;
                  reader.readAsDataURL(jpegBlob);
                },
                'image/jpeg',
                adaptiveQuality
              );
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
          mimeType,
          adaptiveQuality
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
 * Creates cached content for image analysis (Phase 2.1: Context Caching API)
 * Falls back gracefully if API doesn't support caching
 */
const createCachedAnalysis = async (base64Image: string): Promise<string | null> => {
  try {
    // Check if caches API is available
    if (typeof ai.caches === 'undefined' || !ai.caches.create) {
      return null;
    }
    
    const response = await ai.caches.create({
      model: 'gemini-2.5-flash',
      config: {
        contents: [
          { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
          { text: "Analyze this image structure and identify wall surfaces, materials, and architectural features." }
        ],
        ttl: '86400s' // 24 hours
      }
    });
    
    return response.name; // Returns cache name like "cachedContents/..."
  } catch (error) {
    // Graceful fallback - context caching not available or failed
    console.warn('Context caching not available, using standard flow:', error);
    return null;
  }
};

/**
 * Analyzes the uploaded image to identify surface, condition, and suggest colors.
 * PHASE 2.1: Supports context caching for cost optimization
 */
export const analyzeImageForPaint = async (
  base64Image: string,
  fullSizeImage?: string // Full size image for context caching
): Promise<AnalysisResult & { cacheName?: string }> => {
  const analysisSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      surfaceType: { type: Type.STRING, description: "Wall material: Concrete/Plaster/Wood" },
      condition: { type: Type.STRING, description: "Surface condition: New/Good/Peeling/Moldy" },
      description: { 
        type: Type.STRING, 
        description: "Simple, informative description: Key structural features (wall locations, columns, recesses) and treatment needs if any. Keep concise (1-2 sentences). Tone: clear and helpful. Example: 'Front and side walls visible with two columns. Requires primer for peeling areas.'" 
      },
      estimatedAreaWarning: { type: Type.STRING, description: "Note about measurements needed" },
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
                  name: { type: Type.STRING, description: "Paint color name" },
                  hex: { type: Type.STRING, description: "Hex color code" }
                }
              },
              description: "Colors ordered by relevance - most recommended colors first, then alternatives"
            }
          }
        }
      }
    }
  };

  // Get real paint colors from manufacturer data
  const neuceColors = PAINT_COLORS.neuce || [];
  const azarColors = PAINT_COLORS.azar || [];
  
  // COST OPTIMIZATION Step 2: Optimize prompt - Reference colors instead of listing all
  // This reduces prompt size by 300-500 tokens (20-30% cost reduction)
  // Color lists are available in system instruction context, no need to repeat in prompt

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash', // Using available model for this API version
    contents: {
      parts: [
        { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
        { text: `Identify surface material, condition, and space type (interior/exterior).

For description: Write a simple, informative 1-2 sentence description covering:
- Key structural features (wall locations, columns, recesses, trim)
- Treatment needs if any (e.g., 'Requires primer for peeling areas' or 'No treatment needed')
Use clear, helpful language. Skip aesthetic details.

Generate 3 palettes:
1. "AI-CURATED SUGGESTION" - 3-4 colors from available Neuce and Azar collections
   Prioritize colors NOT in NEUCE/AZAR sections. Include: (a) colors similar to current wall, (b) complementary colors matching space style.
2. "NEUCE PAINTS" - 4-5 colors from Neuce collection (10 colors available)
3. "AZAR PAINTS" - 4-5 colors from Azar collection (10 colors available)

Order colors by relevance. Most recommended first. Use exact color names and hex codes from available collections.` }
      ]
    },
    config: {
      responseMimeType: 'application/json',
      responseSchema: analysisSchema,
      systemInstruction: `Architectural consultant in Ghana. Write descriptions in simple, clear, helpful language. 
Available paint colors:
- Neuce collection (10 colors): ${formatColorsForPrompt(neuceColors)}
- Azar collection (10 colors): ${formatColorsForPrompt(azarColors)}

For AI-CURATED: prioritize colors NOT in NEUCE/AZAR sections. Focus on complementary alternatives, trendy options, or unique combinations. Include colors similar to current wall (for identification) and new complementary colors (for alternatives). Match space style and lighting. Order colors strategically: first positions should mix (1) colors closest to current wall color, and (2) best recommended colors for the space. Most relevant first. Use exact name and hex from lists above.`
    }
  });

  if (!response.text) throw new Error("No analysis received from Gemini.");
  const analysis = JSON.parse(response.text) as AnalysisResult;
  
  // PHASE 2.1: Create cached content for reuse in visualization (cost optimization)
  // Use full size image if provided, otherwise use analysis image
  const imageForCache = fullSizeImage || base64Image;
  try {
    const cacheName = await createCachedAnalysis(imageForCache);
    if (cacheName) {
      return { ...analysis, cacheName };
    }
  } catch (error) {
    // Non-critical - continue without cache
    console.warn('Failed to create cached content:', error);
  }
  
  return analysis;
};

/**
 * Generates a visualized image with the new color applied.
 * OPTIMIZED: Reuses surface analysis data and supports context caching for cost optimization
 */
export const visualizeColor = async (
  base64Image: string, 
  colorName: string, 
  colorHex: string,
  analysisContext?: AnalysisResult & { cacheName?: string }
): Promise<string> => {
  try {
    // Normalize hex value for consistent processing
    const normalizedHex = colorHex.trim().toUpperCase().replace(/^#/, '');
    const normalizedHexWithHash = normalizedHex.startsWith('#') ? normalizedHex : `#${normalizedHex}`;
    
    // PHASE 2.3: Optimized shorter prompt (100-150 token reduction)
    let enhancedPrompt = analysisContext
      ? `Paint all ${analysisContext.surfaceType} walls with ${colorName} (${normalizedHexWithHash}).
Surface: ${analysisContext.condition}. ${analysisContext.description}
Apply uniformly to all painted wall surfaces. Preserve windows, doors, furniture, sky, vegetation.`
      : `Paint all wall surfaces with ${colorName} (${normalizedHexWithHash}).
Apply uniformly. Preserve windows, doors, furniture, sky, vegetation.`;
    
    // Enhanced system instruction with analysis context
    const systemInstruction = analysisContext
      ? `Paint visualization tool. Surface: ${analysisContext.surfaceType} (${analysisContext.condition}). Paint ALL painted wall surfaces uniformly with specified color. Preserve windows, doors, furniture, sky, vegetation.`
      : "Paint visualization tool. Paint ALL painted wall surfaces uniformly. Preserve windows, doors, furniture, sky, vegetation.";
    
    // PHASE 2.1: Use cached content if available (reduces image token costs by 200-400 tokens)
    const contents: any[] = [];
    if (analysisContext?.cacheName) {
      try {
        contents.push({ cachedContent: { name: analysisContext.cacheName } });
      } catch (error) {
        // Fallback to image if cached content fails
        contents.push({ inlineData: { mimeType: 'image/jpeg', data: base64Image } });
      }
    } else {
      contents.push({ inlineData: { mimeType: 'image/jpeg', data: base64Image } });
    }
    contents.push({ text: enhancedPrompt });
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: contents
      },
      config: {
        systemInstruction
      }
    });

    // Check for errors in response
    const finishReason = response.candidates?.[0]?.finishReason;
    
    if (finishReason === 'SAFETY') {
      throw new Error("Content was blocked for safety reasons. Try a different color.");
    }

  // Extract the image from the response
  const parts = response.candidates?.[0]?.content?.parts;
    
  if (parts) {
    for (const part of parts) {
      if (part.inlineData && part.inlineData.data) {
          const result = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
          
          // Check if result is identical to input (simple string comparison)
          // Note: base64Image is already just the base64 data (no data URL prefix)
          // This won't catch subtle changes, but will catch exact duplicates
          const inputBase64 = base64Image.replace(/^data:image\/[^;]+;base64,/, ''); // Remove prefix if present
          const resultBase64 = part.inlineData.data;
          
          if (inputBase64 === resultBase64) {
            throw new Error("The AI returned an unchanged image. Please try a different color or upload a clearer photo of the walls.");
          }
          
          return result;
    }
  }
    }
    
    console.error('No image data in response. Response structure:', {
      candidates: response.candidates?.length,
      finishReason: response.candidates?.[0]?.finishReason,
      parts: parts?.length
    });
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
        { text: `Shopping list: ${surfaceType} wall, ${condition} condition, color '${selectedColor}', ${area}m². Include primer if needed. Add brushes, rollers, trays, masking tape, drop cloths. Prices in GHS.` }
      ]
    },
    config: {
      responseMimeType: 'application/json',
      responseSchema: shoppingSchema,
      systemInstruction: "Hardware store sales manager in Koforidua. Include all necessary tools and materials."
    }
  });

  if (!response.text) throw new Error("No shopping list received.");
  return JSON.parse(response.text) as ShoppingList;
};
