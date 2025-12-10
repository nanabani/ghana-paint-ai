/**
 * Image Quality Validation Service
 * Client-side validation using native browser APIs (Canvas, ImageData)
 * No external dependencies - pure JavaScript/TypeScript
 */

export interface ValidationResult {
  isValid: boolean;
  score: number; // 0-100 quality score
  errors: string[];
  warnings: string[];
  tips: string[];
  metrics: {
    resolution: { width: number; height: number };
    fileSize: number;
    brightness: number;
    blurVariance: number;
    aspectRatio: number;
  };
}

interface ValidationCheck {
  isValid: boolean;
  error?: string;
  warning?: string;
  tip?: string;
}

/**
 * Load image from file
 */
const loadImage = (file: File): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
};

/**
 * Create canvas from image
 */
const createCanvas = (img: HTMLImageElement): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');
  ctx.drawImage(img, 0, 0);
  return canvas;
};

/**
 * Check resolution and file size
 */
const validateResolution = (file: File, img: HTMLImageElement): ValidationCheck => {
  const minDimension = 400;
  const maxDimension = 8000;
  const maxFileSize = 10 * 1024 * 1024; // 10MB

  if (file.size > maxFileSize) {
    return {
      isValid: false,
      error: 'Image too large. Please use a smaller file (max 10MB).',
      tip: 'Compress the image or use a lower resolution setting on your camera.'
    };
  }

  if (img.width < minDimension || img.height < minDimension) {
    return {
      isValid: false,
      error: `Image too small. Minimum size: ${minDimension}x${minDimension}px.`,
      tip: 'Move closer to the wall or use a higher quality camera setting.'
    };
  }

  if (img.width > maxDimension || img.height > maxDimension) {
    return {
      isValid: true,
      warning: 'Very large image. Processing may take longer.',
      tip: 'Consider resizing the image for faster processing.'
    };
  }

  return { isValid: true };
};

/**
 * Check aspect ratio
 */
const checkAspectRatio = (width: number, height: number): ValidationCheck => {
  const ratio = width / height;
  const maxRatio = 3; // 3:1 or 1:3 max

  if (ratio > maxRatio || ratio < 1 / maxRatio) {
    return {
      isValid: true,
      warning: 'Extreme aspect ratio. For best results, use a more standard photo format.',
      tip: 'Try taking the photo in portrait or landscape orientation, not extreme wide or tall.'
    };
  }

  return { isValid: true };
};

/**
 * Calculate average brightness from image data
 */
const calculateBrightness = (imageData: ImageData): number => {
  const data = imageData.data;
  let totalBrightness = 0;
  let pixelCount = 0;

  // Sample every 4th pixel for performance (RGBA = 4 values per pixel)
  for (let i = 0; i < data.length; i += 16) {
    // Calculate perceived brightness using luminance formula
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
    totalBrightness += brightness;
    pixelCount++;
  }

  return totalBrightness / pixelCount;
};

/**
 * Check lighting/brightness
 */
const checkLighting = (canvas: HTMLCanvasElement): { check: ValidationCheck; brightness: number } => {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    return {
      check: { isValid: true },
      brightness: 128
    };
  }

  // Sample entire image
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const avgBrightness = calculateBrightness(imageData);

  let check: ValidationCheck = { isValid: true };

  if (avgBrightness < 30) {
    check = {
      isValid: false,
      error: 'Image too dark. Please use better lighting or turn on lights.',
      tip: 'Turn on room lights, avoid backlighting, or move closer to a window.'
    };
  } else if (avgBrightness < 50) {
    check = {
      isValid: true,
      warning: 'Image is quite dark. Better lighting will improve results.',
      tip: 'Add more light to the room or use flash if available.'
    };
  } else if (avgBrightness > 240) {
    check = {
      isValid: true,
      warning: 'Image is very bright. Avoid direct sunlight or harsh lighting.',
      tip: 'Move away from direct sunlight or reduce camera exposure.'
    };
  }

  return { check, brightness: avgBrightness };
};

/**
 * Detect blur using Laplacian variance (edge detection)
 * Higher variance = sharper image, lower variance = blurrier
 * Adjusted for low-light conditions common in Ghanaian homes
 */
