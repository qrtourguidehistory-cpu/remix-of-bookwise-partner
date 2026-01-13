import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Hook para suscribirse a cambios en tiempo real de staff_early_departures
 * Actualiza automáticamente cuando se agregan, modifican o eliminan salidas anticipadas
 */
export function useRealtimeEarlyDepartures(onChange?: () => void) {
  const { profile } = useAuth();
  const callbackRef = useRef(onChange);

  // Keep callback ref updated
  useEffect(() => {
    callbackRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!profile?.business_id) return;

    // Create a unique channel name to avoid conflicts
    const channelName = `early-departures-${profile.business_id}-${Date.now()}`;
    
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'staff_early_departures',
          filter: `business_id=eq.${profile.business_id}`
        },
        (payload) => {
          console.log('🚪 Nueva salida anticipada INSERT:', payload.new);
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
          table: 'staff_early_departures',
          filter: `business_id=eq.${profile.business_id}`
        },
        (payload) => {
          console.log('🚪 Salida anticipada UPDATE:', payload.new);
          setTimeout(() => {
            callbackRef.current?.();
          }, 100);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'staff_early_departures',
          filter: `business_id=eq.${profile.business_id}`
        },
        (payload) => {
          console.log('🚪 Salida anticipada DELETE:', payload.old);
          setTimeout(() => {
            callbackRef.current?.();
          }, 100);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.business_id]);
}

