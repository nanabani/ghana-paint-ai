import React from 'react';
import { AlertCircle, Check, X } from 'lucide-react';
import { ValidationResult } from '../services/imageValidation';

interface ImageValidationModalProps {
  validation: ValidationResult;
  onRetake: () => void;
  onTryAnyway: () => void;
  onClose: () => void;
}

const ImageValidationModal: React.FC<ImageValidationModalProps> = ({
  validation,
  onRetake,
  onTryAnyway,
  onClose,
}) => {
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-ink/60 backdrop-blur-sm z-50 animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose();
        }}
        tabIndex={-1}
      >
        <div
          className="bg-paper rounded-2xl sm:rounded-3xl shadow-2xl max-w-md w-full p-6 animate-reveal-up"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start gap-4 mb-4">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-ink mb-1">Photo Quality Issue</h3>
              <ul className="text-ink-subtle text-sm space-y-1">
                {validation.errors.map((error, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-red-600 mt-0.5">•</span>
                    <span>{error}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Tips */}
          {validation.tips.length > 0 && (
            <div className="bg-stone-50 rounded-lg p-4 mb-4">
              <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-2">
                Quick Tips:
              </p>
              <ul className="text-sm text-ink-subtle space-y-1.5">
                {validation.tips.slice(0, 4).map((tip, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onRetake}
              className="flex-1 px-4 py-3 bg-ink text-white rounded-xl font-semibold hover:bg-ink/90 transition-colors"
            >
              Retake Photo
            </button>
            <button
              onClick={onTryAnyway}
              className="px-4 py-3 border border-stone-200 rounded-xl font-medium text-ink hover:bg-stone-50 transition-colors"
            >
              Try Anyway
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default ImageValidationModal;

