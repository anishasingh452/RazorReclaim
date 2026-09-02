import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Note: deliberately no `server-only` import here — this module is also
// invoked from standalone CLI scripts (scripts/seed.ts) outside the Next.js
// build, where the server-only guard throws unconditionally. Never import
// this from a client component; it uses the service-role key.

let cached: SupabaseClient | null = null;

/**
 * Service-role Supabase client — bypasses RLS. Server-only (batch orchestrator,
 * webhook handler, API routes). Never import this from a client component.
 */
export function getServiceClient(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  cached = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
