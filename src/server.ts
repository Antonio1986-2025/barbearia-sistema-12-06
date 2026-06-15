import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

/**
 * Em Cloudflare Workers, as variáveis de ambiente chegam via `env` no fetch
 * (não em `process.env`). Como o código de Supabase usa `process.env.X`,
 * espelhamos o `env` do Worker em `process.env` na primeira requisição.
 *
 * É seguro chamar repetidamente (no-op após primeira chamada).
 */
let envHydrated = false;
function hydrateProcessEnv(env: unknown) {
  if (envHydrated || !env || typeof env !== "object") return;
  const globalProcess = (globalThis as { process?: { env?: Record<string, string> } }).process;
  if (!globalProcess) {
    (globalThis as unknown as { process: { env: Record<string, string> } }).process = { env: {} };
  } else if (!globalProcess.env) {
    globalProcess.env = {};
  }
  const target = (globalThis as unknown as { process: { env: Record<string, string> } }).process.env;
  for (const [key, value] of Object.entries(env as Record<string, unknown>)) {
    if (typeof value === "string" && target[key] === undefined) {
      target[key] = value;
    }
  }
  envHydrated = true;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response, url: string): Promise<Response> {
  if (response.status < 500) return response;

  const body = await response.clone().text();

  // Log SEMPRE que houver 500, independente do formato
  const capturedError = consumeLastCapturedError();
  if (capturedError) {
    console.error(`[SSR 500] ${url} — captured error:`, capturedError);
  } else {
    console.error(`[SSR 500] ${url} — raw body: ${body.slice(0, 2000)}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    // Espelha as variáveis do Worker em process.env para o código que usa Node-style env
    hydrateProcessEnv(env);

    try {
      const url = new URL(request.url);

      if (url.pathname === "/health") {
        return new Response(JSON.stringify({ status: "ok", timestamp: new Date().toISOString() }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }

      // Endpoint de diagnóstico para validar config sem expor segredos
      if (url.pathname === "/__env-check") {
        const envObj = env as Record<string, unknown> | null;
        const has = (k: string) => Boolean(envObj && typeof envObj[k] === "string" && (envObj[k] as string).length > 0);
        return new Response(
          JSON.stringify({
            workerEnv: {
              SUPABASE_URL: has("SUPABASE_URL"),
              SUPABASE_PUBLISHABLE_KEY: has("SUPABASE_PUBLISHABLE_KEY"),
              SUPABASE_ANON_KEY: has("SUPABASE_ANON_KEY"),
              SUPABASE_SERVICE_ROLE_KEY: has("SUPABASE_SERVICE_ROLE_KEY"),
            },
            processEnv: {
              SUPABASE_URL: Boolean(process.env.SUPABASE_URL),
              SUPABASE_PUBLISHABLE_KEY: Boolean(process.env.SUPABASE_PUBLISHABLE_KEY),
              SUPABASE_ANON_KEY: Boolean(process.env.SUPABASE_ANON_KEY),
              SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response, url.pathname);
    } catch (error) {
      console.error("[server.ts fetch] caught error:", error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
