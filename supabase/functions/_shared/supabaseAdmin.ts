/**
 * Supabase admin client for Edge Functions.
 *
 * Edge Functions run with the service-role key so they can bypass
 * RLS for trusted back-office work (token refresh, SCIM writes,
 * Zoom meeting creation, etc.). Never import this module from
 * client-side code.
 *
 * Required environment variables (set via `supabase secrets set`):
 *   - SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 */

// @ts-expect-error Deno remote import resolved at deploy time.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// @ts-expect-error Deno globals are provided by the edge runtime.
const supabaseUrl = Deno.env.get('SUPABASE_URL');
// @ts-expect-error Deno globals are provided by the edge runtime.
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !serviceRoleKey) {
  // Do not throw at import time — some functions (e.g. health probes)
  // might run before secrets are configured. Callers should instead
  // check `hasAdminCredentials()` before using the client.
  console.warn('[supabaseAdmin] missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

export const supabaseAdmin = createClient(supabaseUrl ?? '', serviceRoleKey ?? '', {
  auth: { persistSession: false, autoRefreshToken: false }
});

export function hasAdminCredentials(): boolean {
  return Boolean(supabaseUrl && serviceRoleKey);
}
