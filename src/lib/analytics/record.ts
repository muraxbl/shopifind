import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import {
  shouldRecordHistoryEvent,
  type SearchHistoryInsert,
} from './history';

type HistoryRequestContext = {
  userAgent?: string | null;
};

/**
 * Analytics writes intentionally use a stateless anon client. This keeps the
 * events anonymous and makes the existing RLS policy behave identically for
 * signed-in and signed-out visitors.
 */
export async function recordHistoryEvent(
  event: SearchHistoryInsert,
  context?: HistoryRequestContext,
): Promise<void> {
  if (!shouldRecordHistoryEvent(context?.userAgent)) return;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return;

  try {
    const supabase = createClient<Database>(url, anonKey, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    });
    // Supabase 2.x resolves this generated insert overload to `never` for the
    // current hand-maintained Database type. The event is constructed by our
    // typed builders above, so keep the workaround local to the SDK boundary.
    const { error } = await supabase
      .from('search_history')
      .insert(event as never);
    if (error) console.warn('[analytics] history insert skipped:', error.message);
  } catch (error) {
    console.warn(
      '[analytics] history insert skipped:',
      error instanceof Error ? error.message : 'unknown error',
    );
  }
}
