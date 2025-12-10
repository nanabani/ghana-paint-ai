export interface Palette {
  name: string;
  colors: { name: string; hex: string }[];
  description: string;
}

export interface AnalysisResult {
  surfaceType: string;
  condition: string;
  description: string;
  estimatedAreaWarning: string;
  palettes: Palette[];
}

export interface ShoppingItem {
  name: string;
  category: 'Paint' | 'Primer' | 'Hardware' | 'Preparation' | 'Other';
  quantity: number;
  unit: string;
  estimatedPriceGHS: number;
  reason: string;
}

export interface ShoppingList {
  items: ShoppingItem[];
  totalMaterialCostGHS: number;
  estimatedLaborCostGHS: number;
  installationNotes: string;
}

export enum AppState {
  IDLE,
  ANALYZING,
  VISUALIZING,
  SHOPPING,
}

export interface GeminiError {
  message: string;
}