import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.miturnow.partner',
  appName: 'Mi Turnow Partner',
  webDir: 'dist',
  server: {
    // Permitir navegación a todos los dominios externos necesarios
    allowNavigation: [
      'https://api.revenuecat.com',
      'https://*.revenuecat.com',
      'https://*.supabase.co',
      'https://*.googleapis.com',
      'https://*.google.com',
    ],
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: true,
      backgroundColor: "#FFFFFF",
      showSpinner: false,
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#FFFFFF',
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    // Desactivar plugins que interfieren con RevenueCat SDK nativo
    CapacitorCookies: {
      enabled: false,
    },
    CapacitorHttp: {
      enabled: false,
    },
  },
  android: {
    buildOptions: {
      keystorePath: undefined,
      keystoreAlias: undefined,
    },
  },
  ios: {
    scheme: 'MiTurnow',
  },
};

export default config;