const detectBlur = (canvas: HTMLCanvasElement, brightness: number): { check: ValidationCheck; variance: number } => {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    return {
      check: { isValid: true },
      variance: 100
    };
  }

  // Sample center region (60% of image) where walls typically appear
  const width = canvas.width;
  const height = canvas.height;
  const sampleSize = Math.min(width, height) * 0.6;
  const startX = (width - sampleSize) / 2;
  const startY = (height - sampleSize) / 2;

  const imageData = ctx.getImageData(
    Math.max(0, startX),
    Math.max(0, startY),
    Math.min(sampleSize, width),
    Math.min(sampleSize, height)
  );

  const data = imageData.data;
  const width2 = imageData.width;
  const height2 = imageData.height;

  // Calculate Laplacian variance (simplified edge detection)
  // We'll use a simple gradient-based approach
  let variance = 0;
  let mean = 0;
  const gradients: number[] = [];

  // Calculate gradients (edge strength) for each pixel
  for (let y = 1; y < height2 - 1; y++) {
    for (let x = 1; x < width2 - 1; x++) {
      const idx = (y * width2 + x) * 4;
      
      // Get surrounding pixels
      const top = (y - 1) * width2 + x;
      const bottom = (y + 1) * width2 + x;
      const left = y * width2 + (x - 1);
      const right = y * width2 + (x + 1);
      
      // Calculate grayscale values
      const centerGray = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
      const topGray = (data[top * 4] + data[top * 4 + 1] + data[top * 4 + 2]) / 3;
      const bottomGray = (data[bottom * 4] + data[bottom * 4 + 1] + data[bottom * 4 + 2]) / 3;
      const leftGray = (data[left * 4] + data[left * 4 + 1] + data[left * 4 + 2]) / 3;
      const rightGray = (data[right * 4] + data[right * 4 + 1] + data[right * 4 + 2]) / 3;
      
      // Calculate gradient (edge strength)
      const gradientX = Math.abs(rightGray - leftGray);
      const gradientY = Math.abs(bottomGray - topGray);
      const gradient = Math.sqrt(gradientX * gradientX + gradientY * gradientY);
      
      gradients.push(gradient);
      mean += gradient;
    }
  }

  if (gradients.length === 0) {
    return {
      check: { isValid: true },
      variance: 100
    };
  }

  mean /= gradients.length;

  // Calculate variance
  for (const gradient of gradients) {
    variance += Math.pow(gradient - mean, 2);
  }
  variance /= gradients.length;

  let check: ValidationCheck = { isValid: true };

  // Brightness-aware blur thresholds
  // In low-light conditions, edge detection naturally produces lower variance
  // Adjust thresholds based on image brightness to avoid false positives
  let blurErrorThreshold = 30;   // Default threshold
  let blurWarningThreshold = 60; // Default threshold

  if (brightness < 50) {
    // Low-light conditions: be more lenient
    // Reduce thresholds by 40-50% for dark images
    blurErrorThreshold = 15;   // Much more lenient for dark images
    blurWarningThreshold = 35; // More lenient warning threshold
  } else if (brightness < 80) {
    // Medium-light conditions: slightly more lenient
    blurErrorThreshold = 20;
    blurWarningThreshold = 45;
  }

  // Apply adjusted thresholds
  if (variance < blurErrorThreshold) {
    check = {
      isValid: false,
      error: 'Image is too blurry. Please take a clearer photo.',
      tip: 'Hold camera steady, tap to focus, ensure good lighting, and avoid camera shake.'
    };
  } else if (variance < blurWarningThreshold) {
    check = {
      isValid: true,
      warning: 'Image may be slightly blurry. For best results, use a sharper photo.',
      tip: 'Keep camera steady, wait for autofocus, and ensure adequate lighting.'
    };
  }

  return { check, variance };
};

/**
 * Check if walls are visible (simplified content analysis)
 */
const checkWallVisibility = (canvas: HTMLCanvasElement): ValidationCheck => {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return { isValid: true };

  // Sample center region where walls typically appear
  const width = canvas.width;
  const height = canvas.height;
  const centerX = width / 2;
  const centerY = height / 2;
  const sampleWidth = width * 0.4;
  const sampleHeight = height * 0.4;

  const imageData = ctx.getImageData(
    Math.max(0, centerX - sampleWidth / 2),
    Math.max(0, centerY - sampleHeight / 2),
    Math.min(sampleWidth, width),
    Math.min(sampleHeight, height)
  );

  const data = imageData.data;
  let contrastVariation = 0;
  let sampleCount = 0;

  // Check for contrast variation (walls typically have edges/contrast)
  for (let i = 0; i < data.length - 16; i += 16) {
    const gray1 = (data[i] + data[i + 1] + data[i + 2]) / 3;
    const gray2 = (data[i + 16] + data[i + 17] + data[i + 18]) / 3;
    contrastVariation += Math.abs(gray1 - gray2);
    sampleCount++;
  }

  if (sampleCount === 0) {
    return { isValid: true };
  }

  const avgContrast = contrastVariation / sampleCount;

  if (avgContrast < 10) {
    return {
      isValid: true,
      warning: 'Walls may not be clearly visible. Ensure walls are in frame and well-lit.',
      tip: 'Frame the wall in the center of the photo and ensure it\'s well-lit.'
    };
  }

  return { isValid: true };
};

