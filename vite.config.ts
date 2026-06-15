import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Configuração padrão do TanStack Start + Vite (sem wrappers proprietários).
// Ordem dos plugins importa: tsConfigPaths resolve os aliases do tsconfig (ex.: "@/*"),
// tanstackStart deve vir antes do viteReact, e tailwindcss por último.
export default defineConfig({
  plugins: [
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    // Redireciona a entrada do servidor SSR para src/server.ts (wrapper de erro).
    // target: "cloudflare-pages" gera output compatível com Cloudflare Pages.
    tanstackStart({
      server: {
        entry: "server",
        // Detecta automaticamente o target baseado em variável de ambiente
        // CF_PAGES=1 → cloudflare-pages | default → node-server
        ...(process.env.CF_PAGES || process.env.CLOUDFLARE_PAGES
          ? { preset: "cloudflare-pages" }
          : {}),
      },
    }),
    viteReact(),
    tailwindcss(),
  ],
  // "cloudflare:workers" só existe em runtime no Cloudflare Workers; marcar
  // como external evita o erro de build do Rollup ao tentar resolvê-lo.
  build: {
    rollupOptions: {
      external: ["cloudflare:workers"],
    },
  },
  ssr: {
    external: ["cloudflare:workers"],
  },
});
