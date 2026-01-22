import { useState, useEffect } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

interface UseMapboxOptions {
  accessToken: string;
}

interface UseMapboxReturn {
  isLoaded: boolean;
  loadError: Error | null;
  mapboxgl: typeof mapboxgl | null;
}

/**
 * Hook personalizado para inicializar Mapbox GL JS
 * 
 * @param options - Configuración del hook (access token)
 * @returns Estado de carga, errores y objeto mapboxgl
 * 
 * @example
 * ```tsx
 * const { isLoaded, loadError, mapboxgl } = useMapbox({
 *   accessToken: import.meta.env.VITE_MAPBOX_ACCESS_TOKEN
 * });
 * 
 * if (loadError) return <div>Error loading map</div>;
 * if (!isLoaded) return <div>Loading map...</div>;
 * 
 * // Usar mapboxgl.Map, mapboxgl.Marker, etc.
 * ```
 */
export function useMapbox(options: UseMapboxOptions): UseMapboxReturn {
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState<Error | null>(null);

  useEffect(() => {
    try {
      // Si no hay token o es un token dummy, no inicializar Mapbox
      if (!options.accessToken || options.accessToken === 'dummy-token') {
        setIsLoaded(false);
        return;
      }

      // Configurar el token de acceso
      mapboxgl.accessToken = options.accessToken;

      // Marcar como cargado
      setIsLoaded(true);
    } catch (error) {
      console.error('Error initializing Mapbox:', error);
      setLoadError(error as Error);
      setIsLoaded(false);
    }
  }, [options.accessToken]);

  return { 
    isLoaded, 
    loadError, 
    mapboxgl: isLoaded ? mapboxgl : null 
  };
}

