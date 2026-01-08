// Re-export from the custom supabaseClient to ensure we use the correct credentials
// and have only ONE Supabase client instance
export { supabase, SUPABASE_PROJECT_ID } from "@/lib/supabaseClient";