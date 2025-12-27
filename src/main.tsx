import { createRoot } from "react-dom/client";
import { Capacitor } from "@capacitor/core";
import App from "./App.tsx";
import "./index.css";

// Initialize Capacitor plugins for native platforms
const initializeCapacitor = async () => {
  if (Capacitor.isNativePlatform()) {
    try {
      // Hide splash screen after app loads
      const { SplashScreen } = await import("@capacitor/splash-screen");
      await SplashScreen.hide();

      // Configure status bar
      const { StatusBar, Style } = await import("@capacitor/status-bar");
      await StatusBar.setStyle({ style: Style.Dark });
      
      // Set status bar background color based on theme
      const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      await StatusBar.setBackgroundColor({ 
        color: isDark ? "#1a1a1a" : "#ffffff" 
      });

      console.log("[Capacitor] Native plugins initialized");
    } catch (error) {
      console.error("[Capacitor] Error initializing plugins:", error);
    }
  }
};

// Initialize Capacitor then render app
initializeCapacitor().then(() => {
  createRoot(document.getElementById("root")!).render(<App />);
});
