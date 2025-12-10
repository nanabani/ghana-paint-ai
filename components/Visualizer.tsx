import React, { useState, useEffect } from 'react';
import { AnalysisResult } from '../types';
import { Paintbrush, Check, Loader2, Maximize2, X, Sparkles, Building2, Info, ChevronDown, Palette } from 'lucide-react';

interface VisualizerProps {
  originalImage: string;
  visualizedImage: string | null;
  analysis: AnalysisResult | null;
  isVisualizing: boolean;
  loadingMessage?: string;
  onVisualize: (colorName: string, colorHex: string) => void;
  onGenerateList: (color: string, area: number) => void;
}

const Visualizer: React.FC<VisualizerProps> = ({ 
  originalImage, 
  visualizedImage, 
  analysis, 
  isVisualizing,
  loadingMessage,
  onVisualize,
  onGenerateList 
}) => {
  const [selectedColor, setSelectedColor] = useState<{name: string, hex: string} | null>(null);
  const [area, setArea] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'original' | 'visualized'>('original');
  const [showFullScreen, setShowFullScreen] = useState(false);
  const [isPaletteExpanded, setIsPaletteExpanded] = useState(true); // Always expanded on initial view

  // Reset state when image changes (new image uploaded)
  useEffect(() => {
    setSelectedColor(null);
    setActiveTab('original');
    setArea(0);
  }, [originalImage]);

  // Switch to visualized tab when new visualization is ready
  useEffect(() => {
    if (visualizedImage && selectedColor && !isVisualizing) {
      setActiveTab('visualized');
    }
  }, [visualizedImage, selectedColor, isVisualizing]);

  const handleColorSelect = (color: {name: string, hex: string}) => {
    setSelectedColor(color);
    // Clear visualized image immediately for instant feedback
    setActiveTab('original');
    onVisualize(color.name, color.hex);
    // Collapse palette on mobile after selection
    if (window.innerWidth < 1024) {
      setIsPaletteExpanded(false);
    }
  };

  const handleGenerateClick = () => {
    if (selectedColor && area > 0) {
      onGenerateList(selectedColor.name, area);
    }
  };

  const currentImage = activeTab === 'visualized' && visualizedImage ? visualizedImage : originalImage;

  // Normalize hex color to ensure it has # prefix and is valid
  const normalizeHex = (hex: string | undefined | null): string => {
    if (!hex || typeof hex !== 'string') return '#CCCCCC'; // Fallback to light gray if invalid
    
    // Remove any whitespace and convert to uppercase
    let normalized = hex.trim().toUpperCase();
    
    // Remove # if present (we'll add it back)
    normalized = normalized.replace('#', '');
    
    // Validate hex characters (0-9, A-F)
    if (!/^[0-9A-F]+$/.test(normalized)) {
      console.warn('Invalid hex color:', hex);
      return '#CCCCCC'; // Fallback
    }
    
    // Handle different hex formats
    if (normalized.length === 3) {
      // Convert RGB to RRGGBB
      normalized = normalized[0] + normalized[0] + normalized[1] + normalized[1] + normalized[2] + normalized[2];
    } else if (normalized.length === 6) {
      // Already correct format
    } else {
      // Invalid length, use fallback
      console.warn('Invalid hex color length:', hex);
      return '#CCCCCC';
    }
    
    return '#' + normalized;
  };

  const isLightColor = (hex: string) => {
    const normalized = normalizeHex(hex);
    const h = normalized.replace('#', '');
    if (h.length !== 6) return false;
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return yiq >= 180;
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-4 sm:py-8 md:px-8">
      {/* Full Screen Modal */}
      {showFullScreen && (
        <div 
          className="fixed inset-0 z-[60] bg-ink/95 backdrop-blur-xl flex flex-col items-center justify-center p-4 animate-reveal" 
          onClick={() => setShowFullScreen(false)}
        >
          <button 
            onClick={() => setShowFullScreen(false)}
            className="absolute top-4 right-4 sm:top-6 sm:right-6 z-50 bg-white/10 hover:bg-white/20 text-white p-2.5 sm:p-3 rounded-full backdrop-blur-sm transition-all"
            aria-label="Close fullscreen view"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div 
            className="flex-1 w-full flex items-center justify-center min-h-0 mb-4 sm:mb-6" 
            onClick={(e) => e.stopPropagation()}
          >
            <img 
              src={currentImage} 
              alt="Full screen view" 
              className="max-w-full max-h-full object-contain rounded-xl sm:rounded-2xl shadow-2xl"
            />
          </div>

          {/* Modal Tab Controls */}
          <div 
            className="flex bg-white/10 backdrop-blur-md p-1 rounded-full border border-white/10" 
            onClick={(e) => e.stopPropagation()}
          >
            {(['original', 'visualized'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                disabled={tab === 'visualized' && !visualizedImage}
                className={`
                  px-4 sm:px-6 py-2 sm:py-2.5 rounded-full text-sm font-medium transition-all capitalize
                  ${activeTab === tab 
                    ? 'bg-white text-ink shadow-lg' 
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                  }
                  disabled:opacity-30 disabled:cursor-not-allowed
                `}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      )}
       
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 lg:gap-8">
        {/* Image Section */}
        <div className="lg:col-span-7 space-y-4 sm:space-y-5 animate-reveal-up">
          {/* Main Image */}
          <div 
            className="relative bg-ink rounded-2xl sm:rounded-3xl overflow-hidden shadow-xl sm:shadow-2xl aspect-[4/3] group cursor-zoom-in"
            onClick={() => setShowFullScreen(true)}
          >
            <img 
              src={currentImage} 
              alt="Room view" 
              className={`
                w-full h-full object-cover transition-all duration-500
                ${isVisualizing ? 'scale-[1.02] opacity-60 blur-sm' : ''}
              `}
            />
            
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-ink/50 via-transparent to-transparent opacity-60 pointer-events-none" />

            {/* Fullscreen button */}
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setShowFullScreen(true);
              }}
              className="absolute top-3 right-3 sm:top-4 sm:right-4 bg-ink/40 hover:bg-ink/60 text-white backdrop-blur-md p-2 sm:p-2.5 rounded-lg sm:rounded-xl transition-all sm:opacity-0 sm:group-hover:opacity-100"
              aria-label="View full screen"
            >
              <Maximize2 className="w-4 h-4" />
            </button>

            {/* Tab Controls */}
            <div 
              className="absolute bottom-3 sm:bottom-5 left-1/2 -translate-x-1/2 flex bg-ink/50 backdrop-blur-xl p-1 rounded-full border border-white/10" 
              onClick={(e) => e.stopPropagation()}
            >
              {(['original', 'visualized'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  disabled={tab === 'visualized' && !visualizedImage}
                  className={`
                    px-3 sm:px-5 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium transition-all capitalize
                    ${activeTab === tab 
                      ? 'bg-white text-ink shadow-md' 
                      : 'text-white/80 hover:text-white hover:bg-white/10'
                    }
                    disabled:opacity-30 disabled:cursor-not-allowed
                  `}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Loading overlay */}
            {isVisualizing && (
              <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                <div className="bg-paper-elevated px-4 sm:px-6 py-3 sm:py-4 rounded-xl sm:rounded-2xl flex items-center gap-3 shadow-2xl border border-stone-100">
                  <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 text-accent animate-spin flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-ink text-xs sm:text-sm">
                      {loadingMessage || 'Painting walls...'}
                    </p>
                    {selectedColor && (
                      <p className="text-[10px] sm:text-xs text-ink-subtle mt-0.5">
                        Applying {selectedColor.name}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Surface Analysis Card */}
          {analysis ? (
            <div className="bg-paper-elevated rounded-xl sm:rounded-2xl p-4 sm:p-5 shadow-sm border border-stone-100 animate-reveal-up delay-1">
              <div className="flex items-start gap-3 sm:gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
                  <Info className="w-4 sm:w-5 h-4 sm:h-5 text-emerald-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="font-semibold text-ink text-sm mb-1.5">Surface Analysis</h4>
                  <p className="text-xs sm:text-sm text-ink-subtle mb-2">
                    <span className="font-medium text-ink">{analysis.surfaceType}</span> • {analysis.condition}
                  </p>
                  {analysis.description && (
                    <p className="text-xs sm:text-sm text-ink-muted leading-relaxed">
                      {analysis.description}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-paper-elevated rounded-xl sm:rounded-2xl p-4 sm:p-5 shadow-sm border border-stone-100 flex items-center gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-accent-soft/50 flex items-center justify-center flex-shrink-0">
                <Loader2 className="w-4 sm:w-5 h-4 sm:h-5 text-accent animate-spin" />
              </div>
              <div className="space-y-1.5 sm:space-y-2 flex-1">
                <h4 className="font-semibold text-ink text-sm">Analyzing Your Space</h4>
                <p className="text-xs sm:text-sm text-accent font-medium">
                  {loadingMessage || 'Analyzing architecture and lighting conditions...'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Controls Section */}
        <div className="lg:col-span-5 flex flex-col gap-4 sm:gap-6">
          {/* Collapsible Color Palette Card */}
          <div className="bg-paper-elevated rounded-2xl sm:rounded-3xl shadow-sm border border-stone-100 overflow-hidden animate-reveal-up delay-2">
            {/* Collapsible Header */}
            <button
              onClick={() => setIsPaletteExpanded(!isPaletteExpanded)}
              className="w-full p-4 sm:p-6 flex items-center justify-between hover:bg-stone-50/50 transition-colors lg:cursor-default"
              aria-expanded={isPaletteExpanded}
              aria-controls="color-palette-content"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent-soft/50 flex items-center justify-center">
                  <Palette className="w-5 h-5 text-accent" />
                </div>
                <div className="text-left">
                  <h3 className="text-base sm:text-lg font-semibold text-ink">Choose a Color</h3>
                  {selectedColor ? (
                    <div className="flex items-center gap-2 mt-0.5">
                      <div 
                        className="w-3 h-3 rounded-full border border-ink/10" 
                        style={{ backgroundColor: normalizeHex(selectedColor.hex) }}
                      />
                      <span className="text-xs sm:text-sm text-accent font-medium">{selectedColor.name}</span>
                    </div>
                  ) : (
                    <p className="text-xs sm:text-sm text-ink-subtle">Tap to select a paint color</p>
                  )}
                </div>
              </div>
              <ChevronDown 
                className={`w-5 h-5 text-ink-subtle transition-transform duration-300 lg:hidden ${isPaletteExpanded ? 'rotate-180' : ''}`} 
              />
            </button>
            
            {/* Collapsible Content */}
            <div 
              id="color-palette-content"
              className={`
                transition-all duration-300 ease-out overflow-hidden
                ${isPaletteExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0 lg:max-h-[500px] lg:opacity-100'}
              `}
            >
              <div className="px-4 sm:px-6 pb-4 sm:pb-6 space-y-3 sm:space-y-4 overflow-y-auto max-h-[380px] custom-scrollbar">
                {analysis ? (
                  analysis.palettes.map((palette, idx) => {
                    const isAI = palette.name.toUpperCase().includes("AI-CURATED");
                    // Debug: Log color data to help identify issues
                    if (process.env.NODE_ENV === 'development') {
                      console.log('Palette:', palette.name, 'Colors:', palette.colors);
                    }
                    return (
                      <div 
                        key={idx} 
                        className={`
                          rounded-xl sm:rounded-2xl p-4 sm:p-5 transition-all duration-300
                          ${isAI 
                            ? 'bg-gradient-to-br from-accent-soft/30 to-paper-warm border border-accent/10' 
                            : 'bg-paper-warm border border-stone-100'
                          }
                        `}
                      >
                        <div className="flex items-center justify-between mb-3 sm:mb-4">
                          <h4 className={`text-[10px] sm:text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 sm:gap-2 ${isAI ? 'text-accent' : 'text-ink-muted'}`}>
                            {isAI ? (
                              <Sparkles className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
                            ) : (
                              <Building2 className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
                            )}
                            <span className="truncate">{palette.name.replace("AI-CURATED SUGGESTION", "AI Pick")}</span>
                          </h4>
                          {isAI && (
                            <span className="text-[9px] sm:text-[10px] font-bold bg-accent text-white px-1.5 sm:px-2 py-0.5 rounded-full flex-shrink-0">
                              TOP
                            </span>
                          )}
                        </div>
                        
                        <div className="flex flex-wrap gap-3 sm:gap-4">
                          {palette.colors.map((color, cIdx) => {
                            const normalizedHex = normalizeHex(color.hex);
                            return (
                              <button
                                key={cIdx}
                                onClick={() => handleColorSelect({ name: color.name, hex: normalizedHex })}
                                className="flex flex-col items-center group/item cursor-pointer w-12 sm:w-14"
                                aria-label={`Select color ${color.name}`}
                              >
                                <div
                                  className={`
                                    relative w-10 h-10 sm:w-11 sm:h-11 rounded-full transition-all duration-200 mb-1.5 sm:mb-2 
                                    border border-ink/5 shadow-sm
                                    ${selectedColor?.name === color.name 
                                      ? 'ring-2 ring-offset-2 ring-accent scale-110 shadow-md' 
                                      : 'active:scale-95'
                                    }
                                  `}
                                  style={{ backgroundColor: normalizedHex }}
                                >
                                  {selectedColor?.name === color.name && (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                      <Check className={`w-4 h-4 ${isLightColor(normalizedHex) ? 'text-ink' : 'text-white'} drop-shadow-sm`} />
                                    </div>
                                  )}
                                </div>
                                <span className={`
                                  text-[9px] sm:text-[10px] font-medium text-center leading-tight line-clamp-2
                                  ${selectedColor?.name === color.name ? 'text-accent font-semibold' : 'text-ink-subtle'}
                                `}>
                                  {color.name}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  // Skeleton loading
                  [1, 2].map((i) => (
                    <div key={i} className="rounded-xl sm:rounded-2xl p-4 sm:p-5 bg-paper-warm border border-stone-100">
                      <div className="h-3 bg-stone-200 rounded w-2/5 mb-3 sm:mb-4 skeleton" />
                      <div className="flex gap-3 sm:gap-4">
                        {[1, 2, 3, 4].map(j => (
                          <div key={j} className="flex flex-col items-center space-y-1.5 sm:space-y-2">
                            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-stone-200 skeleton" />
                            <div className="w-7 sm:w-8 h-2 bg-stone-100 rounded" />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Action Card */}
          <div className="bg-ink rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-xl text-white relative overflow-hidden animate-reveal-up delay-3">
            {/* Decorative glow */}
            <div 
              className="absolute top-0 right-0 w-32 sm:w-40 h-32 sm:h-40 rounded-full blur-[60px] sm:blur-[80px] opacity-20 -mr-8 sm:-mr-10 -mt-8 sm:-mt-10 pointer-events-none"
              style={{ background: 'var(--color-accent)' }}
            />
            
            <div className="relative z-10">
              <h3 className="text-sm sm:text-base font-semibold mb-4 sm:mb-5 flex items-center gap-2">
                <Paintbrush className="w-4 h-4 text-accent" />
                Get Shopping List
              </h3>
              
              <div className="space-y-4 sm:space-y-5">
                <div>
                  <label className="text-[10px] sm:text-xs font-medium text-white/60 uppercase tracking-wide block mb-1.5 sm:mb-2">
                    Area to Paint
                  </label>
                  <div className="flex items-center gap-2 sm:gap-3">
                    <input
                      type="number"
                      inputMode="decimal"
                      min="1"
                      value={area || ''}
                      onChange={(e) => setArea(Number(e.target.value))}
                      placeholder="Enter size"
                      disabled={!analysis}
                      className="
                        flex-1 bg-white/10 border border-white/10 rounded-lg sm:rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 
                        text-white placeholder-white/40 text-sm sm:text-base
                        focus:ring-2 focus:ring-accent focus:border-transparent outline-none 
                        transition-all disabled:opacity-40 disabled:cursor-not-allowed
                      "
                    />
                    <span className="font-medium text-white/60 text-xs sm:text-sm">m²</span>
                  </div>
                </div>

                <button
                  onClick={handleGenerateClick}
                  disabled={!selectedColor || area <= 0}
                  className="
                    w-full py-3 sm:py-4 bg-accent hover:bg-accent-hover text-white rounded-lg sm:rounded-xl 
                    font-semibold text-sm sm:text-base shadow-lg disabled:opacity-40 disabled:cursor-not-allowed 
                    transition-all active:scale-[0.98]
                  "
                >
                  Get Materials & Pricing
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Visualizer;
