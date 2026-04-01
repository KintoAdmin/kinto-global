import { createClient } from "@supabase/supabase-js";
import { getServerEnv } from "@/lib/env";

let client: ReturnType<typeof createClient> | null = null;

export function getAdminClient() {
  if (client) return client;
  const env = getServerEnv();
  client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
  return client;
}
