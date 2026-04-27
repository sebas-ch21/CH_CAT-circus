/**
 * Shared CORS helper for Supabase Edge Functions.
 *
 * Every integration endpoint needs identical preflight behaviour;
 * centralising it here keeps the per-function code trivially small
 * and makes the allowed-origin policy reviewable in one place.
 *
 * In production, replace the `*` origin with the concrete Charlie
 * Health app origin (e.g. `https://admissions.charliehealth.com`).
 */

export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-correlation-id',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS'
};

/**
 * Handle the OPTIONS preflight once at the top of every handler:
 *
 *   if (req.method === 'OPTIONS') return handleCorsPreflight();
 */
export function handleCorsPreflight(): Response {
  return new Response('ok', { headers: corsHeaders });
}

/**
 * Convenience wrapper that always attaches the CORS headers.
 */
export function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers ?? {});
  for (const [k, v] of Object.entries(corsHeaders)) headers.set(k, v);
  headers.set('Content-Type', 'application/json');
  return new Response(JSON.stringify(body), { ...init, headers });
}
