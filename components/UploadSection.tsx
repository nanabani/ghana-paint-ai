import React, { useRef, useState, useCallback } from 'react';
import { Upload, Image as ImageIcon, Camera, Loader2 } from 'lucide-react';
import CameraCapture from './CameraCapture';

interface UploadSectionProps {
  onImageSelected: (file: File) => void;
  isAnalyzing: boolean;
}

const UploadSection: React.FC<UploadSectionProps> = ({ onImageSelected, isAnalyzing }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onImageSelected(e.dataTransfer.files[0]);
    }
  }, [onImageSelected]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      onImageSelected(e.target.files[0]);
    }
    // Reset input so the same file can be selected again if needed
    e.target.value = '';
  }, [onImageSelected]);

  const handleUploadClick = useCallback(() => {
    if (!isAnalyzing) {
      fileInputRef.current?.click();
    }
  }, [isAnalyzing]);

  const handleTakePhotoClick = useCallback(() => {
    if (!isAnalyzing) {
      setIsCameraOpen(true);
    }
  }, [isAnalyzing]);

  const handleCameraCapture = useCallback((file: File) => {
    onImageSelected(file);
  }, [onImageSelected]);

  const handleDropzoneClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Only trigger file upload if the click was directly on the dropzone area
    // and not on a child button
    const target = e.target as HTMLElement;
    const isButton = target.closest('button');
    
    if (!isButton && !isAnalyzing) {
      handleUploadClick();
    }
  }, [handleUploadClick, isAnalyzing]);

  const handleDropzoneKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ' ') && !isAnalyzing) {
      e.preventDefault();
      handleUploadClick();
    }
  }, [handleUploadClick, isAnalyzing]);

  return (
    <>
      {/* Camera Modal */}
      <CameraCapture
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={handleCameraCapture}
      />

      <div className="w-full max-w-2xl mx-auto animate-reveal-up">
        {/* File input - hidden */}
        <input 
          ref={fileInputRef} 
          type="file" 
          className="hidden" 
          accept="image/*" 
          onChange={handleFileChange} 
          disabled={isAnalyzing} 
        />

        {/* Dropzone Container */}
        <div 
          className={`
            relative flex flex-col items-center justify-center w-full min-h-[400px] 
            rounded-4xl transition-all duration-300 overflow-hidden
            ${dragActive 
              ? 'bg-accent-soft/30 border-accent scale-[1.01] shadow-xl' 
              : 'bg-paper-elevated border-stone-200 hover:border-stone-300 hover:shadow-lg'
            }
            border-2 border-dashed
            ${!isAnalyzing ? 'cursor-pointer' : 'cursor-default'}
          `}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={handleDropzoneClick}
          role="button"
          tabIndex={0}
          aria-label="Upload an image by clicking or dragging"
          onKeyDown={handleDropzoneKeyDown}
        >
          {isAnalyzing ? (
            <div className="flex flex-col items-center space-y-6 p-8">
              <div className="relative">
                <div 
                  className="absolute inset-0 rounded-full blur-xl opacity-30 animate-pulse-subtle"
                  style={{ background: 'var(--color-accent)' }}
                />
                <div className="relative w-16 h-16 rounded-full bg-accent-soft/50 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-accent animate-spin" />
                </div>
              </div>
              <div className="text-center">
                <p className="text-xl font-semibold text-ink mb-2">Analyzing your space</p>
                <p className="text-ink-subtle text-sm">Detecting walls, textures & lighting conditions...</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center text-center p-8 w-full max-w-md">
              {/* Icon */}
              <div className="w-16 h-16 rounded-2xl bg-stone-100 flex items-center justify-center mb-8">
                <Upload className="w-7 h-7 text-ink-muted" />
              </div>
              
              {/* Text */}
              <h3 className="text-2xl font-semibold text-ink mb-2">
                Drop your photo here
              </h3>
              <p className="text-ink-subtle mb-10 leading-relaxed">
                or use one of the options below
              </p>

              {/* Action buttons */}
              <div className="flex flex-col w-full gap-3">
                <button
                  type="button"
                  onClick={handleTakePhotoClick}
                  className="group flex items-center justify-center w-full px-6 py-4 bg-ink text-white font-semibold rounded-2xl hover:bg-ink/90 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 touch-manipulation"
                  aria-label="Take a photo with your camera"
                >
                  <Camera className="w-5 h-5 mr-3" />
                  Take Photo
                </button>

                <button
                  type="button"
                  onClick={handleUploadClick}
                  className="flex items-center justify-center w-full px-6 py-4 bg-paper-warm border border-stone-200 text-ink font-semibold rounded-2xl hover:bg-stone-100 hover:border-stone-300 transition-all touch-manipulation"
                  aria-label="Select an image from your gallery"
                >
                  <ImageIcon className="w-5 h-5 mr-3 text-ink-subtle" />
                  Choose from Gallery
                </button>
              </div>

              {/* Supported formats */}
              <div className="mt-8 flex items-center gap-4 text-xs font-medium text-ink-subtle uppercase tracking-wider">
                <span>JPG</span>
                <span className="w-1 h-1 rounded-full bg-stone-300" />
                <span>PNG</span>
                <span className="w-1 h-1 rounded-full bg-stone-300" />
                <span>WEBP</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default UploadSection;
