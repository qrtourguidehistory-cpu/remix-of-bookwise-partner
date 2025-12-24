// Cliente Supabase Custom para BookWise Partner
// Conectado a la base de datos central compartida con BookWise Client
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';

// Base de datos central: rdznelijpliklisnflfm
const SUPABASE_URL = 'https://rdznelijpliklisnflfm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkem5lbGlqcGxpa2xpc25mbGZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI2MjY4MzAsImV4cCI6MjA3ODIwMjgzMH0.o8G-wYYIN0Paw20YP4dSJcL5mf2mUdrfcWRfMauFjGQ';

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});

// Exportar constantes para uso en edge functions si es necesario
export const CENTRAL_DB_URL = SUPABASE_URL;
export const CENTRAL_DB_ANON_KEY = SUPABASE_ANON_KEY;
