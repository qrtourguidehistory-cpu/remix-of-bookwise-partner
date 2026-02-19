import { createRoot } from "react-dom/client";
import { Capacitor } from "@capacitor/core";
import App from "./App.tsx";
import "./index.css";
import { initializeSafeArea } from "./hooks/useSafeArea";
import { Purchases, LOG_LEVEL } from "@revenuecat/purchases-capacitor";

// Initialize safe area variables immediately
initializeSafeArea();

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

      // Initialize RevenueCat only on Android
      if (Capacitor.getPlatform() === "android") {
        try {
          // ✅ PASO 0 — ACTIVAR LOGS DEBUG ANTES DE CUALQUIER OTRA COSA
          // Esto es lo primero que debe ejecutarse para que Logcat muestre
          // todos los mensajes internos del SDK (requests, responses, errores)
          await Purchases.setLogLevel({ level: LOG_LEVEL.DEBUG });
          console.log("[RevenueCat] 🪵 LOG_LEVEL.DEBUG activado — Logcat mostrará todos los logs del SDK");

          // ✅ API KEY EXACTA del RevenueCat Dashboard (L mayúscula, no l minúscula)
          // Public SDK Key visible en: app.revenuecat.com → API keys → MI TURNOW PARTNER (Play Store)
          const apiKey = "goog_tikShxRoguFTFrhLWiWrSmssyzo";
          
          console.log("[RevenueCat] 🔑 Iniciando configuración...");
          console.log("[RevenueCat] API Key:", apiKey);
          console.log("[RevenueCat] API Key length:", apiKey.length);
          console.log("[RevenueCat] API Key primeros 8 chars:", apiKey.substring(0, 8));
          console.log("[RevenueCat] API Key últimos 5 chars:", apiKey.substring(apiKey.length - 5));
          
          // ✅ SOLO configure() - NO llamar getCustomerInfo() aquí
          // getCustomerInfo() con ID anónimo dispara requests que fallan con "Invalid API Key"
          // La identificación del usuario (logIn) se hace en AuthContext.tsx después del login
          await Purchases.configure({
            apiKey: apiKey,
          });
          
          console.log("[RevenueCat] ✅ Purchases.configure() OK - SDK listo");
          console.log("[RevenueCat] ⏳ Esperando identificación del usuario en AuthContext...");
          
          // ❌ NO llamar getCustomerInfo() aquí - causa requests con $RCAnonymousID que fallan
          // ❌ NO llamar logIn() aquí - AuthContext maneja la identificación después de la sesión
          
        } catch (revenueCatError: any) {
          console.error("[RevenueCat] ❌ Error en Purchases.configure():");
          console.error("[RevenueCat] message:", revenueCatError?.message);
          console.error("[RevenueCat] code:", revenueCatError?.code);
          console.error("[RevenueCat] underlying:", revenueCatError?.underlyingErrorMessage);
        }
      }

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
