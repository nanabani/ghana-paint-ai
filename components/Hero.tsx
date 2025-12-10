import React from 'react';
import { ArrowDown, Sparkles } from 'lucide-react';

interface HeroProps {
  onStart: () => void;
}

const Hero: React.FC<HeroProps> = ({ onStart }) => {
  return (
    <section className="relative min-h-[90dvh] flex flex-col items-center justify-center overflow-hidden bg-paper">
      {/* Atmospheric background */}
      <div className="absolute inset-0 bg-mesh pointer-events-none" />
      
      {/* Decorative elements */}
      <div 
        className="absolute top-20 left-[15%] w-72 h-72 rounded-full opacity-[0.03] blur-3xl pointer-events-none"
        style={{ background: 'var(--color-accent)' }}
      />
      <div 
        className="absolute bottom-32 right-[10%] w-96 h-96 rounded-full opacity-[0.04] blur-3xl pointer-events-none"
        style={{ background: 'var(--color-secondary)' }}
      />
      
      {/* Content */}
      <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
        {/* Badge */}
        <div className="animate-reveal-up inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent-soft/40 border border-accent/10 mb-10">
          <Sparkles className="w-4 h-4 text-accent" />
          <span className="text-sm font-medium text-accent">AI-Powered Visualization</span>
        </div>
        
        {/* Main headline */}
        <h1 
          className="animate-reveal-up delay-1 text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight text-ink leading-[1.05] mb-8"
        >
          See your walls
          <br />
          <span className="text-gradient">before you paint</span>
        </h1>
        
        {/* Subheadline */}
        <p 
          className="animate-reveal-up delay-2 max-w-2xl mx-auto text-lg sm:text-xl text-ink-muted leading-relaxed mb-12"
        >
          Upload a photo of your space. Our AI visualizes new colors instantly 
          and generates a complete shopping list with local Ghanaian prices.
        </p>
        
        {/* CTA */}
        <div className="animate-reveal-up delay-3 flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={onStart}
            className="group relative inline-flex items-center gap-3 px-8 py-4 text-lg font-semibold text-white transition-all duration-300 bg-ink rounded-full hover:bg-ink/90 shadow-xl hover:shadow-2xl hover:-translate-y-0.5 active:translate-y-0 touch-manipulation"
            tabIndex={0}
            aria-label="Start your project"
          >
            Start Your Project
            <ArrowDown className="w-5 h-5 transition-transform group-hover:translate-y-0.5" />
          </button>
          
          <span className="text-ink-subtle text-sm font-medium">
            Free • No signup required
          </span>
        </div>
        
        {/* Feature highlights */}
        <div className="animate-reveal-up delay-4 mt-20 flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
          {[
            { label: 'Instant Results', dot: 'bg-emerald-500' },
            { label: 'Local Pricing (GHS)', dot: 'bg-accent' },
            { label: 'Pro Recommendations', dot: 'bg-amber-500' },
          ].map((feature, idx) => (
            <div 
              key={idx} 
              className="flex items-center gap-3 text-ink-muted"
            >
              <span className={`w-2 h-2 rounded-full ${feature.dot}`} />
              <span className="text-sm font-medium">{feature.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Hero;
