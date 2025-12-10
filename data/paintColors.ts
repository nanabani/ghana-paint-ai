export interface PaintColor {
  name: string;
  hex: string;
  manufacturer: 'Neuce' | 'Azar' | 'Leyland' | 'Shield' | 'Other';
  category: 'exterior' | 'interior' | 'both';
  code?: string; // Manufacturer's color code
}

export const PAINT_COLORS: Record<string, PaintColor[]> = {
  neuce: [
    // TODO: Replace with actual Neuce color chart data from physical color chart
    { name: 'Peach Blossom', hex: '#FFE5B4', manufacturer: 'Neuce', category: 'both', code: 'NC-001' },
    { name: 'Terracotta', hex: '#E2725B', manufacturer: 'Neuce', category: 'exterior', code: 'NC-002' },
    { name: 'Apple Green', hex: '#8DB600', manufacturer: 'Neuce', category: 'exterior', code: 'NC-003' },
    { name: 'Navy Blue', hex: '#000080', manufacturer: 'Neuce', category: 'both', code: 'NC-004' },
    { name: 'Magnolia', hex: '#F8F4E3', manufacturer: 'Neuce', category: 'interior', code: 'NC-005' },
    { name: 'Cream White', hex: '#FFFDD0', manufacturer: 'Neuce', category: 'both', code: 'NC-006' },
    { name: 'Sky Blue', hex: '#87CEEB', manufacturer: 'Neuce', category: 'exterior', code: 'NC-007' },
    { name: 'Sunset Orange', hex: '#FF6B35', manufacturer: 'Neuce', category: 'exterior', code: 'NC-008' },
    { name: 'Forest Green', hex: '#228B22', manufacturer: 'Neuce', category: 'exterior', code: 'NC-009' },
    { name: 'Warm Beige', hex: '#F5DEB3', manufacturer: 'Neuce', category: 'both', code: 'NC-010' },
  ],
  azar: [
    // TODO: Replace with actual Azar color chart data from physical color chart
    { name: 'Cream White', hex: '#FFFDD0', manufacturer: 'Azar', category: 'both', code: 'AZ-001' },
    { name: 'Sky Blue', hex: '#87CEEB', manufacturer: 'Azar', category: 'exterior', code: 'AZ-002' },
    { name: 'Terracotta Red', hex: '#CD5C5C', manufacturer: 'Azar', category: 'exterior', code: 'AZ-003' },
    { name: 'Olive Green', hex: '#808000', manufacturer: 'Azar', category: 'exterior', code: 'AZ-004' },
    { name: 'Sand Beige', hex: '#E6D5B8', manufacturer: 'Azar', category: 'both', code: 'AZ-005' },
    { name: 'Charcoal Gray', hex: '#36454F', manufacturer: 'Azar', category: 'both', code: 'AZ-006' },
    { name: 'Butter Yellow', hex: '#FFF8DC', manufacturer: 'Azar', category: 'interior', code: 'AZ-007' },
    { name: 'Ocean Blue', hex: '#4682B4', manufacturer: 'Azar', category: 'exterior', code: 'AZ-008' },
    { name: 'Coral Pink', hex: '#FF7F50', manufacturer: 'Azar', category: 'exterior', code: 'AZ-009' },
    { name: 'Mint Green', hex: '#98FB98', manufacturer: 'Azar', category: 'interior', code: 'AZ-010' },
  ],
  leyland: [
    // TODO: Add Leyland color chart data from physical color chart
    // Placeholder structure - add real colors when available
  ],
  shield: [
    // TODO: Add Shield color chart data from physical color chart
    // Placeholder structure - add real colors when available
  ],
};

/**
 * Get colors by manufacturer name
 */
export const getColorsByManufacturer = (manufacturer: string): PaintColor[] => {
  const key = manufacturer.toLowerCase();
  return PAINT_COLORS[key] || [];
};

/**
 * Format colors for use in AI prompts
 * Returns a formatted string like: "Peach Blossom #FFE5B4 (Code: NC-001), Terracotta #E2725B (Code: NC-002)"
 */
export const formatColorsForPrompt = (colors: PaintColor[]): string => {
  if (colors.length === 0) return 'No colors available';
  // Optimized format: saves ~3 tokens per color by removing parentheses
  return colors.map(c => `${c.name} ${c.hex}${c.code ? ` ${c.code}` : ''}`).join(', ');
};

/**
 * Get all available manufacturers
 */
export const getAvailableManufacturers = (): string[] => {
  return Object.keys(PAINT_COLORS).filter(key => PAINT_COLORS[key].length > 0);
};

