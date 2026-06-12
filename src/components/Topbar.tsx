import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Menu, LogOut, Scissors } from "lucide-react";
import { initials } from "@/lib/format";

type NavItem = { to: string; label: string; admin?: boolean };
const NAV_ALL: NavItem[] = [
  { to: "/agenda", label: "Agenda" },
  { to: "/comandas", label: "Comandas" },
  { to: "/clientes", label: "Clientes", admin: true },
  { to: "/financeiro", label: "Financeiro", admin: true },
  { to: "/estoque", label: "Estoque", admin: true },
  { to: "/relatorios", label: "Relatórios", admin: true },
  { to: "/configuracoes", label: "Configurações", admin: true },
];

export function Topbar() {
  const { profile, isAdmin, signOut } = useAuth();
  const loc = useLocation();
  const navigate = useNavigate();

  const items = NAV_ALL.filter((i) => isAdmin || !i.admin);

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/login" });
  };

  const NavLinks = ({ onClick }: { onClick?: () => void }) => (
    <>
      {items.map((it) => {
        const active = loc.pathname.startsWith(it.to);
        return (
          <Link
            key={it.to}
            to={it.to}
            onClick={onClick}
            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              active
                ? "text-primary bg-secondary"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
            }`}
          >
            {it.label}
          </Link>
        );
      })}
    </>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link to="/agenda" className="flex items-center gap-2">
          <Scissors className="h-5 w-5 text-primary" />
          <span className="font-display text-lg font-bold tracking-wide bs-gold-text">
            BARBEARIA STATUS
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          <NavLinks />
        </nav>

        <div className="flex items-center gap-3">
          {profile && (
            <div className="hidden sm:flex items-center gap-2">
              <Avatar className="h-8 w-8 border border-border">
                <AvatarFallback
                  className="text-xs font-semibold"
                  style={{ backgroundColor: profile.cor ?? undefined, color: "#0e0a05" }}
                >
                  {profile.avatar ?? initials(profile.nome)}
                </AvatarFallback>
              </Avatar>
              <div className="hidden lg:flex flex-col leading-tight">
                <span className="text-xs font-medium">{profile.nome}</span>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {profile.tipo}
                </span>
              </div>
            </div>
          )}
          <Button
            variant="ghost" size="icon"
            onClick={handleSignOut}
            title="Sair"
            className="hidden md:inline-flex"
          >
            <LogOut className="h-4 w-4" />
          </Button>

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <div className="flex flex-col gap-1 pt-8">
                <NavLinks />
                <Button variant="outline" className="mt-4" onClick={handleSignOut}>
                  <LogOut className="h-4 w-4 mr-2" /> Sair
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
