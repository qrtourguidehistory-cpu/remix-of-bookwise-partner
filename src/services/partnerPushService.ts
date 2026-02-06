import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';

// Flag para evitar múltiples inicializaciones
let listenerInitialized = false;

/**
 * Determina el rol del usuario basándose en si tiene business_id
 * @param userId - ID del usuario
 * @returns 'partner' si tiene business_id, 'client' si no
 */
const determineUserRole = async (userId: string): Promise<'partner' | 'client'> => {
  try {
    // Buscar si el usuario tiene un business (como owner)
    const { data: business } = await supabase
      .from('businesses')
      .select('id')
      .eq('owner_id', userId)
      .maybeSingle();
    
    if (business) {
      console.log('[PushService] ✅ Usuario es PARTNER (tiene business)');
      return 'partner';
    }
    
    // También verificar en profiles por business_id
    const { data: profile } = await supabase
      .from('profiles')
      .select('business_id')
      .eq('id', userId)
      .maybeSingle();
    
    if (profile?.business_id) {
      console.log('[PushService] ✅ Usuario es PARTNER (profile.business_id existe)');
      return 'partner';
    }
    
    console.log('[PushService] ✅ Usuario es CLIENT (no tiene business)');
    return 'client';
  } catch (error) {
    console.error('[PushService] Error determinando rol, usando client por defecto:', error);
    return 'client';
  }
};

export const initializePartnerPush = async (userId: string) => {
  console.log('[PushService] 🚀 START - User:', userId);

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
      console.log('[PushService] ✅ Canal Android creado');
    }

    // Permisos
    console.log('[PushService] 🔐 Solicitando permisos...');
    const result = await PushNotifications.requestPermissions();
    if (result.receive !== 'granted') {
      console.warn('[PushService] ⚠️ Permisos no otorgados');
      return;
    }
    console.log('[PushService] ✅ Permisos otorgados');

    // ✅ CRÍTICO: Verificar y actualizar tokens existentes con rol incorrecto
    // Esto asegura que si el usuario cambió de rol (ej: creó un business), el token se actualice
    try {
      const currentRole = await determineUserRole(userId);
      console.log('[PushService] 🔍 Verificando tokens existentes con rol:', currentRole);
      
      // Buscar todos los tokens activos del usuario
      const { data: existingDevices } = await supabase
        .from('client_devices' as any)
        .select('id, fcm_token, role, is_active, enabled')
        .eq('user_id', userId)
        .eq('is_active', true)
        .eq('enabled', true);
      
      if (existingDevices && existingDevices.length > 0) {
        console.log(`[PushService] 📱 Encontrados ${existingDevices.length} dispositivo(s) activo(s)`);
        
        // Actualizar el rol de todos los dispositivos activos si es diferente
        for (const device of existingDevices) {
          if (device.role !== currentRole) {
            console.log(`[PushService] 🔄 Actualizando rol de dispositivo ${device.id} de '${device.role}' a '${currentRole}'`);
            await supabase
              .from('client_devices' as any)
              .update({ role: currentRole })
              .eq('id', device.id);
          }
        }
      }
    } catch (error) {
      console.error('[PushService] ⚠️ Error verificando tokens existentes (no crítico):', error);
      // Continuar con el registro aunque falle la verificación
    }

    // Registrar
    console.log('[PushService] 📝 Registrando para notificaciones push...');
    await PushNotifications.register();
    console.log('[PushService] ✅ Registro completado, esperando token FCM...');

    // Token registration with FCM token deduplication
    // ✅ CRÍTICO: Determinar el rol cada vez que se recibe un token
    // Esto asegura que si el usuario cambia de rol (ej: crea un business), el token se actualice
    await PushNotifications.addListener('registration', async (token) => {
      console.log('[PushService] 🎫 Token FCM recibido:', token.value.substring(0, 20) + '...');
      
      // Determinar rol en tiempo real (puede haber cambiado desde la última vez)
      const userRole = await determineUserRole(userId);
      console.log('[PushService] 📋 Rol detectado al recibir token:', userRole);
      
      const platform = Capacitor.getPlatform() === 'ios' ? 'ios' : 'android';
      
      // PASO 1: Eliminar este token de CUALQUIER otro usuario (limpieza de duplicados)
      console.log('[PushService] 🧹 Limpiando duplicados del token...');
      await supabase
        .from('client_devices' as any)
        .delete()
        .eq('fcm_token', token.value)
        .neq('user_id', userId);
      
      // PASO 2: Upsert usando fcm_token como clave de conflicto
      console.log('[PushService] 💾 Guardando token con role:', userRole);
      const { error } = await supabase
        .from('client_devices' as any)
        .upsert(
          {
            user_id: userId,
            role: userRole, // ✅ CRÍTICO: Usar el rol detectado en tiempo real (partner o client)
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
        console.error('[PushService] ❌ Error registrando token:', error);
      } else {
        console.log(`[PushService] ✅ Token registrado correctamente para user: ${userId}, role: ${userRole}`);
      }
    });

    // Errores
    await PushNotifications.addListener('registrationError', (error) => {
      console.error('[PushService] ❌ Registration error:', error);
    });

    // Foreground
    await PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('[PushService] 📥 Foreground notification:', notification);
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
      
      console.log('[PushService] ✅ Listener inicializado');
    }
  } catch (error) {
    console.error('[PushService] ❌ FATAL ERROR:', error);
  }
};

export const cleanupPartnerPush = async () => {
  try {
    await PushNotifications.removeAllListeners();
    console.log('[PushService] 🧹 Listeners removidos');
  } catch (e) {
    console.error('[PushService] ❌ Cleanup error:', e);
  }
};

