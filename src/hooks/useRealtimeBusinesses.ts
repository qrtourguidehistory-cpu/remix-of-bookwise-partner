import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';

/**
 * Hook para escuchar cambios en tiempo real en la tabla businesses
 * Especialmente útil para detectar cambios en is_public
 * 
 * @param onBusinessChange - Callback que se ejecuta cuando hay cambios en negocios
 * @param filters - Filtros opcionales para la suscripción (ej: is_public=true)
 */
export function useRealtimeBusinesses(
  onBusinessChange?: () => void,
  filters?: {
    is_public?: boolean;
    is_active?: boolean;
    approval_status?: string;
  }
) {
  const callbackRef = useRef(onBusinessChange);

  // Keep callback ref updated
  useEffect(() => {
    callbackRef.current = onBusinessChange;
  }, [onBusinessChange]);

  useEffect(() => {
    // Crear un nombre de canal único
    const channelName = `businesses-realtime-${Date.now()}`;
    
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'businesses',
        },
        (payload) => {
          console.log('🏢 [RealtimeBusinesses] Cambio detectado en businesses:', payload);
          
          // Verificar si el cambio afecta los filtros
          const newRecord = payload.new as any;
          const oldRecord = payload.old as any;
          
          // Si hay filtros, verificar si el cambio es relevante
          if (filters) {
            let isRelevant = false;
            
            // Verificar si is_public cambió
            if (filters.is_public !== undefined) {
              const wasPublic = oldRecord?.is_public === filters.is_public;
              const isNowPublic = newRecord?.is_public === filters.is_public;
              
              // Si cambió de estado (de false a true o viceversa), es relevante
              // Esto incluye cuando un negocio se vuelve público o deja de serlo
              if (wasPublic !== isNowPublic) {
                isRelevant = true;
                console.log(`🏢 [RealtimeBusinesses] is_public cambió: ${wasPublic} → ${isNowPublic}`);
              }
            }
            
            // Verificar si is_active cambió
            if (filters.is_active !== undefined) {
              const wasActive = oldRecord?.is_active === filters.is_active;
              const isNowActive = newRecord?.is_active === filters.is_active;
              
              // Si cambió de estado, es relevante
              if (wasActive !== isNowActive) {
                isRelevant = true;
                console.log(`🏢 [RealtimeBusinesses] is_active cambió: ${wasActive} → ${isNowActive}`);
              }
            }
            
            // Verificar si approval_status cambió
            if (filters.approval_status !== undefined) {
              const wasApproved = oldRecord?.approval_status === filters.approval_status;
              const isNowApproved = newRecord?.approval_status === filters.approval_status;
              
              // Si cambió de estado, es relevante
              if (wasApproved !== isNowApproved) {
                isRelevant = true;
                console.log(`🏢 [RealtimeBusinesses] approval_status cambió: ${wasApproved} → ${isNowApproved}`);
              }
            }
            
            // Si no hay filtros específicos o el cambio es relevante, ejecutar callback
            if (!isRelevant && Object.keys(filters).length > 0) {
              console.log('🏢 [RealtimeBusinesses] Cambio no relevante para los filtros, ignorando');
              return;
            }
          }
          
          // Ejecutar callback con un pequeño delay para asegurar que la BD esté lista
          setTimeout(() => {
            if (callbackRef.current) {
              console.log('🏢 [RealtimeBusinesses] Ejecutando callback de actualización');
              callbackRef.current();
            }
          }, 200);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'businesses',
        },
        (payload) => {
          console.log('🏢 [RealtimeBusinesses] Nuevo negocio insertado:', payload);
          
          // Verificar si el nuevo negocio cumple con los filtros
          if (filters) {
            const newRecord = payload.new as any;
            
            let matchesFilters = true;
            
            if (filters.is_public !== undefined && newRecord?.is_public !== filters.is_public) {
              matchesFilters = false;
            }
            
            if (filters.is_active !== undefined && newRecord?.is_active !== filters.is_active) {
              matchesFilters = false;
            }
            
            if (filters.approval_status !== undefined && newRecord?.approval_status !== filters.approval_status) {
              matchesFilters = false;
            }
            
            if (!matchesFilters) {
              console.log('🏢 [RealtimeBusinesses] Nuevo negocio no cumple con los filtros, ignorando');
              return;
            }
          }
          
          // Ejecutar callback
          setTimeout(() => {
            if (callbackRef.current) {
              console.log('🏢 [RealtimeBusinesses] Ejecutando callback para nuevo negocio');
              callbackRef.current();
            }
          }, 200);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ [RealtimeBusinesses] Suscrito correctamente a cambios en businesses');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ [RealtimeBusinesses] Error en canal de real-time');
        }
      });

    return () => {
      console.log('🧹 [RealtimeBusinesses] Limpiando suscripción');
      supabase.removeChannel(channel);
    };
  }, [filters]);
}

