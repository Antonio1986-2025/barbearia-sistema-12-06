/**
 * Helper que obtém variáveis de ambiente em qualquer runtime suportado.
 *
 * - Em Node.js (dev local, VPS): lê de `process.env`
 * - Em Cloudflare Workers: usa `import("cloudflare:workers")` que expõe `env`
 *
 * Cacheia o resultado para chamadas subsequentes.
 *
 * Uso:
 *   const url = await getServerEnv("SUPABASE_URL");
 */

type EnvBag = Record<string, string | undefined>;

let cachedBag: EnvBag | null = null;
let pendingBag: Promise<EnvBag> | null = null;

async function loadBag(): Promise<EnvBag> {
  // Tenta Cloudflare Workers primeiro (em runtime Worker, "cloudflare:workers" resolve)
  try {
    const mod = (await import(/* @vite-ignore */ "cloudflare:workers")) as {
      env?: Record<string, unknown>;
    };
    if (mod?.env && typeof mod.env === "object") {
      const cfBag: EnvBag = {};
      for (const [k, v] of Object.entries(mod.env)) {
        if (typeof v === "string") cfBag[k] = v;
      }
      // Mescla com process.env (process.env tem prioridade quando ambos existem)
      const procEnv =
        typeof process !== "undefined" && process.env ? process.env : ({} as EnvBag);
      return { ...cfBag, ...procEnv };
    }
  } catch {
    // não estamos em um Worker ou módulo não disponível
  }

  // Fallback: process.env (Node, dev local)
  if (typeof process !== "undefined" && process.env) {
    return process.env as EnvBag;
  }

  return {};
}

async function getBag(): Promise<EnvBag> {
  if (cachedBag) return cachedBag;
  if (!pendingBag) pendingBag = loadBag();
  cachedBag = await pendingBag;
  return cachedBag;
}

/** Obtém uma variável de ambiente. Aguarda init na primeira chamada. */
export async function getServerEnv(key: string): Promise<string | undefined> {
  const bag = await getBag();
  return bag[key];
}

/** Obtém múltiplas variáveis de uma vez. */
export async function getServerEnvs<K extends string>(
  ...keys: K[]
): Promise<Record<K, string | undefined>> {
  const bag = await getBag();
  const out = {} as Record<K, string | undefined>;
  for (const k of keys) out[k] = bag[k];
  return out;
}
