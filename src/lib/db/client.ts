import { createClient } from "@supabase/supabase-js";

/**
 * Browser/client-safe Supabase client — uses the anon key, subject to RLS.
 * Use this only in client components; server code should use `getServiceClient`.
 */
export function getBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  return createClient(url, anonKey);
}
