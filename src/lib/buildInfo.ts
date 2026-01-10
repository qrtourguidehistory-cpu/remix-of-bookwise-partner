// Build information for version verification
// This file is used to verify which build is running on the device

// Build timestamp - updated at build time or manually for debugging
export const BUILD_INFO = {
  // ISO timestamp of when this build was created
  buildTime: new Date().toISOString(),
  // Short identifier for this build
  buildId: generateBuildId(),
  // Version from package
  version: "1.0.0",
  // App name
  appName: "Mí Turnow Partner",
};

// Generate a short random build ID for easy identification
function generateBuildId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Helper to get formatted build info string
export function getBuildInfoString(): string {
  return `Build: ${BUILD_INFO.buildId} | ${BUILD_INFO.buildTime.split('T')[0]}`;
}

// Helper to check if running in Capacitor native environment
export function isNativeApp(): boolean {
  return typeof window !== 'undefined' && 
         'Capacitor' in window && 
         (window as any).Capacitor?.isNativePlatform?.() === true;
}

// Get platform info
export function getPlatformInfo(): string {
  if (typeof window === 'undefined') return 'SSR';
  if (isNativeApp()) {
    const platform = (window as any).Capacitor?.getPlatform?.() || 'native';
    return `Native (${platform})`;
  }
  return 'Web';
}
