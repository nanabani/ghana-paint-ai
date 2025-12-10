import React, { useState, useRef, useEffect } from 'react';
import { AppState, AnalysisResult, ShoppingList as ShoppingListType } from './types';
import Hero from './components/Hero';
import UploadSection from './components/UploadSection';
import Visualizer from './components/Visualizer';
import ShoppingList from './components/ShoppingList';
import { analyzeImageForPaint, visualizeColor, generateShoppingList, compressImage } from './services/gemini';
import { ImageCache } from './services/cache';
import { validateImage, ValidationResult } from './services/imageValidation';
import ImageValidationModal from './components/ImageValidationModal';
import ImageValidationBanner from './components/ImageValidationBanner';
import { Loader2, Plus } from 'lucide-react';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [visualizedImage, setVisualizedImage] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [shoppingList, setShoppingList] = useState<ShoppingListType | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [base64Raw, setBase64Raw] = useState<string>('');
  const [visualizationCount, setVisualizationCount] = useState(0);
  const MAX_VISUALIZATIONS = 5; // Rate limit per session
  const currentRequestRef = useRef<string | null>(null);
  const loadingRequestRef = useRef<string | null>(null);
  const visualizerRef = useRef<HTMLDivElement | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const hasScrolledToVisualizer = useRef(false);

  const handleStart = () => {
    const uploadElement = document.getElementById('upload-area');
    if (uploadElement) {
      uploadElement.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const processImage = async (file: File) => {
    setError(null);
    setAnalysisResult(null);
    setVisualizationCount(0);
    setLoadingMessage('');
    setValidationResult(null);
    // CRITICAL FIX: Clear previous visualization and cancel any pending requests
    setVisualizedImage(null);
    currentRequestRef.current = null;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      setOriginalImage(e.target?.result as string);
      setAppState(AppState.VISUALIZING);
    };
    reader.readAsDataURL(file);

    try {
      setLoading(true);
      
      // Step 1: Compress image
      setLoadingMessage('Optimizing image for analysis...');
      const compressedBase64 = await compressImage(file, 1600, 1600, 0.80);
      setBase64Raw(compressedBase64);

      // Step 2: Check cache
      setLoadingMessage('Checking for previous analysis...');
      const imageHash = ImageCache.generateImageHash(compressedBase64);
      const cacheKey = `analysis_${imageHash}`;
      
      // Step 3: Analyze (with cache check)
      setLoadingMessage('Analyzing space architecture and lighting...');
      const analysis = await ImageCache.getOrSet(cacheKey, async () => {
        setLoadingMessage('Identifying surfaces and materials...');
        const result = await analyzeImageForPaint(compressedBase64);
        setLoadingMessage('Generating color palette recommendations...');
        return result;
      });
      
      setAnalysisResult(analysis);
      setLoadingMessage('');
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to analyze image. Please try again.");
      setLoadingMessage('');
    } finally {
      setLoading(false);
    }
  };

  const handleImageSelected = async (file: File) => {
    // Step 1: Validate image quality
    setLoadingMessage('Checking photo quality...');
    setLoading(true);
    
    try {
      const validation = await validateImage(file);
      setValidationResult(validation);
      setLoading(false);
      setLoadingMessage('');

      // Step 2: Handle validation results
      if (!validation.isValid) {
        // Show error modal - blocking
        setPendingFile(file);
        setShowValidationModal(true);
        return;
      }

      // Step 3: If warnings, show banner but proceed
      if (validation.warnings.length > 0) {
        // Warnings are non-blocking, proceed with processing
        await processImage(file);
      } else {
        // No issues, proceed directly
        await processImage(file);
      }
    } catch (err: any) {
      console.error(err);
      setError('Failed to validate image. Please try again.');
      setLoading(false);
      setLoadingMessage('');
    }
  };

  const handleRetakePhoto = () => {
    setShowValidationModal(false);
    setPendingFile(null);
    setValidationResult(null);
    setAppState(AppState.IDLE);
  };

  const handleTryAnyway = async () => {
    setShowValidationModal(false);
    if (pendingFile) {
      await processImage(pendingFile);
      setPendingFile(null);
    }
  };

  const handleVisualize = async (colorName: string, colorHex: string) => {
    console.log('🚀 handleVisualize called:', { colorName, colorHex, hasBase64: !!base64Raw });
    
    if (!base64Raw) {
      console.warn('⚠️ No base64Raw, returning early');
      return;
    }
    
    // Rate limiting
    if (visualizationCount >= MAX_VISUALIZATIONS) {
      console.warn('⚠️ Rate limit reached:', visualizationCount);
      setError(`You've reached the limit of ${MAX_VISUALIZATIONS} visualizations per session. Please start a new project to try more colors.`);
      return;
    }
    
    // Normalize hex value to ensure consistent cache keys
    // This prevents cache misses due to hex format differences (e.g., #FF6B35 vs ff6b35 vs FF6B35)
    const normalizedHex = colorHex.trim().toUpperCase().replace(/^#/, '');
    const normalizedHexWithHash = normalizedHex.startsWith('#') ? normalizedHex : `#${normalizedHex}`;
    
    // CRITICAL FIX: Include image hash in request ID to prevent collisions across different images
    const imageHash = ImageCache.generateImageHash(base64Raw);
    const requestId = `${imageHash}_${normalizedHexWithHash}`;
    currentRequestRef.current = requestId;
    
    // INSTANT UI UPDATE: Clear previous visualization immediately
    setVisualizedImage(null);
    
    try {
      setLoading(true);
      setError(null);
      setLoadingMessage('Checking cache...');
      setVisualizationCount(prev => prev + 1);
      
      // Create cache key: image hash + normalized color hex
      // Using normalized hex ensures consistent cache keys regardless of input format
      const cacheKey = `visualization_${imageHash}_${normalizedHexWithHash}`;
      
      // Log for debugging
      console.log('🔄 Visualize request:', { 
        colorName, 
        originalHex: colorHex, 
        normalizedHex: normalizedHexWithHash,
        cacheKey,
        requestId 
      });
      
      // Check cache first
      const cached = await ImageCache.getOrSet(cacheKey, async () => {
        console.log('💾 Cache miss - calling API for:', { colorName, normalizedHex: normalizedHexWithHash });
        // Verify this is still the current request
        if (currentRequestRef.current !== requestId) {
          throw new Error('Request cancelled');
        }
        
        setLoadingMessage('Applying paint color to walls...');
        // Pass normalized hex to ensure consistency
        const result = await visualizeColor(base64Raw, colorName, normalizedHexWithHash);
        
        console.log('✅ API response received, result length:', result?.length || 0);
        
        // Verify again before returning
        if (currentRequestRef.current !== requestId) {
          throw new Error('Request cancelled');
        }
        
        setLoadingMessage('Rendering realistic lighting and shadows...');
        return result;
      });
      
      if (cached) {
        console.log('💾 Using cached result, length:', cached?.length || 0);
      }
      
      // CRITICAL FIX: Validate request ID before using cached result
      // This prevents stale cached results from previous images
      if (currentRequestRef.current !== requestId) {
        // Request was cancelled, ignore result
        console.log('⚠️ Request cancelled, ignoring result');
        return;
      }
      
      // Basic check: ensure we have a valid result
      if (!cached || typeof cached !== 'string' || cached.length < 100) {
        console.error('❌ Invalid cached result:', { cached: cached?.substring(0, 50), length: cached?.length });
        setError('Invalid visualization result. Please try again.');
        setLoadingMessage('');
        return;
      }
      
      console.log('✅ Setting visualized image, length:', cached.length);
      setVisualizedImage(cached);
      setLoadingMessage('');
    } catch (err: any) {
      // Ignore cancellation errors silently
      if (err.message === 'Request cancelled') {
        return;
      }
      
      // Only show error if this is still the current request
      if (currentRequestRef.current === requestId) {
        setVisualizationCount(prev => prev - 1); // Rollback on error
        console.error(err);
        setError(err.message || "Could not generate visualization. Try another color.");
        setLoadingMessage('');
      }
    } finally {
      // Only clear loading if this is still the current request
      if (currentRequestRef.current === requestId) {
        setLoading(false);
      }
    }
  };

  const handleGenerateList = async (colorName: string, area: number) => {
    if (!analysisResult) return;
    try {
      setLoading(true);
      setError(null);
      setLoadingMessage('Calculating material quantities...');
      
      // No longer need image - we have analysis results
      const list = await generateShoppingList(
        analysisResult.surfaceType,
        analysisResult.condition,
        colorName,
        area
      );
      setShoppingList(list);
      setAppState(AppState.SHOPPING);
      setLoadingMessage('');
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to generate shopping list.");
      setLoadingMessage('');
    } finally {
      setLoading(false);
    }
  };

  // Scroll to top when transitioning to visualizer (no animation on initial load)
  useEffect(() => {
    if (appState === AppState.VISUALIZING && !hasScrolledToVisualizer.current) {
      // Scroll to top immediately without animation
      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        window.scrollTo(0, 0);
        hasScrolledToVisualizer.current = true;
      });
    } else if (appState === AppState.IDLE) {
      // Reset flag when going back to idle
      hasScrolledToVisualizer.current = false;
    }
  }, [appState]);

  const handleReset = () => {
    setAppState(AppState.IDLE);
    setOriginalImage(null);
    setVisualizedImage(null);
    setAnalysisResult(null);
    setShoppingList(null);
    setError(null);
    setLoadingMessage('');
    setVisualizationCount(0);
    setValidationResult(null);
    setShowValidationModal(false);
    setPendingFile(null);
    currentRequestRef.current = null; // Cancel any pending requests
    loadingRequestRef.current = null;
    hasScrolledToVisualizer.current = false;
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-paper font-sans">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-paper/80 backdrop-blur-xl border-b border-stone-100 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between">
          {/* Logo */}
          <button 
            onClick={handleReset}
            className="flex items-center gap-2 sm:gap-2.5 group"
            aria-label="Go to homepage"
          >
            <img 
              src="/logo.png" 
              alt="Huey Logo" 
              loading="lazy"
              decoding="async"
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg transition-transform group-hover:scale-105 object-contain"
            />
            <span className="font-bold text-base sm:text-lg tracking-tight text-ink">
              Huey
            </span>
          </button>
          
          {/* New Project Button */}
          {appState !== AppState.IDLE && (
            <button 
              onClick={handleReset}
              className="flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2.5 text-sm font-semibold bg-ink text-white rounded-xl hover:bg-ink/90 transition-all shadow-sm active:scale-95 touch-manipulation"
              aria-label="Start a new project"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">New</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow">
        {/* Error Banner */}
        {error && (
          <div className="max-w-lg mx-auto mt-4 px-4 animate-reveal-up">
            <div className="p-3 sm:p-4 bg-red-50 text-red-700 rounded-xl sm:rounded-2xl text-sm text-center border border-red-100">
              {error}
            </div>
          </div>
        )}

        {/* Idle State: Hero + Upload */}
        {appState === AppState.IDLE && (
          <>
            <Hero onStart={handleStart} />
            <div id="upload-area" className="py-12 md:py-24 px-4 bg-gradient-warm">
              <UploadSection onImageSelected={handleImageSelected} isAnalyzing={loading} />
            </div>
          </>
        )}

        {/* Analyzing State */}
        {appState === AppState.ANALYZING && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center animate-reveal">
            <div className="relative mb-8">
              <div 
                className="absolute inset-0 rounded-full blur-2xl opacity-20 animate-pulse-subtle"
                style={{ background: 'var(--color-accent)' }}
              />
              <div className="relative w-20 h-20 rounded-full bg-accent-soft/50 flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-accent animate-spin" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-ink mb-3">Analyzing Your Space</h2>
            <p className="text-ink-subtle max-w-sm">
              Identifying surfaces, lighting conditions, and generating personalized color recommendations.
            </p>
          </div>
        )}

        {/* Visualizing State */}
        {appState === AppState.VISUALIZING && originalImage && (
          <>
            {/* Validation Warning Banner */}
            {validationResult && validationResult.warnings.length > 0 && (
              <div className="max-w-6xl mx-auto px-4 pt-6">
                <ImageValidationBanner
                  warnings={validationResult.warnings}
                  onDismiss={() => setValidationResult(null)}
                  onRetake={handleReset}
                />
              </div>
            )}
            <div ref={visualizerRef}>
              <Visualizer 
                originalImage={originalImage}
                visualizedImage={visualizedImage}
                analysis={analysisResult}
                isVisualizing={loading}
                loadingMessage={loadingMessage}
                onVisualize={handleVisualize}
                onGenerateList={handleGenerateList}
                onScrollToVisualizer={() => {
                  visualizerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
              />
            </div>
          </>
        )}

        {/* Validation Error Modal */}
        {showValidationModal && validationResult && (
          <ImageValidationModal
            validation={validationResult}
            onRetake={handleRetakePhoto}
            onTryAnyway={handleTryAnyway}
            onClose={() => setShowValidationModal(false)}
          />
        )}

        {/* Shopping State */}
        {appState === AppState.SHOPPING && shoppingList && (
          <ShoppingList 
            list={shoppingList}
            onBack={() => setAppState(AppState.VISUALIZING)}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-paper-warm border-t border-stone-100 py-8 sm:py-10 mt-auto">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-4">
          <p className="text-ink-subtle text-xs sm:text-sm">
            © {new Date().getFullYear()} Huey
          </p>
          <p className="text-ink-subtle text-xs sm:text-sm">
            Built for Ghanaian homeowners
          </p>
        </div>
      </footer>
    </div>
  );
};

export default App;