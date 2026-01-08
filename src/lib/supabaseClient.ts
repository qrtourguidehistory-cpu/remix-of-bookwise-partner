// Custom Supabase client with hardcoded credentials
// This file overrides the auto-generated client from Lovable Cloud
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

// Hardcoded credentials - these will NOT be overwritten by Lovable Cloud
const SUPABASE_URL = 'https://rdznelijpliklisnflfm.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkem5lbGlqcGxpa2xpc25mbGZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI2MjY4MzAsImV4cCI6MjA3ODIwMjgzMH0.o8G-wYYIN0Paw20YP4dSJcL5mf2mUdrfcWRfMauFjGQ';

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});

export const SUPABASE_PROJECT_ID = 'rdznelijpliklisnflfm';
