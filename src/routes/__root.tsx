import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Outlet, Link, createRootRouteWithContext, useRouter,
  HeadContent, Scripts, useLocation, useNavigate,
} from "@tanstack/react-router";
import { useEffect } from "react";

import appCss from "../styles.css?url";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { Topbar } from "@/components/Topbar";
import { Toaster } from "@/components/ui/sonner";

const PUBLIC_PATHS = ["/login", "/agendar", "/diag"];
const ADMIN_ONLY = ["/comandas", "/clientes", "/financeiro", "/estoque", "/relatorios", "/configuracoes"];

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-display font-bold bs-gold-text">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Página não encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          O endereço que você acessou não existe.
        </p>
        <Link to="/agenda" className="inline-flex mt-6 items-center justify-center rounded-md bs-btn-primary px-4 py-2 text-sm font-medium">
          Ir para Agenda
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-display font-semibold">Algo deu errado</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button
          onClick={() => { router.invalidate(); reset(); }}
          className="mt-6 inline-flex rounded-md bs-btn-primary px-4 py-2 text-sm font-medium"
        >Tentar novamente</button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "Barbearia Status — Gestão" },
      { name: "description", content: "Sistema de gestão da Barbearia Status: agenda, clientes, caixa, comandas, estoque e relatórios." },
      { name: "theme-color", content: "#0e0a05" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "Barbearia" },
      { name: "mobile-web-app-capable", content: "yes" },
      { property: "og:title", content: "Barbearia Status — Gestão" },
      { name: "twitter:title", content: "Barbearia Status — Gestão" },
      { property: "og:description", content: "Sistema de gestão da Barbearia Status: agenda, clientes, caixa, comandas, estoque e relatórios." },
      { name: "twitter:description", content: "Sistema de gestão da Barbearia Status: agenda, clientes, caixa, comandas, estoque e relatórios." },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.json" },
      { rel: "icon", type: "image/svg+xml", href: "/icon.svg" },
      { rel: "apple-touch-icon", href: "/icon.svg" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="dark">
      <head><HeadContent /></head>
      <body>
        {children}
        <Scripts />
        <script
          dangerouslySetInnerHTML={{
            __html: `if("serviceWorker" in navigator){window.addEventListener("load",()=>{navigator.serviceWorker.register("/sw.js")})}`,
          }}
        />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppShell />
        <Toaster richColors closeButton position="top-right" />
      </AuthProvider>
    </QueryClientProvider>
  );
}

function AppShell() {
  const { user, profile, loading, isAdmin } = useAuth();
  const loc = useLocation();
  const navigate = useNavigate();

  const isPublic = PUBLIC_PATHS.some((p) => loc.pathname === p || loc.pathname.startsWith(p + "/"));
  const isAdminOnly = ADMIN_ONLY.some((p) => loc.pathname === p || loc.pathname.startsWith(p + "/"));

  useEffect(() => {
    if (loading) return;
    if (!user && !isPublic) {
      navigate({ to: "/login" });
    } else if (user && profile && isAdminOnly && !isAdmin) {
      navigate({ to: "/agenda" });
    } else if (user && loc.pathname === "/login") {
      navigate({ to: "/agenda" });
    }
  }, [loading, user, profile, isAdmin, isAdminOnly, isPublic, loc.pathname, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground text-sm font-display">Carregando…</div>
      </div>
    );
  }

  if (isPublic || !user) {
    return <Outlet />;
  }

  return (
    <div className="min-h-screen bg-background">
      <Topbar />
      <main className="container mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
