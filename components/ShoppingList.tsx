import React from 'react';
import { ShoppingList as ShoppingListType } from '../types';
import { ShoppingCart, Hammer, Phone, ArrowLeft, Check, MessageCircle } from 'lucide-react';

interface ShoppingListProps {
  list: ShoppingListType;
  onBack: () => void;
}

const categoryColors: Record<string, { bg: string; text: string; dot: string }> = {
  Paint: { bg: 'bg-accent-soft/50', text: 'text-accent', dot: 'bg-accent' },
  Primer: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  Hardware: { bg: 'bg-stone-100', text: 'text-stone-700', dot: 'bg-stone-500' },
  Preparation: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  Other: { bg: 'bg-stone-50', text: 'text-stone-600', dot: 'bg-stone-400' },
};

const ShoppingList: React.FC<ShoppingListProps> = ({ list, onBack }) => {
  const categories = ['Paint', 'Primer', 'Hardware', 'Preparation', 'Other'];

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-8 md:px-8">
      {/* Back button */}
      <button 
        onClick={onBack}
        className="flex items-center text-ink-subtle hover:text-ink mb-10 transition-colors group animate-reveal"
        aria-label="Go back to design view"
      >
        <div className="w-10 h-10 rounded-full bg-paper-elevated border border-stone-200 flex items-center justify-center mr-3 group-hover:border-stone-300 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </div>
        <span className="font-medium">Back to Design</span>
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main List Column */}
        <div className="lg:col-span-2 space-y-8">
          {/* Header */}
          <div className="flex items-center justify-between animate-reveal-up">
            <div>
              <h1 className="text-3xl font-bold text-ink mb-1">Your Materials</h1>
              <p className="text-ink-subtle">Everything you need for a professional finish</p>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-accent-soft/40 flex items-center justify-center">
              <ShoppingCart className="w-6 h-6 text-accent" />
            </div>
          </div>

          {/* Category Sections */}
          <div className="space-y-8">
            {categories.map((category, catIdx) => {
              const items = list.items.filter(i => i.category === category);
              if (items.length === 0) return null;
              const colors = categoryColors[category] || categoryColors.Other;

              return (
                <section 
                  key={category} 
                  className="animate-reveal-up"
                  style={{ animationDelay: `${(catIdx + 1) * 100}ms` }}
                >
                  {/* Category header */}
                  <div className="flex items-center gap-3 mb-4 ml-1">
                    <span className={`w-2 h-2 rounded-full ${colors.dot}`} />
                    <h2 className="text-xs font-bold text-ink uppercase tracking-widest">{category}</h2>
                    <span className="text-xs text-ink-subtle">({items.length} items)</span>
                  </div>
                  
                  {/* Items */}
                  <div className="bg-paper-elevated rounded-2xl border border-stone-100 overflow-hidden divide-y divide-stone-50">
                    {items.map((item, idx) => (
                      <div 
                        key={idx} 
                        className="p-5 hover:bg-paper-warm transition-colors group"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="flex items-start gap-4">
                            <div className="mt-0.5">
                              <div className="w-5 h-5 rounded-full border-2 border-stone-200 flex items-center justify-center group-hover:border-emerald-400 group-hover:bg-emerald-400 transition-all">
                                <Check className="w-3 h-3 text-transparent group-hover:text-white transition-colors" />
                              </div>
                            </div>
                            <div>
                              <h3 className="font-semibold text-ink leading-tight">{item.name}</h3>
                              <p className="text-sm text-ink-subtle mt-1">{item.reason}</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between sm:justify-end gap-6 ml-9 sm:ml-0">
                            <span className={`
                              px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap
                              ${colors.bg} ${colors.text}
                            `}>
                              {item.quantity} {item.unit}
                            </span>
                            <span className="font-bold text-ink text-lg tabular-nums">
                              ₵{item.estimatedPriceGHS.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>

          {/* Total Card */}
          <div 
            className="bg-ink rounded-3xl p-8 text-white shadow-2xl animate-reveal-up"
            style={{ animationDelay: '500ms' }}
          >
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div>
                <p className="text-white/60 font-medium text-sm mb-1">Estimated Material Cost</p>
                <p className="text-4xl font-bold tracking-tight">
                  ₵{list.totalMaterialCostGHS.toLocaleString()}
                </p>
              </div>
              <button 
                className="flex items-center gap-2 px-5 py-3 bg-white/10 hover:bg-white/15 rounded-xl backdrop-blur-sm transition-colors font-medium text-sm"
                aria-label="Share this list"
              >
                <MessageCircle className="w-4 h-4" />
                Share List
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1">
          <div 
            className="bg-paper-elevated p-6 rounded-3xl shadow-lg border border-stone-100 sticky top-24 animate-reveal-up"
            style={{ animationDelay: '300ms' }}
          >
            {/* Installation header */}
            <div className="mb-6">
              <h3 className="text-xl font-bold text-ink mb-1">Installation</h3>
              <p className="text-sm text-ink-subtle">Get it done by professionals</p>
            </div>
            
            {/* Labor cost */}
            <div className="bg-paper-warm p-5 rounded-2xl mb-6">
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm font-medium text-ink-muted">Labor Estimate</span>
                <span className="font-bold text-ink text-xl">₵{list.estimatedLaborCostGHS.toLocaleString()}</span>
              </div>
              <div className="h-px bg-stone-200 my-3" />
              <p className="text-xs text-ink-subtle italic leading-relaxed">
                "{list.installationNotes}"
              </p>
            </div>

            {/* Action buttons */}
            <div className="space-y-3">
              <button 
                className="w-full py-4 bg-ink text-white rounded-xl font-semibold hover:bg-ink/90 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2"
                aria-label="Book a professional painter"
              >
                <Hammer className="w-4 h-4 text-accent" />
                Book Pro Painter
              </button>
              
              <button 
                className="w-full py-4 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-xl font-semibold hover:bg-emerald-100 transition-all flex items-center justify-center gap-2"
                aria-label="Order materials via WhatsApp"
              >
                <Phone className="w-4 h-4" />
                WhatsApp Order
              </button>
            </div>
            
            {/* Warranty note */}
            <div className="mt-6 flex items-center justify-center gap-2 text-xs text-ink-subtle font-medium bg-paper-warm py-2.5 rounded-lg">
              <Check className="w-3 h-3 text-emerald-500" />
              30-day workmanship warranty
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShoppingList;
