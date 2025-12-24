/**
 * Convert HEX color to HSL format required by Tailwind CSS variables
 */
export function hexToHSL(hex: string): string {
  // Remove # if present
  hex = hex.replace(/^#/, '');
  
  // Convert hex to RGB
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;
  
  // Find min and max values
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }
  
  // Convert to degrees and percentages
  h = Math.round(h * 360);
  s = Math.round(s * 100);
  l = Math.round(l * 100);
  
  return `${h} ${s}% ${l}%`;
}

/**
 * Apply theme color to CSS variables
 */
export function applyThemeColor(color: string): void {
  const hsl = hexToHSL(color);
  const root = document.documentElement;
  
  // Update primary color and related variables
  root.style.setProperty('--primary', hsl);
  root.style.setProperty('--ring', hsl);
  root.style.setProperty('--sidebar-primary', hsl);
  root.style.setProperty('--sidebar-ring', hsl);
  
  // Save to localStorage for persistence
  localStorage.setItem('theme-color', color);
}

/**
 * Load and apply saved theme color from localStorage
 * Defaults to black (#000000) if no color is saved
 */
export function loadSavedThemeColor(): void {
  const savedColor = localStorage.getItem('theme-color');
  if (savedColor) {
    applyThemeColor(savedColor);
  } else {
    // Apply black as default color
    applyThemeColor('#000000');
  }
}
