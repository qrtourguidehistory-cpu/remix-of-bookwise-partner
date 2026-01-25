import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface OptimizedImageProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  fallback?: string;
  cacheKey?: string;
}

/**
 * Componente optimizado para carga de imágenes con caché
 * Evita descargas repetitivas desde Supabase Storage
 */
export function OptimizedImage({ 
  src, 
  alt, 
  className = '', 
  fallback = '/placeholder-image.png',
  cacheKey 
}: OptimizedImageProps) {
  const [imageSrc, setImageSrc] = useState<string>(fallback);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const cacheRef = useRef<Map<string, string>>(new Map());
  const loadingRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!src) {
      setImageSrc(fallback);
      setLoading(false);
      return;
    }

    // Verificar si es una URL de Supabase Storage
    const isSupabaseUrl = src.includes('supabase.co') || src.includes('storage.googleapis.com');
    
    if (!isSupabaseUrl) {
      // URL externa, usar directamente
      setImageSrc(src);
      setLoading(false);
      return;
    }

    // Generar clave de caché
    const key = cacheKey || src;
    
    // Verificar caché en memoria
    if (cacheRef.current.has(key)) {
      setImageSrc(cacheRef.current.get(key)!);
      setLoading(false);
      return;
    }

    // Verificar si ya está cargando
    if (loadingRef.current.has(key)) {
      return;
    }

    // Cargar imagen
    loadingRef.current.add(key);
    setLoading(true);
    setError(false);

    const img = new Image();
    
    img.onload = () => {
      // Guardar en caché
      cacheRef.current.set(key, src);
      setImageSrc(src);
      setLoading(false);
      loadingRef.current.delete(key);
    };

    img.onerror = () => {
      setImageSrc(fallback);
      setError(true);
      setLoading(false);
      loadingRef.current.delete(key);
    };

    // Si es URL de Supabase, obtener URL pública
    if (isSupabaseUrl) {
      // Extraer path del bucket si es necesario
      const urlParts = src.split('/');
      const bucketIndex = urlParts.findIndex(part => part.includes('storage'));
      
      if (bucketIndex !== -1 && bucketIndex < urlParts.length - 1) {
        // Intentar obtener URL pública optimizada
        const { data } = supabase.storage
          .from(urlParts[bucketIndex + 1])
          .getPublicUrl(urlParts.slice(bucketIndex + 2).join('/'));
        
        img.src = data.publicUrl;
      } else {
        img.src = src;
      }
    } else {
      img.src = src;
    }

    // Limpiar caché después de 10 minutos para evitar memory leaks
    const cleanup = setTimeout(() => {
      if (cacheRef.current.size > 50) {
        // Limpiar las entradas más antiguas (mantener solo las 30 más recientes)
        const entries = Array.from(cacheRef.current.entries());
        cacheRef.current.clear();
        entries.slice(-30).forEach(([k, v]) => cacheRef.current.set(k, v));
      }
    }, 10 * 60 * 1000);

    return () => {
      clearTimeout(cleanup);
      img.onload = null;
      img.onerror = null;
    };
  }, [src, fallback, cacheKey]);

  return (
    <img
      src={imageSrc}
      alt={alt}
      className={className}
      style={{
        opacity: loading ? 0.5 : 1,
        transition: 'opacity 0.3s ease-in-out',
      }}
      loading="lazy"
    />
  );
}

