// Custom Supabase client using environment variables
// This file overrides the auto-generated client from Lovable Cloud
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

// Debug logging for environment variables
console.log('[Supabase Client] Intentando conectar a:', import.meta.env.VITE_SUPABASE_URL || 'URL no configurada');
console.log('[Supabase Client] Variables disponibles:', {
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL ? '✅ Configurado' : '❌ No configurado',
  VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY ? '✅ Configurado' : '❌ No configurado',
  VITE_SUPABASE_PUBLISHABLE_KEY: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ? '✅ Configurado' : '❌ No configurado',
});

// Get credentials from environment variables with fallback support
// Support both VITE_SUPABASE_ANON_KEY and VITE_SUPABASE_PUBLISHABLE_KEY for compatibility
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 
  (() => {
    console.warn('⚠️ VITE_SUPABASE_URL is not set in environment variables');
    console.warn('⚠️ La aplicación puede no funcionar correctamente sin la URL de Supabase');
    // Return a placeholder instead of throwing to prevent app crash
    return 'https://placeholder.supabase.co';
  })();

const SUPABASE_PUBLISHABLE_KEY = 
  import.meta.env.VITE_SUPABASE_ANON_KEY || 
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 
  (() => {
    console.warn('⚠️ VITE_SUPABASE_ANON_KEY o VITE_SUPABASE_PUBLISHABLE_KEY no están configuradas');
    console.warn('⚠️ La aplicación puede no funcionar correctamente sin la clave de API de Supabase');
    // Return a placeholder instead of throwing to prevent app crash
    return 'placeholder-key';
  })();

// Extract project ID from URL
const SUPABASE_PROJECT_ID = SUPABASE_URL.match(/https?:\/\/([^.]+)\.supabase\.co/)?.[1] || 
  'rdznelijpliklisnflfm'; // Fallback para compatibilidad

// Validate that we have real credentials (not placeholders)
const hasValidCredentials = 
  SUPABASE_URL !== 'https://placeholder.supabase.co' && 
  SUPABASE_PUBLISHABLE_KEY !== 'placeholder-key' &&
  SUPABASE_URL.startsWith('https://') &&
  SUPABASE_PUBLISHABLE_KEY.length > 20;

if (!hasValidCredentials) {
  console.error('❌ ERROR CRÍTICO: Credenciales de Supabase no válidas');
  console.error('❌ Por favor, configura VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en el archivo .env');
  console.error('❌ La aplicación puede no funcionar correctamente');
} else {
  console.log('✅ Credenciales de Supabase validadas correctamente');
}

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});

export { SUPABASE_PROJECT_ID };
