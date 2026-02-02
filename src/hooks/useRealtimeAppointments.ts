import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// Global flag to prevent duplicate toast notifications
let lastNotificationTime = 0;
const NOTIFICATION_DEBOUNCE_MS = 2000; // 2 seconds

function showNotificationOnce(message: string, description?: string) {
  const now = Date.now();
  if (now - lastNotificationTime > NOTIFICATION_DEBOUNCE_MS) {
    lastNotificationTime = now;
    toast.success(message, {
      description,
      id: 'new-appointment-notification' // Fixed ID - Sonner will replace instead of duplicate
    });
  }
}

export function useRealtimeAppointments(onNewAppointment?: () => void) {
  const { profile } = useAuth();
  const callbackRef = useRef(onNewAppointment);

  // Keep callback ref updated
  useEffect(() => {
    callbackRef.current = onNewAppointment;
  }, [onNewAppointment]);

  useEffect(() => {
    if (!profile?.business_id) return;

    // Create a unique channel name to avoid conflicts
    const channelName = `partner-appointments-${profile.business_id}-${Date.now()}`;
    
    console.log(`🔌 [REALTIME] Iniciando suscripción para business_id: ${profile.business_id}`);
    
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'appointments',
          filter: `business_id=eq.${profile.business_id}`
        },
        (payload) => {
          console.log('🔔 Cambio detectado en tiempo real (INSERT):', payload.new);
          console.log('📅 Nueva cita INSERT:', payload.new);
          // Show notification only once even if multiple components are subscribed
          showNotificationOnce('¡Nueva cita recibida!', 'Un cliente ha reservado una cita');
          // ✅ Delay aumentado a 800ms para asegurar que la base de datos complete la transacción
          setTimeout(() => {
            if (callbackRef.current) {
              callbackRef.current();
            }
          }, 800);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'appointments',
          filter: `business_id=eq.${profile.business_id}`
        },
        (payload) => {
          console.log('🔔 Cambio detectado en tiempo real (UPDATE):', payload.new);
          console.log('📅 Cita UPDATE:', payload.new);
          // ✅ Delay aumentado a 800ms para asegurar que la base de datos complete la transacción
          // Always refresh on any update - fetchAppointments will filter by date
          // This ensures the calendar view updates in real-time
          // Don't show toast for updates - let the component handle it if needed
          setTimeout(() => {
            if (callbackRef.current) {
              callbackRef.current();
            }
          }, 800);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'appointments',
          filter: `business_id=eq.${profile.business_id}`
        },
        (payload) => {
          console.log('🔔 Cambio detectado en tiempo real (DELETE):', payload.old);
          console.log('📅 Cita DELETE:', payload.old);
          // ✅ Delay aumentado a 800ms para asegurar que la base de datos complete la transacción
          // Always refresh on delete - fetchAppointments will filter by date
          setTimeout(() => {
            if (callbackRef.current) {
              callbackRef.current();
            }
          }, 800);
        }
      )
      .subscribe((status) => {
        console.log(`📡 [REALTIME] Estado de suscripción: ${status}`);
        if (status === 'SUBSCRIBED') {
          console.log('✅ Suscrito a cambios de citas en tiempo real');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Error al suscribirse a cambios de citas');
        } else if (status === 'TIMED_OUT') {
          console.error('⏱️ Timeout al suscribirse a cambios de citas');
        } else if (status === 'CLOSED') {
          console.warn('⚠️ Canal cerrado');
        }
      });

    return () => {
      console.log('🔌 Desconectando canal de tiempo real');
      supabase.removeChannel(channel);
    };
  }, [profile?.business_id]);
}
