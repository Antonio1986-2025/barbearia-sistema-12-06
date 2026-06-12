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
    tanstackStart({ server: { entry: "server" } }),
    viteReact(),
    tailwindcss(),
  ],
});
