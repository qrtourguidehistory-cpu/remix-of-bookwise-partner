import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';

// Callback para navegación - se configura desde el componente que usa el servicio
let navigationCallback: ((path: string) => void) | null = null;

export const setNavigationCallback = (callback: (path: string) => void) => {
  navigationCallback = callback;
  console.log('[PartnerPush] Navigation callback configured');
};

export const initializePartnerPush = async (userId: string) => {
  console.log('[PartnerPush] START - User:', userId);

  const isNative = Capacitor.isNativePlatform();

  // ✅ WEB: Solicitar permisos usando Web Notification API (aunque no se guarde token FCM)
  if (!isNative) {
    console.log('[PartnerPush] Web platform detected, requesting Web Notification permissions...');
    
    if (!('Notification' in window)) {
      console.log('[PartnerPush] Web Notifications not supported in this browser');
      return;
    }

    try {
      // Solicitar permisos de notificaciones web
      const permission = await Notification.requestPermission();
      console.log('[PartnerPush] Web Notification permission:', permission);
      
      if (permission === 'granted') {
        console.log('[PartnerPush] ✅ Web Notification permission granted');
        // En web no guardamos token FCM, las notificaciones se manejan diferente
        // Pero sí solicitamos permisos para mejorar UX
      } else {
        console.log('[PartnerPush] ⚠️ Web Notification permission denied');
      }
    } catch (error) {
      console.error('[PartnerPush] Error requesting web notification permission:', error);
    }
    
    return; // Web no usa FCM, solo solicita permisos
  }

  // ✅ NATIVE: Flujo completo de FCM (Android/iOS)
  try {
    // Step 1: Create channel (Android only)
    if (Capacitor.getPlatform() === 'android') {
      console.log('[PartnerPush] Creating Android channel...');
      await PushNotifications.createChannel({
        id: 'default',
        name: 'Default',
        importance: 5,
        visibility: 1,
        lights: true,
        vibration: true,
        sound: 'default'
      });
      console.log('[PartnerPush] Channel created');
    }

    // Step 2: Request permissions
    console.log('[PartnerPush] Requesting native permissions...');
    const result = await PushNotifications.requestPermissions();
    console.log('[PartnerPush] Permission result:', result.receive);

    if (result.receive !== 'granted') {
      console.log('[PartnerPush] Permission NOT granted, stopping');
      return;
    }

    // Step 3: Register
    console.log('[PartnerPush] Registering for FCM...');
    await PushNotifications.register();
    console.log('[PartnerPush] Register called');

    // Step 4: Listen for token
    await PushNotifications.addListener('registration', async (token) => {
      console.log('[PartnerPush] TOKEN RECEIVED:', token.value);
      
      try {
        const platform = Capacitor.getPlatform() === 'ios' ? 'ios' : 'android';
        
        const { error } = await supabase
          .from('client_devices')
          .upsert({
            user_id: userId,
            role: 'partner',
            platform: platform,
            fcm_token: token.value,
            enabled: true,
            device_info: { device: platform, ts: new Date().toISOString() }
          });

        if (error) {
          console.error('[PartnerPush] Supabase error:', error);
        } else {
          console.log('[PartnerPush] Token saved to Supabase ✓');
        }
      } catch (e) {
        console.error('[PartnerPush] Exception:', e);
      }
    });

    // Step 5: Listen for errors
    await PushNotifications.addListener('registrationError', (error) => {
      console.error('[PartnerPush] Registration error:', error);
    });

    // Step 6: Listen for notifications
    await PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('[PartnerPush] Foreground notification:', notification);
    });

    await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      console.log('[PartnerPush] Notification tapped:', action);
      
      // Extraer datos de la notificación
      const notification = action.notification;
      const data = notification.data;
      
      console.log('[PartnerPush] Notification data:', data);
      
      // 1. Extraemos el ID de la cita que viene de Supabase
      const appointmentId = data?.appointment_id;
      const businessId = data?.business_id;
      const notificationType = data?.type;
      
      console.log('[PartnerPush] Extracted:', {
        appointmentId,
        businessId,
        notificationType
      });
      
      // 2. Si el ID existe y tenemos callback de navegación, navegamos
      if (appointmentId && navigationCallback) {
        console.log('[PartnerPush] Navigating to appointment:', appointmentId);
        // Navegar a la vista de detalles de la cita
        navigationCallback(`/appointments/${appointmentId}`);
      } else if (businessId && navigationCallback) {
        console.log('[PartnerPush] Navigating to business:', businessId);
        // Alternativa: navegar al negocio si no hay appointment_id
        navigationCallback(`/businesses/${businessId}`);
      } else {
        console.log('[PartnerPush] No navigation target or callback not set');
      }
    });

    console.log('[PartnerPush] Initialization COMPLETE');

  } catch (error) {
    console.error('[PartnerPush] FATAL ERROR:', error);
  }
};

export const cleanupPartnerPush = async () => {
  console.log('[PartnerPush] Cleanup');
  try {
    await PushNotifications.removeAllListeners();
  } catch (e) {
    console.error('[PartnerPush] Cleanup error:', e);
  }
};
