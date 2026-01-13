import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

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
          console.log('📅 Nueva cita INSERT:', payload.new);
          toast.success('¡Nueva cita recibida!', {
            description: 'Un cliente ha reservado una cita'
          });
          // Small delay to ensure database is ready
          setTimeout(() => {
            callbackRef.current?.();
          }, 100);
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
          console.log('📅 Cita UPDATE:', payload.new);
          // Check if status, time, or date changed
          const oldData = payload.old as any;
          const newData = payload.new as any;
          
          const statusChanged = oldData?.status !== newData?.status;
          const timeChanged = oldData?.start_time !== newData?.start_time || 
                            oldData?.end_time !== newData?.end_time;
          const dateChanged = oldData?.appointment_date !== newData?.appointment_date;
          
          if (statusChanged || timeChanged || dateChanged) {
            // Small delay to ensure database is ready
            setTimeout(() => {
              callbackRef.current?.();
            }, 100);
          }
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
          console.log('📅 Cita DELETE:', payload.old);
          // Small delay to ensure UI updates
          setTimeout(() => {
            callbackRef.current?.();
          }, 100);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Suscrito a cambios de citas en tiempo real');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Error al suscribirse a cambios de citas');
        }
      });

    return () => {
      console.log('🔌 Desconectando canal de tiempo real');
      supabase.removeChannel(channel);
    };
  }, [profile?.business_id]);
}
