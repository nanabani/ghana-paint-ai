import React, { useState, useEffect } from 'react';
import { AlertCircle, Clock, CheckCircle2 } from 'lucide-react';
import { getRateLimitStatus, LIMITS } from '../services/rateLimiter';

interface RateLimitBannerProps {
  isVisible: boolean;
}

const RateLimitBanner: React.FC<RateLimitBannerProps> = ({ isVisible }) => {
  const [status, setStatus] = useState(getRateLimitStatus());
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  // Update status every second for real-time countdown
  useEffect(() => {
    if (!isVisible) return;

    const updateStatus = () => {
      const newStatus = getRateLimitStatus();
      setStatus(newStatus);
      
      // Calculate cooldown seconds
      const now = Date.now();
      if (newStatus.cooldownUntil > now) {
        setCooldownSeconds(Math.ceil((newStatus.cooldownUntil - now) / 1000));
      } else {
        setCooldownSeconds(0);
      }
    };

    updateStatus();
    const interval = setInterval(updateStatus, 1000);

    return () => clearInterval(interval);
  }, [isVisible]);

  if (!isVisible) return null;

  const formatTimeUntilReset = (ms: number): string => {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  // Show cooldown message
  if (cooldownSeconds > 0) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 flex items-center gap-3 animate-fade-in">
        <Clock className="w-5 h-5 text-amber-600 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium text-amber-900">
            Please wait {cooldownSeconds} second{cooldownSeconds !== 1 ? 's' : ''} before your next request
          </p>
        </div>
      </div>
    );
  }

  // Show limit reached message
  if (status.dailyRemaining === 0) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 flex items-center gap-3 animate-fade-in">
        <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium text-red-900">
            Daily limit reached. Resets in {formatTimeUntilReset(status.timeUntilDailyReset)}
          </p>
        </div>
      </div>
    );
  }

  if (status.hourlyRemaining === 0) {
    return (
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-4 flex items-center gap-3 animate-fade-in">
        <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium text-orange-900">
            Hourly limit reached. Try again in a few minutes.
          </p>
        </div>
      </div>
    );
  }

  // Show status message (remaining counts)
  if (status.dailyRemaining <= 2) {
    // Warning: Low remaining
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 flex items-center gap-3 animate-fade-in">
        <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium text-amber-900">
            {status.dailyRemaining} visualization{status.dailyRemaining !== 1 ? 's' : ''} remaining today
          </p>
        </div>
      </div>
    );
  }

  // Normal status: Show remaining counts
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 flex items-center gap-3 animate-fade-in">
      <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0" />
      <div className="flex-1">
        <p className="text-sm font-medium text-blue-900">
          {status.dailyRemaining} visualization{status.dailyRemaining !== 1 ? 's' : ''} remaining today
          {status.hourlyRemaining < LIMITS.HOURLY_VISUALIZATIONS && (
            <span className="text-blue-700"> • {status.hourlyRemaining} this hour</span>
          )}
        </p>
      </div>
    </div>
  );
};

export default RateLimitBanner;

