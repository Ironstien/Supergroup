import { createClient } from '@supabase/supabase-js';

let adminClient = null;

export function supabaseConfigured() {
  return Boolean(
    process.env.SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  );
}

export function getSupabaseAdmin() {
  if (!supabaseConfigured()) return null;
  if (!adminClient) {
    adminClient = createClient(
      process.env.SUPABASE_URL.trim(),
      process.env.SUPABASE_SERVICE_ROLE_KEY.trim(),
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
  }
  return adminClient;
}
