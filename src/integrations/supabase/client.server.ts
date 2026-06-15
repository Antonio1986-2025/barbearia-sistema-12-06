// Server-side Supabase client with service role key - bypasses RLS.
// Use this for admin operations in server functions and server routes only.
// For user-authenticated queries (with RLS), use the auth middleware instead.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getServerEnvs } from "@/lib/server-env";
import type { Database } from "./types";

type AdminClient = SupabaseClient<Database>;

let _client: AdminClient | undefined;
let _initPromise: Promise<AdminClient> | undefined;

/**
 * Obtém o client admin do Supabase. Lê variáveis de ambiente sob demanda
 * (compatível com Cloudflare Workers e Node.js). Cacheia o client após a
 * primeira chamada.
 */
export async function getSupabaseAdmin(): Promise<AdminClient> {
  if (_client) return _client;
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = await getServerEnvs(
      "SUPABASE_URL",
      "SUPABASE_SERVICE_ROLE_KEY",
    );

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      const missing = [
        ...(!SUPABASE_URL ? ["SUPABASE_URL"] : []),
        ...(!SUPABASE_SERVICE_ROLE_KEY ? ["SUPABASE_SERVICE_ROLE_KEY"] : []),
      ];
      const message = `Variável(is) de ambiente do Supabase ausente(s): ${missing.join(", ")}. Configure-a(s) no Worker (Cloudflare → Settings → Variables and Secrets).`;
      console.error(`[Supabase] ${message}`);
      throw new Error(message);
    }

    const c = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });
    _client = c;
    return c;
  })();

  return _initPromise;
}

/**
 * @deprecated Use `getSupabaseAdmin()` em vez disso. Mantido para compatibilidade.
 *
 * Esta export ainda existe para evitar quebrar imports legados, mas chamadas
 * a métodos síncronos (`.from`, `.auth.admin.x`) podem falhar porque dependem
 * da inicialização async. Migre para `await getSupabaseAdmin()`.
 */
export const supabaseAdmin = new Proxy({} as AdminClient, {
  get() {
    throw new Error(
      "supabaseAdmin agora é async. Use: const sb = await getSupabaseAdmin(); sb.from(...).",
    );
  },
});
