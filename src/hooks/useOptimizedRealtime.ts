import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { RealtimeChannel } from '@supabase/supabase-js';

interface RealtimeConfig {
  table: string;
  filter?: string;
  events?: ('INSERT' | 'UPDATE' | 'DELETE')[];
  onEvent?: (payload: any) => void;
  enabled?: boolean;
}

/**
 * Hook optimizado para realtime subscriptions que:
 * - Solo se activa cuando es necesario
 * - Se limpia automáticamente al desmontar o cuando se deshabilita
 * - Previene múltiples suscripciones duplicadas
 * - Gestiona memoria eficientemente
 */
export function useOptimizedRealtime(config: RealtimeConfig) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const isSubscribedRef = useRef(false);
  const callbackRef = useRef(config.onEvent);

  // Mantener callback actualizado
  useEffect(() => {
    callbackRef.current = config.onEvent;
  }, [config.onEvent]);

  useEffect(() => {
    // No suscribirse si está deshabilitado o no hay configuración válida
    if (config.enabled === false || !config.table) {
      // Limpiar suscripción existente si se deshabilita
      if (channelRef.current && isSubscribedRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
        isSubscribedRef.current = false;
      }
      return;
    }

    // Evitar suscripciones duplicadas
    if (isSubscribedRef.current && channelRef.current) {
      return;
    }

    // Crear nombre único para el canal
    const channelName = `optimized-${config.table}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: config.events?.[0] || '*',
          schema: 'public',
          table: config.table,
          filter: config.filter,
        },
        (payload) => {
          if (callbackRef.current) {
            // ✅ ETAPA 1 FIX: Agregar eventType al payload para facilitar verificación
            const enrichedPayload = {
              ...payload,
              eventType: config.events?.[0] || '*',
            };
            callbackRef.current(enrichedPayload);
          }
        }
      );

    // Suscribirse solo si hay eventos configurados
    if (config.events && config.events.length > 0) {
      // Agregar listeners adicionales si hay múltiples eventos
      config.events.slice(1).forEach((event) => {
        channel.on(
          'postgres_changes',
          {
            event,
            schema: 'public',
            table: config.table,
            filter: config.filter,
          },
          (payload) => {
            if (callbackRef.current) {
              // ✅ ETAPA 1 FIX: Agregar eventType al payload para facilitar verificación
              const enrichedPayload = {
                ...payload,
                eventType: event,
              };
              callbackRef.current(enrichedPayload);
            }
          }
        );
      });
    }

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        isSubscribedRef.current = true;
        channelRef.current = channel;
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.error(`[useOptimizedRealtime] Error en canal ${channelName}:`, status);
        isSubscribedRef.current = false;
        channelRef.current = null;
      }
    });

    // Cleanup: desuscribirse automáticamente al desmontar o cuando cambia la configuración
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
        isSubscribedRef.current = false;
      }
    };
  }, [config.table, config.filter, config.enabled, config.events?.join(',')]);

  // Función para desuscribirse manualmente si es necesario
  const unsubscribe = useCallback(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
      isSubscribedRef.current = false;
    }
  }, []);

  return { unsubscribe };
}

/**
 * Hook especializado para suscripciones de citas optimizadas
 */
export function useOptimizedAppointmentsRealtime(
  businessId: string | undefined,
  onUpdate?: () => void,
  enabled: boolean = true
) {
  return useOptimizedRealtime({
    table: 'appointments',
    filter: businessId ? `business_id=eq.${businessId}` : undefined,
    events: ['INSERT', 'UPDATE', 'DELETE'],
    onEvent: (payload) => {
      console.log('🔔 Cambio detectado en tiempo real:', payload);
      if (onUpdate) {
        // ✅ Delay aumentado a 800ms para asegurar que la base de datos complete la transacción
        // Esto es especialmente importante cuando el cliente cancela desde otra app
        // ✅ ETAPA 1 FIX: Pasar el payload completo al callback para que pueda verificar fechas
        setTimeout(() => {
          onUpdate(payload);
        }, 800);
      }
    },
    enabled: enabled && !!businessId,
  });
}

/**
 * Hook especializado para suscripciones de ventas optimizadas
 */
export function useOptimizedSalesRealtime(
  businessId: string | undefined,
  onUpdate?: () => void,
  enabled: boolean = true
) {
  return useOptimizedRealtime({
    table: 'sales',
    filter: businessId ? `business_id=eq.${businessId}` : undefined,
    events: ['INSERT', 'UPDATE'],
    onEvent: () => {
      if (onUpdate) {
        setTimeout(() => {
          onUpdate();
        }, 100);
      }
    },
    enabled: enabled && !!businessId,
  });
}

