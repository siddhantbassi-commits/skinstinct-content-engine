import { createClient, SupabaseClient } from "@supabase/supabase-js";

// No generated Database types for this project's schema, so the client is typed
// loosely (any) rather than fighting the default `never` row inference on
// insert/update. The schema itself is the source of truth (supabase/schema.sql).
let client: SupabaseClient<any, "public", any> | null = null;

export function getSupabase(): SupabaseClient<any, "public", any> {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set");
  }

  client = createClient(url, key, {
    auth: { persistSession: false },
  });
  return client;
}
