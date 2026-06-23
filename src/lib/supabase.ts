import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';

// ─── Database + Auth client ──────────────────────────────────────────────────
// Supabase handles both authentication and data (sensors, nodes, profiles, activity).
declare global {
  // eslint-disable-next-line no-var
  var _supabase: SupabaseClient | undefined;
}

export const supabase: SupabaseClient =
  globalThis._supabase ?? createClient(supabaseUrl, supabaseAnonKey);

if (process.env.NODE_ENV !== 'production') {
  globalThis._supabase = supabase;
}

// ─── Server-side Admin client ─────────────────────────────────────────────────
// Uses the service_role key — bypasses RLS. Use ONLY inside /app/api/* routes.
export const createAdminClient = () => {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  if (!serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
};
