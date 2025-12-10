import React, { useState, useMemo, useEffect } from 'react';
import { X, Search, Check } from 'lucide-react';
import { Palette } from '../types';

interface ColorModalProps {
  isOpen: boolean;
  onClose: () => void;
  palette: Palette;
  selectedColor: { name: string; hex: string } | null;
  onSelectColor: (color: { name: string; hex: string }) => void;
}

const ColorModal: React.FC<ColorModalProps> = ({
  isOpen,
  onClose,
  palette,
  selectedColor,
  onSelectColor,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Normalize hex color
  const normalizeHex = (hex: string): string => {
    if (!hex) return '#000000';
    let normalized = hex.trim();
    if (!normalized.startsWith('#')) {
      normalized = '#' + normalized;
    }
    if (normalized.length === 4) {
      normalized = '#' + normalized[1] + normalized[1] + normalized[2] + normalized[2] + normalized[3] + normalized[3];
    }
    if (!/^#[0-9A-Fa-f]{6}$/.test(normalized)) {
      return '#000000';
    }
    return normalized;
  };

  // Check if color is light (for contrast)
  const isLightColor = (hex: string): boolean => {
    const normalized = normalizeHex(hex);
    const r = parseInt(normalized.slice(1, 3), 16);
    const g = parseInt(normalized.slice(3, 5), 16);
    const b = parseInt(normalized.slice(5, 7), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 155;
  };

  // Filter colors based on search query
  const filteredColors = useMemo(() => {
    if (!searchQuery.trim()) return palette.colors;
    
    const query = searchQuery.toLowerCase().trim();
    return palette.colors.filter((color) => {
      const name = color.name.toLowerCase();
      const hex = color.hex.toLowerCase();
      return name.includes(query) || hex.includes(query);
    });
  }, [palette.colors, searchQuery]);

  if (!isOpen) return null;

  const handleSelect = (color: { name: string; hex: string }) => {
    const normalizedHex = normalizeHex(color.hex);
    onSelectColor({ name: color.name, hex: normalizedHex });
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-ink/60 backdrop-blur-sm z-40 animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
        onKeyDown={handleKeyDown}
        tabIndex={-1}
      >
        <div
          className="bg-paper rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-reveal-up"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 sm:p-6 border-b border-stone-200">
            <h2 className="text-xl sm:text-2xl font-bold text-ink">
              {palette.name.replace("AI-CURATED SUGGESTION", "AI Pick")}
            </h2>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center transition-colors"
              aria-label="Close color catalog"
            >
              <X className="w-5 h-5 text-ink" />
            </button>
          </div>

          {/* Search Bar */}
          <div className="p-4 sm:p-6 border-b border-stone-200">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-subtle" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search colors by name or hex code..."
                className="w-full pl-12 pr-4 py-3 rounded-xl border border-stone-200 focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-all"
                aria-label="Search colors"
                autoFocus
              />
            </div>
            {searchQuery && (
              <p className="mt-2 text-sm text-ink-subtle">
                {filteredColors.length} {filteredColors.length === 1 ? 'color' : 'colors'} found
              </p>
            )}
          </div>

          {/* Color Grid */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
            {filteredColors.length > 0 ? (
              <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-3 sm:gap-4">
                {filteredColors.map((color, idx) => {
                  const normalizedHex = normalizeHex(color.hex);
                  const isSelected = selectedColor?.name === color.name;
                  
                  return (
                    <button
                      key={idx}
                      onClick={() => handleSelect(color)}
                      className="flex flex-col items-center group cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 rounded-lg p-2 transition-all"
                      aria-label={`Select color ${color.name}, hex ${normalizedHex}`}
                      tabIndex={0}
                    >
                      <div
                        className={`
                          relative w-14 h-14 sm:w-16 sm:h-16 rounded-full transition-all duration-200 mb-2
                          border-2 shadow-sm
                          ${isSelected
                            ? 'ring-2 ring-offset-2 ring-accent scale-110 shadow-md border-ink/10'
                            : 'border-ink/10 group-hover:scale-105 group-hover:shadow-md group-active:scale-95'
                          }
                        `}
                        style={{ backgroundColor: normalizedHex }}
                      >
                        {isSelected && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Check className={`w-5 h-5 ${isLightColor(normalizedHex) ? 'text-ink' : 'text-white'} drop-shadow-sm`} />
                          </div>
                        )}
                      </div>
                      <span
                        className={`
                          text-[10px] sm:text-xs font-medium text-center leading-tight line-clamp-2
                          ${isSelected ? 'text-accent font-semibold' : 'text-ink-subtle group-hover:text-ink'}
                        `}
                      >
                        {color.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-ink-muted text-lg mb-2">No colors found</p>
                <p className="text-ink-subtle text-sm">Try a different search term</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 sm:p-6 border-t border-stone-200 bg-stone-50/50">
            <p className="text-sm text-ink-subtle text-center">
              Showing {filteredColors.length} of {palette.colors.length} colors
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default ColorModal;

