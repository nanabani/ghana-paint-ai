import React, { useRef, useState, useCallback, useEffect } from 'react';
import { X, Camera, SwitchCamera, Loader2 } from 'lucide-react';

interface CameraCaptureProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
}

type CameraFacing = 'user' | 'environment';

const CameraCapture: React.FC<CameraCaptureProps> = ({ isOpen, onClose, onCapture }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<CameraFacing>('environment');
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const startCamera = useCallback(async (facing: CameraFacing) => {
    setIsLoading(true);
    setError(null);
    
    // Stop any existing stream first
    stopCamera();

    try {
      // Check if getUserMedia is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access is not supported in this browser');
      }

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: facing,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // Check for multiple cameras
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      setHasMultipleCameras(videoDevices.length > 1);
      
      setIsLoading(false);
    } catch (err: any) {
      console.error('Camera error:', err);
      setIsLoading(false);
      
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('Camera permission denied. Please allow camera access and try again.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setError('No camera found on this device.');
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setError('Camera is in use by another application.');
      } else {
        setError(err.message || 'Unable to access camera.');
      }
    }
  }, [stopCamera]);

  // Start camera when modal opens
  useEffect(() => {
    if (isOpen) {
      startCamera(facingMode);
    } else {
      stopCamera();
    }
    
    return () => {
      stopCamera();
    };
  }, [isOpen, startCamera, stopCamera, facingMode]);

  const handleSwitchCamera = () => {
    const newFacing = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newFacing);
  };

  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw the current video frame
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert to blob and create file
    canvas.toBlob(
      (blob) => {
        if (blob) {
          const file = new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' });
          stopCamera();
          onCapture(file);
          onClose();
        }
      },
      'image/jpeg',
      0.9
    );
  };

  const handleClose = () => {
    stopCamera();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-ink/95 flex flex-col animate-reveal">
      {/* Header */}
      <div className="flex items-center justify-between p-4 text-white">
        <button
          onClick={handleClose}
          className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors touch-manipulation"
          aria-label="Close camera"
        >
          <X className="w-5 h-5" />
        </button>
        
        <span className="font-medium">Take Photo</span>
        
        {hasMultipleCameras && !isLoading && !error ? (
          <button
            onClick={handleSwitchCamera}
            className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors touch-manipulation"
            aria-label="Switch camera"
          >
            <SwitchCamera className="w-5 h-5" />
          </button>
        ) : (
          <div className="w-10" /> 
        )}
      </div>

      {/* Camera View */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white z-10">
            <Loader2 className="w-10 h-10 animate-spin mb-4" />
            <p className="text-sm text-white/70">Requesting camera access...</p>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white z-10 p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
              <Camera className="w-8 h-8 text-red-400" />
            </div>
            <p className="text-lg font-medium mb-2">Camera Unavailable</p>
            <p className="text-sm text-white/60 max-w-sm">{error}</p>
            <button
              onClick={handleClose}
              className="mt-6 px-6 py-3 bg-white/10 hover:bg-white/20 rounded-xl font-medium transition-colors touch-manipulation"
            >
              Go Back
            </button>
          </div>
        )}

        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`
            max-w-full max-h-full object-contain
            ${facingMode === 'user' ? 'scale-x-[-1]' : ''}
            ${isLoading || error ? 'opacity-0' : 'opacity-100'}
            transition-opacity duration-300
          `}
        />
        
        {/* Hidden canvas for capturing */}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* Capture Button */}
      {!error && (
        <div className="p-8 flex items-center justify-center">
          <button
            onClick={handleCapture}
            disabled={isLoading}
            className="
              w-20 h-20 rounded-full bg-white 
              flex items-center justify-center
              shadow-xl shadow-black/30
              hover:scale-105 active:scale-95
              transition-transform
              disabled:opacity-50 disabled:cursor-not-allowed
              ring-4 ring-white/30 touch-manipulation
            "
            aria-label="Capture photo"
          >
            <div className="w-16 h-16 rounded-full bg-white border-4 border-ink/10" />
          </button>
        </div>
      )}
    </div>
  );
};

export default CameraCapture;

