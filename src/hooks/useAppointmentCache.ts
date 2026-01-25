import { useRef, useCallback } from 'react';
import { format, startOfWeek, addDays, startOfMonth, endOfMonth } from 'date-fns';

interface CacheEntry {
  data: any[];
  timestamp: number;
  filters: string; // Serialized filters
}

interface CacheKey {
  view: 'day' | 'week' | 'month';
  dateKey: string;
  filtersKey: string;
}

// Cache TTL: 5 minutes
const CACHE_TTL = 5 * 60 * 1000;

/**
 * Hook para cachear consultas de citas por vista (día/semana/mes)
 * Permite carga instantánea al cambiar entre vistas si los datos ya fueron consultados
 */
export function useAppointmentCache() {
  const cacheRef = useRef<Map<string, CacheEntry>>(new Map());

  /**
   * Genera una clave única para el caché basada en la vista y fecha
   */
  const generateCacheKey = useCallback((view: 'day' | 'week' | 'month', date: Date, filters: any): string => {
    let dateKey: string;
    
    switch (view) {
      case 'day':
        dateKey = format(date, 'yyyy-MM-dd');
        break;
      case 'week':
        const weekStart = startOfWeek(date, { weekStartsOn: 1 });
        dateKey = format(weekStart, 'yyyy-MM-dd');
        break;
      case 'month':
        const monthStart = startOfMonth(date);
        dateKey = format(monthStart, 'yyyy-MM');
        break;
      default:
        dateKey = format(date, 'yyyy-MM-dd');
    }

    // Serializar filtros para incluir en la clave
    const filtersKey = JSON.stringify({
      statuses: filters?.statuses || [],
      staffIds: filters?.staffIds || [],
      serviceIds: filters?.serviceIds || [],
      searchQuery: filters?.searchQuery || '',
    });

    return `${view}:${dateKey}:${filtersKey}`;
  }, []);

  /**
   * Obtiene datos del caché si están disponibles y no han expirado
   */
  const getCached = useCallback((key: string): any[] | null => {
    const entry = cacheRef.current.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > CACHE_TTL) {
      // Cache expirado, eliminar
      cacheRef.current.delete(key);
      return null;
    }

    return entry.data;
  }, []);

  /**
   * Guarda datos en el caché
   */
  const setCached = useCallback((key: string, data: any[], filters: any) => {
    cacheRef.current.set(key, {
      data,
      timestamp: Date.now(),
      filters: JSON.stringify(filters),
    });
  }, []);

  /**
   * Limpia el caché (útil cuando se actualiza una cita manualmente)
   */
  const invalidateCache = useCallback((view?: 'day' | 'week' | 'month') => {
    if (view) {
      // Invalidar solo para una vista específica
      const keysToDelete: string[] = [];
      cacheRef.current.forEach((_, key) => {
        if (key.startsWith(`${view}:`)) {
          keysToDelete.push(key);
        }
      });
      keysToDelete.forEach(key => cacheRef.current.delete(key));
    } else {
      // Limpiar todo el caché
      cacheRef.current.clear();
    }
  }, []);

  /**
   * Limpia entradas expiradas del caché
   */
  const cleanExpired = useCallback(() => {
    const now = Date.now();
    const keysToDelete: string[] = [];
    
    cacheRef.current.forEach((entry, key) => {
      if (now - entry.timestamp > CACHE_TTL) {
        keysToDelete.push(key);
      }
    });
    
    keysToDelete.forEach(key => cacheRef.current.delete(key));
  }, []);

  /**
   * Obtiene el rango de fechas para una vista específica
   */
  const getDateRange = useCallback((view: 'day' | 'week' | 'month', date: Date) => {
    switch (view) {
      case 'day':
        return {
          start: format(date, 'yyyy-MM-dd'),
          end: format(addDays(date, 1), 'yyyy-MM-dd'),
        };
      case 'week':
        const weekStart = startOfWeek(date, { weekStartsOn: 1 });
        return {
          start: format(weekStart, 'yyyy-MM-dd'),
          end: format(addDays(weekStart, 7), 'yyyy-MM-dd'),
        };
      case 'month':
        const monthStart = startOfMonth(date);
        const monthEnd = endOfMonth(date);
        return {
          start: format(monthStart, 'yyyy-MM-dd'),
          end: format(addDays(monthEnd, 1), 'yyyy-MM-dd'),
        };
      default:
        return {
          start: format(date, 'yyyy-MM-dd'),
          end: format(addDays(date, 1), 'yyyy-MM-dd'),
        };
    }
  }, []);

  return {
    generateCacheKey,
    getCached,
    setCached,
    invalidateCache,
    cleanExpired,
    getDateRange,
  };
}

