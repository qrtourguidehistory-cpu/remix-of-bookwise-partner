import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';

export const initializePartnerPush = async (userId: string) => {
  console.log('[PartnerPush] START - User:', userId);

  if (!Capacitor.isNativePlatform()) {
    console.log('[PartnerPush] Not native, skipping');
    return;
  }

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
    console.log('[PartnerPush] Requesting permissions...');
    const result = await PushNotifications.requestPermissions();
    console.log('[PartnerPush] Permission result:', result.receive);

    if (result.receive !== 'granted') {
      console.log('[PartnerPush] Permission NOT granted, stopping');
      return;
    }

    // Step 3: Register
    console.log('[PartnerPush] Registering...');
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
