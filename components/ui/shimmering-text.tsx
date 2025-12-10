import React from 'react';
import { cn } from '../lib/utils';

interface ShimmeringTextProps {
  /** Text to display with shimmer effect */
  text: string;
  /** Custom className */
  className?: string;
  /** Base text color */
  color?: string;
  /** Shimmer gradient color */
  shimmerColor?: string;
}

export const ShimmeringText: React.FC<ShimmeringTextProps> = ({
  text,
  className,
  color = 'text-ink',
  shimmerColor,
}) => {
  return (
    <span
      className={cn(
        'relative inline-block',
        'bg-gradient-to-r from-transparent via-white/60 to-transparent',
        'bg-[length:200%_100%] bg-clip-text text-transparent',
        'animate-shimmer',
        className
      )}
      style={{
        backgroundImage: shimmerColor
          ? `linear-gradient(90deg, transparent, ${shimmerColor}, transparent)`
          : undefined,
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
        color: 'inherit',
      }}
    >
      <span className={cn('relative z-10', color)} style={{ WebkitTextFillColor: 'currentColor' }}>
        {text}
      </span>
      <span
        className={cn(
          'absolute inset-0 bg-gradient-to-r',
          shimmerColor
            ? `from-transparent via-[${shimmerColor}] to-transparent`
            : 'from-transparent via-white/60 to-transparent',
          'bg-[length:200%_100%] animate-shimmer opacity-70'
        )}
        style={{
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}
        aria-hidden="true"
      >
        {text}
      </span>
    </span>
  );
};
