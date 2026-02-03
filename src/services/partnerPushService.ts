import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';

// Flag para evitar múltiples inicializaciones
let listenerInitialized = false;

export const initializePartnerPush = async (userId: string) => {
  console.log('[PartnerPush] START - User:', userId);

  const isNative = Capacitor.isNativePlatform();

  // WEB: Solo solicitar permisos
  if (!isNative) {
    if ('Notification' in window) {
      await Notification.requestPermission();
    }
    return;
  }

  // NATIVE: Flujo completo
  try {
    // Android channel
    if (Capacitor.getPlatform() === 'android') {
      await PushNotifications.createChannel({
        id: 'default',
        name: 'Default',
        importance: 5,
        visibility: 1,
        lights: true,
        vibration: true,
        sound: 'default'
      });
    }

    // Permisos
    const result = await PushNotifications.requestPermissions();
    if (result.receive !== 'granted') {
      return;
    }

    // Registrar
    await PushNotifications.register();

    // Token registration with FCM token deduplication
    await PushNotifications.addListener('registration', async (token) => {
      const platform = Capacitor.getPlatform() === 'ios' ? 'ios' : 'android';
      
      // PASO 1: Eliminar este token de CUALQUIER otro usuario (limpieza de duplicados)
      await supabase
        .from('client_devices' as any)
        .delete()
        .eq('fcm_token', token.value)
        .neq('user_id', userId);
      
      // PASO 2: Upsert usando fcm_token como clave de conflicto
      const { error } = await supabase
        .from('client_devices' as any)
        .upsert(
          {
            user_id: userId,
            role: 'partner',
            platform: platform,
            fcm_token: token.value,
            is_active: true,
            enabled: true,
            device_info: { device: platform, ts: new Date().toISOString() }
          },
          { 
            onConflict: 'fcm_token',
            ignoreDuplicates: false 
          }
        );
        
      if (error) {
        console.error('[PartnerPush] Error registrando token:', error);
      } else {
        console.log('[PartnerPush] ✅ Token registrado correctamente para user:', userId);
      }
    });

    // Errores
    await PushNotifications.addListener('registrationError', (error) => {
      console.error('[PartnerPush] Registration error:', error);
    });

    // Foreground
    await PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('[PartnerPush] Foreground notification:', notification);
    });

    // ✅ LISTENER DE CLIC: Solo una vez, estructura mínima
    if (!listenerInitialized) {
      listenerInitialized = true;
      
      await PushNotifications.addListener('pushNotificationActionPerformed', async (action) => {
        try {
          const notification = action.notification;
          const data = notification?.data || {};
          
          // Extraer IDs
          const appointmentId = data?.appointment_id || data?.appointmentId || data?.meta?.appointment_id;
          const notificationId = data?.notification_id || data?.notificationId || data?.id || notification?.id;
          const appointmentDate = data?.appointment_date || data?.meta?.appointment_date;
          
          console.log('[PartnerPush] LOG A: Notificación tocada (ID:', notificationId, ')');
          
          // ✅ MARCAR COMO LEÍDA: Directo, sin await (no bloquea)
          if (notificationId) {
            console.log('[PartnerPush] LOG C: Marcando leída en BD...');
            supabase
              .from('notifications')
              .update({ read: true })
              .eq('id', notificationId)
              .then(({ error }) => {
                if (error) {
                  // Fallback
                  supabase
                    .from('client_notifications')
                    .update({ read: true })
                    .eq('id', notificationId);
                } else {
                  // Actualizar UI
                  window.dispatchEvent(new CustomEvent('notificationRead', {
                    detail: { notificationId }
                  }));
                }
              })
              .catch(() => {
                // Ignorar errores
              });
          }
          
          // ✅ NAVEGACIÓN: Solo si tiene appointment_id (sin causar refrescos)
          if (appointmentId) {
            console.log('[PartnerPush] LOG B: Navegando a cita', appointmentId, 'fecha:', appointmentDate || 'N/A');
            
            // Emitir evento de navegación (Event Bus) - usa openAppointmentDetail para consistencia
            // MobileCalendar escucha este evento y maneja la navegación sin refrescos
            window.dispatchEvent(new CustomEvent('openAppointmentDetail', {
              detail: {
                appointmentId: appointmentId,
                appointmentDate: appointmentDate
              }
            }));
            
            // También emitir ROUTING_REQUEST para compatibilidad (si es necesario navegar primero)
            const currentPath = window.location.pathname;
            if (currentPath !== '/mobile/calendar') {
              window.dispatchEvent(new CustomEvent('ROUTING_REQUEST', {
                detail: {
                  path: '/mobile/calendar',
                  appointmentId: appointmentId,
                  appointmentDate: appointmentDate
                }
              }));
            }
          }
        } catch (error) {
          console.error('[PartnerPush] Error:', error);
          // NO re-lanzar para evitar refresh
        }
      });
      
      console.log('[PartnerPush] ✅ Listener inicializado');
    }
  } catch (error) {
    console.error('[PartnerPush] FATAL ERROR:', error);
  }
};

export const cleanupPartnerPush = async () => {
  try {
    await PushNotifications.removeAllListeners();
  } catch (e) {
    console.error('[PartnerPush] Cleanup error:', e);
  }
};

