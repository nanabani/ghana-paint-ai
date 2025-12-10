import React from 'react';
import { cn } from '../../lib/utils';

interface RainbowButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

export const RainbowButton: React.FC<RainbowButtonProps> = ({
  children,
  className,
  ...props
}) => {
  return (
    <button
      className={cn(
        "group relative inline-flex h-14 animate-rainbow cursor-pointer items-center justify-center rounded-full border-0 bg-[length:200%] px-8 py-2 font-semibold text-white transition-all duration-300 [background-clip:padding-box,border-box,border-box] [background-origin:border-box] [border:calc(0.08*1rem)_solid_transparent] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 touch-manipulation",
        
        // hover and active states
        "hover:scale-105 hover:shadow-[0_0_30px_rgba(255,0,255,0.5)] active:scale-95",
        
        // before styles for glow effect
        "before:absolute before:bottom-[-20%] before:left-1/2 before:z-0 before:h-1/5 before:w-3/5 before:-translate-x-1/2 before:animate-rainbow before:bg-[linear-gradient(90deg,hsl(0,100%,63%),hsl(90,100%,63%),hsl(210,100%,63%),hsl(195,100%,63%),hsl(270,100%,63%))] before:bg-[length:200%] before:transition-all before:duration-300 before:[filter:blur(calc(0.8*1rem))] hover:before:h-2/5 hover:before:w-4/5 hover:before:[filter:blur(calc(1.2*1rem))]",
        
        // rainbow gradient background
        "bg-[linear-gradient(#1c1917,#1c1917),linear-gradient(#1c1917_50%,rgba(28,25,23,0.6)_80%,rgba(28,25,23,0)),linear-gradient(90deg,hsl(0,100%,63%),hsl(90,100%,63%),hsl(210,100%,63%),hsl(195,100%,63%),hsl(270,100%,63%))]",
        
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
};

