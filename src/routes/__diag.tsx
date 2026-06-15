import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

const diag = createServerFn({ method: "GET" }).handler(() => {
  // Lê as variáveis de ambiente que importam para o app SSR
  const env = (typeof process !== "undefined" && process.env) || {};
  const has = (k: string) => Boolean((env as Record<string, unknown>)[k]);
  const len = (k: string) => {
    const v = (env as Record<string, unknown>)[k];
    return typeof v === "string" ? v.length : 0;
  };

  return {
    runtime: typeof process === "undefined" ? "no-process" : "process-available",
    keys: {
      SUPABASE_URL: { present: has("SUPABASE_URL"), length: len("SUPABASE_URL") },
      SUPABASE_PUBLISHABLE_KEY: {
        present: has("SUPABASE_PUBLISHABLE_KEY"),
        length: len("SUPABASE_PUBLISHABLE_KEY"),
      },
      SUPABASE_ANON_KEY: { present: has("SUPABASE_ANON_KEY"), length: len("SUPABASE_ANON_KEY") },
      SUPABASE_SERVICE_ROLE_KEY: {
        present: has("SUPABASE_SERVICE_ROLE_KEY"),
        length: len("SUPABASE_SERVICE_ROLE_KEY"),
      },
    },
    importMetaEnv: {
      VITE_SUPABASE_URL_present:
        typeof import.meta.env?.VITE_SUPABASE_URL === "string" &&
        import.meta.env.VITE_SUPABASE_URL.length > 0,
    },
    timestamp: new Date().toISOString(),
  };
});

function DiagComponent() {
  const data = Route.useLoaderData();
  return (
    <pre style={{ padding: 16, fontFamily: "monospace", fontSize: 12 }}>
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

export const Route = createFileRoute("/__diag")({
  loader: () => diag(),
  component: DiagComponent,
});
