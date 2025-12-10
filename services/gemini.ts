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
 * Analyzes the uploaded image to identify surface, condition, and suggest colors.
 */
export const analyzeImageForPaint = async (base64Image: string): Promise<AnalysisResult> => {
  const analysisSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      surfaceType: { type: Type.STRING, description: "Wall material: Concrete/Plaster/Wood" },
      condition: { type: Type.STRING, description: "Surface condition: New/Good/Peeling/Moldy" },
      description: { type: Type.STRING, description: "Brief description of the current wall appearance and features" },
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
  
  // Combine all manufacturer colors for AI-CURATED SUGGESTION
  const allManufacturerColors = [...neuceColors, ...azarColors];
  
  const allColorsList = formatColorsForPrompt(allManufacturerColors);
  const neuceColorList = formatColorsForPrompt(neuceColors);
  const azarColorList = formatColorsForPrompt(azarColors);

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash', // Using available model for this API version
    contents: {
      parts: [
        { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
        { text: `Identify surface material, condition, and very briefly and concisely describe the appearance of the walls and always indicate if any treatments are needed before painting. Determine if interior or exterior space. Generate 3 palettes:
1. "AI-CURATED SUGGESTION" - 3-4 colors from: ${allColorsList}
   Prioritize colors NOT already shown in NEUCE/AZAR sections. Focus on complementary alternatives, trendy options, or unique combinations that enhance the space differently. Include: (a) colors similar to current wall (to identify existing paint), (b) new complementary colors that match the space style.
2. "NEUCE PAINTS" - 4-5 colors from: ${neuceColorList}
3. "AZAR PAINTS" - 4-5 colors from: ${azarColorList}

IMPORTANT: Order colors by relevance within each palette. For the first 8 colors, create a strategic mix: (1) colors closest to the current wall color in the image (for identification), and (2) other recommended colors that best suit the house/space style (for alternatives). Most recommended colors first, then alternatives. Use ONLY colors from lists above. Use exact name and hex provided.` }
      ]
    },
    config: {
      responseMimeType: 'application/json',
      responseSchema: analysisSchema,
      systemInstruction: "Architectural consultant in Ghana. For AI-CURATED: prioritize colors NOT in NEUCE/AZAR sections. Focus on complementary alternatives, trendy options, or unique combinations. Include colors similar to current wall (for identification) and new complementary colors (for alternatives). Match space style and lighting. Order colors strategically: first positions should mix (1) colors closest to current wall color, and (2) best recommended colors for the space. Most relevant first."
    }
  });

  if (!response.text) throw new Error("No analysis received from Gemini.");
  return JSON.parse(response.text) as AnalysisResult;
};

/**
 * Generates a visualized image with the new color applied.
 * OPTIMIZED: Reuses surface analysis data to accelerate processing and improve accuracy
 */
export const visualizeColor = async (
  base64Image: string, 
  colorName: string, 
  colorHex: string,
  analysisContext?: AnalysisResult
): Promise<string> => {
  try {
    // Normalize hex value for consistent processing
    const normalizedHex = colorHex.trim().toUpperCase().replace(/^#/, '');
    const normalizedHexWithHash = normalizedHex.startsWith('#') ? normalizedHex : `#${normalizedHex}`;
    
    // Build enhanced prompt with analysis context
    let enhancedPrompt = `Paint ALL wall surfaces in this image with the color ${colorName} (${normalizedHexWithHash}).\n\n`;
    
    // Add analysis context if available to speed up processing
    if (analysisContext) {
      enhancedPrompt += `CONTEXT FROM PREVIOUS ANALYSIS:\n`;
      enhancedPrompt += `- Surface Type: ${analysisContext.surfaceType}\n`;
      enhancedPrompt += `- Condition: ${analysisContext.condition}\n`;
      enhancedPrompt += `- Description: ${analysisContext.description}\n\n`;
      enhancedPrompt += `Use this context to quickly identify wall surfaces. The analysis has already identified:\n`;
      enhancedPrompt += `- The wall material and structure\n`;
      enhancedPrompt += `- Surface conditions and features\n`;
      enhancedPrompt += `- Interior/exterior space characteristics\n\n`;
    }
    
    enhancedPrompt += `CRITICAL: Paint EVERY wall surface, regardless of its current color or whether it appears to be an accent.

WALLS TO PAINT (include ALL of these):
1. Main walls (front, back, side walls)
2. Accent walls or colored sections (even if currently a different color like orange, red, etc.)
3. Structural columns or pillars that are painted (not stone/brick)
4. Recessed wall areas (like balcony interiors, alcoves, niches)
5. Wall trim or painted roofline sections
6. Partial walls visible in the frame
7. Walls at different angles or depths
8. Walls behind or beside objects
9. Background building walls (if visible)
10. ANY vertical painted surface - if it's painted, it's a wall

PAINTING RULES:
- Apply ${normalizedHexWithHash} to EVERY wall surface listed above
- Do NOT preserve any walls in their original color (even accent colors)
- Do NOT skip walls because they're currently a different color
- Paint uniformly - all walls must show ${normalizedHexWithHash}
- If a section is painted (not stone/brick/wood), it's a wall - paint it

PRESERVE (do NOT paint):
- Windows and window frames
- Doors and door frames
- Ceiling, floor, ground
- Sky, vegetation, trees
- Furniture, fixtures, railings
- Stone, brick, or wood cladding (only painted surfaces are walls)
- Metal elements (unless they're painted walls)

The output must show ALL painted wall surfaces uniformly painted ${normalizedHexWithHash}.`;
    
    // Enhanced system instruction with analysis context
    const systemInstruction = analysisContext
      ? `You are a paint visualization tool. Previous analysis has identified this as ${analysisContext.surfaceType} with ${analysisContext.condition} condition. Use this context to quickly identify wall surfaces without re-analyzing the structure. When asked to paint walls a color, you MUST identify and paint EVERY painted wall surface in the image, including accent walls, colored sections, columns, recesses, and trim. Do not skip walls because they're currently a different color. Do not preserve accent colors. All painted wall surfaces must be painted uniformly with the specified color. The output must be visibly different - all walls must show the new color clearly.`
      : "You are a paint visualization tool. When asked to paint walls a color, you MUST identify and paint EVERY painted wall surface in the image, including accent walls, colored sections, columns, recesses, and trim. Do not skip walls because they're currently a different color. Do not preserve accent colors. All painted wall surfaces must be painted uniformly with the specified color. The output must be visibly different - all walls must show the new color clearly.";
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
          { text: enhancedPrompt }
        ]
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
