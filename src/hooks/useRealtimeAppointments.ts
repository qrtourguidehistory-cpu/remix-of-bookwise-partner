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

    const channel = supabase
      .channel('partner-appointments')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'appointments',
          filter: `business_id=eq.${profile.business_id}`
        },
        () => {
          toast.success('¡Nueva cita recibida!', {
            description: 'Un cliente ha reservado una cita'
          });
          callbackRef.current?.();
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
        () => {
          callbackRef.current?.();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.business_id]);
}
