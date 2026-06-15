/**
 * Helper para obter variáveis de ambiente em qualquer runtime suportado.
 *
 * Em Cloudflare Workers com `nodejs_compat` e compatibility_date >= 2024-09-23,
 * `process.env` é populado automaticamente com as bindings do Worker
 * (variables/secrets do dashboard).
 *
 * Em Node.js (dev local), `process.env` é o ambiente padrão.
 *
 * Por isso basta ler `process.env` aqui — funciona nos dois runtimes.
 */

type EnvBag = Record<string, string | undefined>;

function readBag(): EnvBag {
  if (typeof process !== "undefined" && process.env) {
    return process.env as EnvBag;
  }
  return {};
}

/** Obtém uma variável de ambiente. */
export async function getServerEnv(key: string): Promise<string | undefined> {
  return readBag()[key];
}

/** Obtém múltiplas variáveis de uma vez. */
export async function getServerEnvs<K extends string>(
  ...keys: K[]
): Promise<Record<K, string | undefined>> {
  const bag = readBag();
  const out = {} as Record<K, string | undefined>;
  for (const k of keys) out[k] = bag[k];
  return out;
}
