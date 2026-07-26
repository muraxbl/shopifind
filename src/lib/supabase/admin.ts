import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

/**
 * Server-only Supabase client with SERVICE ROLE key.
 * Used by cron endpoints / API routes that must bypass RLS (e.g. ingest, ingest jobs).
 *
 * NEVER expose this to the browser. NEVER import this from a Client Component.
 */
export function createAdminSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is missing — admin client cannot be created.');
  }

  return createClient<Database>(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
