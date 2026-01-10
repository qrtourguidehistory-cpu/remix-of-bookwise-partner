import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";

/**
 * Hook that calculates and sets a CSS variable for the bottom safe area inset.
 * This is especially useful for Android devices with navigation bars (3-button or gesture)
 * where env(safe-area-inset-bottom) often returns 0.
 * 
 * The calculated value is exposed as --app-safe-bottom CSS variable on :root.
 */
export function useSafeArea() {
  useEffect(() => {
    const calculateSafeArea = () => {
      // Only calculate on native platforms or when we detect potential nav bar
      const isNative = Capacitor.isNativePlatform();
      const isAndroid = Capacitor.getPlatform() === "android";
      
      let bottomInset = 0;
      
      if (isNative && isAndroid) {
        // Calculate the difference between screen height and viewport height
        // This difference typically represents the system navigation bar
        const screenHeight = window.screen.height;
        const viewportHeight = window.innerHeight;
        const pixelRatio = window.devicePixelRatio || 1;
        
        // Convert screen height to CSS pixels
        const screenCssHeight = screenHeight / pixelRatio;
        
        // Calculate the bottom inset
        // On Android, the difference often includes status bar + nav bar
        // We estimate nav bar as approximately 48-56dp (converted to px)
        const totalDiff = screenCssHeight - viewportHeight;
        
        // If there's a significant difference, assume part is the nav bar
        // Typical Android nav bar is ~48dp = 48px on mdpi, scales with density
        if (totalDiff > 20) {
          // Use a portion of the diff as bottom inset
          // Usually nav bar is around 48-56dp
          const estimatedNavBar = Math.min(totalDiff, 60);
          bottomInset = Math.max(0, Math.round(estimatedNavBar));
        }
        
        // Alternative method using visualViewport if available
        if (window.visualViewport) {
          const vpHeight = window.visualViewport.height;
          const vpOffsetTop = window.visualViewport.offsetTop;
          const windowHeight = window.innerHeight;
          
          // If visualViewport is smaller than window, there might be UI elements
          if (windowHeight - vpHeight > vpOffsetTop) {
            const potentialBottom = windowHeight - vpHeight - vpOffsetTop;
            if (potentialBottom > 0 && potentialBottom < 100) {
              bottomInset = Math.max(bottomInset, Math.round(potentialBottom));
            }
          }
        }
      }
      
      // Clamp to reasonable values (0 to 100px)
      bottomInset = Math.max(0, Math.min(bottomInset, 100));
      
      // Set the CSS variable
      document.documentElement.style.setProperty("--app-safe-bottom", `${bottomInset}px`);
      
      // Also set related variables for convenience
      document.documentElement.style.setProperty("--bottom-nav-height", "76px");
      
      console.log(`[SafeArea] Calculated bottom inset: ${bottomInset}px`);
    };
    
    // Calculate on mount
    calculateSafeArea();
    
    // Recalculate on resize and orientation change
    window.addEventListener("resize", calculateSafeArea);
    window.addEventListener("orientationchange", calculateSafeArea);
    
    // Also listen to visualViewport changes if available
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", calculateSafeArea);
    }
    
    return () => {
      window.removeEventListener("resize", calculateSafeArea);
      window.removeEventListener("orientationchange", calculateSafeArea);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", calculateSafeArea);
      }
    };
  }, []);
}

/**
 * Initialize safe area variables immediately (call once in main.tsx)
 */
export function initializeSafeArea() {
  // Set default values immediately to prevent flash
  document.documentElement.style.setProperty("--app-safe-bottom", "0px");
  document.documentElement.style.setProperty("--bottom-nav-height", "76px");
}
