import React from 'react';
import { AlertTriangle, X, Check } from 'lucide-react';

interface ImageValidationBannerProps {
  warnings: string[];
  onDismiss: () => void;
  onRetake: () => void;
}

const ImageValidationBanner: React.FC<ImageValidationBannerProps> = ({
  warnings,
  onDismiss,
  onRetake,
}) => {
  if (warnings.length === 0) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 animate-reveal-up">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-amber-900 mb-1">Photo Quality Notice</p>
          <ul className="text-sm text-amber-700 space-y-1 mb-2">
            {warnings.map((warning, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-amber-600 mt-0.5">•</span>
                <span>{warning}</span>
              </li>
            ))}
          </ul>
          <button
            onClick={onRetake}
            className="text-sm font-medium text-amber-900 underline hover:text-amber-950 transition-colors"
          >
            Retake Photo
          </button>
        </div>
        <button
          onClick={onDismiss}
          className="text-amber-600 hover:text-amber-800 transition-colors flex-shrink-0"
          aria-label="Dismiss warning"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default ImageValidationBanner;