/**
 * Calculate quality score (0-100)
 */
const calculateQualityScore = (
  resolution: boolean,
  blurVariance: number,
  brightness: number,
  hasWalls: boolean
): number => {
  let score = 100;

  // Resolution penalty
  if (!resolution) score -= 50;

  // Blur penalty (adjusted for more lenient phone-compatible thresholds)
  if (blurVariance < 30) score -= 40;
  else if (blurVariance < 60) score -= 20;

  // Brightness penalty
  if (brightness < 30) score -= 40;
  else if (brightness < 50) score -= 15;
  else if (brightness > 240) score -= 10;

  // Wall visibility penalty
  if (!hasWalls) score -= 10;

  return Math.max(0, Math.min(100, score));
};

/**
 * Generate contextual tips based on errors and warnings
 */
const generateTips = (errors: string[], warnings: string[]): string[] => {
  const tips: string[] = [];

  if (errors.some(e => e.includes('blurry'))) {
    tips.push('Hold camera steady and wait for autofocus');
    tips.push('Ensure good lighting to help autofocus work');
  }

  if (errors.some(e => e.includes('dark'))) {
    tips.push('Turn on room lights or use flash');
    tips.push('Move closer to a window for natural light');
  }

  if (errors.some(e => e.includes('small'))) {
    tips.push('Move closer to the wall');
    tips.push('Use a higher quality camera setting');
  }

  if (warnings.some(w => w.includes('blurry'))) {
    tips.push('Keep camera steady when taking photo');
  }

  if (warnings.some(w => w.includes('dark'))) {
    tips.push('Add more light to improve results');
  }

  // General tips if no specific issues
  if (tips.length === 0) {
    tips.push('Stand 3-5 feet from the wall');
    tips.push('Ensure walls are in the center of the frame');
    tips.push('Use good, even lighting');
  }

  return tips;
};

/**
 * Main validation function
 */
export const validateImage = async (file: File): Promise<ValidationResult> => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const tips: string[] = [];

  try {
    // Load image
    const img = await loadImage(file);
    const canvas = createCanvas(img);

    // Run all checks
    const resolutionCheck = validateResolution(file, img);
    const aspectRatioCheck = checkAspectRatio(img.width, img.height);
    const lightingResult = checkLighting(canvas);
    const blurResult = detectBlur(canvas, lightingResult.brightness);
    const wallCheck = checkWallVisibility(canvas);

    // Collect errors and warnings
    if (resolutionCheck.error) errors.push(resolutionCheck.error);
    if (resolutionCheck.warning) warnings.push(resolutionCheck.warning);
    if (resolutionCheck.tip) tips.push(resolutionCheck.tip);

    if (aspectRatioCheck.warning) warnings.push(aspectRatioCheck.warning);
    if (aspectRatioCheck.tip) tips.push(aspectRatioCheck.tip);

    if (lightingResult.check.error) errors.push(lightingResult.check.error);
    if (lightingResult.check.warning) warnings.push(lightingResult.check.warning);
    if (lightingResult.check.tip) tips.push(lightingResult.check.tip);

    if (blurResult.check.error) errors.push(blurResult.check.error);
    if (blurResult.check.warning) warnings.push(blurResult.check.warning);
    if (blurResult.check.tip) tips.push(blurResult.check.tip);

    if (wallCheck.warning) warnings.push(wallCheck.warning);
    if (wallCheck.tip) tips.push(wallCheck.tip);

    // Calculate quality score
    const score = calculateQualityScore(
      resolutionCheck.isValid,
      blurResult.variance,
      lightingResult.brightness,
      !wallCheck.warning
    );

    // Generate additional tips
    const contextualTips = generateTips(errors, warnings);
    tips.push(...contextualTips);

    // Clean up
    URL.revokeObjectURL(img.src);

    return {
      isValid: errors.length === 0,
      score,
      errors,
      warnings,
      tips: [...new Set(tips)], // Remove duplicates
      metrics: {
        resolution: { width: img.width, height: img.height },
        fileSize: file.size,
        brightness: lightingResult.brightness,
        blurVariance: blurResult.variance,
        aspectRatio: img.width / img.height
      }
    };
  } catch (error: any) {
    return {
      isValid: false,
      score: 0,
      errors: [error.message || 'Failed to validate image'],
      warnings: [],
      tips: ['Please try uploading the image again'],
      metrics: {
        resolution: { width: 0, height: 0 },
        fileSize: file.size,
        brightness: 0,
        blurVariance: 0,
        aspectRatio: 0
      }
    };
  }
};

