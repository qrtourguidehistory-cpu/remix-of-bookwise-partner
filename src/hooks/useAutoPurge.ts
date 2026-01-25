import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Hook para auto-purga de estado cuando se cierra un modal o se cambia de sección
 * Libera memoria de arreglos de datos pesados que ya no están en vista
 */
export function useAutoPurge(
  purgeCallback: () => void,
  dependencies: any[] = []
) {
  const locationRef = useRef<string>('');
  const location = useLocation();

  useEffect(() => {
    // Si cambió la ruta, ejecutar purga
    if (locationRef.current && locationRef.current !== location.pathname) {
      purgeCallback();
    }
    locationRef.current = location.pathname;
  }, [location.pathname, purgeCallback]);

  // Ejecutar purga cuando cambian las dependencias (ej: cuando se cierra un modal)
  useEffect(() => {
    return () => {
      // Cleanup: purgar al desmontar
      purgeCallback();
    };
  }, dependencies);
}

/**
 * Hook especializado para purgar datos de citas al cambiar de vista
 */
export function useAppointmentPurge(
  setAppointments: (data: any[]) => void,
  view: string
) {
  const previousViewRef = useRef<string>('');

  useEffect(() => {
    // Si cambió la vista y no es la primera vez, purgar datos de la vista anterior
    if (previousViewRef.current && previousViewRef.current !== view) {
      // Pequeño delay para permitir que la nueva vista cargue primero
      const timer = setTimeout(() => {
        setAppointments([]);
      }, 100);
      return () => clearTimeout(timer);
    }
    previousViewRef.current = view;
  }, [view, setAppointments]);
}

