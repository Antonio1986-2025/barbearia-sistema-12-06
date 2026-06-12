import { createFileRoute, Link, useLocation, Outlet } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { formatBRL, maskPhone } from "@/lib/format";
import { Receipt, Plus, Search, ArrowRight } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/comandas")({
  head: () => ({ meta: [{ title: "Comandas — Barbearia Status" }] }),
  component: ComandasLayout,
});

function ComandasLayout() {
  const { pathname } = useLocation();
  const isRoot = pathname === "/comandas" || pathname === "/comandas/";
  
  return (
    <>
      {isRoot ? <ComandasPage /> : <Outlet />}
    </>
  );
}

type Command = {
  id: string;
  numero: number;
  cliente_nome: string;
  status: string;
  valor: number;
  abertura: string;
};

function ComandasPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [openNew, setOpenNew] = useState(false);

  const { data: commands = [] } = useQuery({
    queryKey: ["commands"],
    queryFn: async () => {
      const { data, error } = await supabase.from("commands")
        .select("*")
        .neq("status", "paga")
        .order("abertura", { ascending: false });
      if (error) throw error;
      return data as Command[];
    },
  });

  const filtered = commands.filter(c => 
    c.cliente_nome?.toLowerCase().includes(search.toLowerCase()) || 
    c.numero.toString().includes(search)
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold bs-gold-text">Comandas</h1>
          <p className="text-sm text-muted-foreground">Vendas em aberto e comandas de clientes</p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar comanda..." 
              className="pl-9 w-64 h-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button className="bs-btn-primary border-0 h-10" onClick={() => setOpenNew(true)}>
            <Plus className="h-4 w-4 mr-1" /> Nova Comanda
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.length === 0 && (
          <div className="col-span-full py-12 text-center bs-card">
            <Receipt className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-20" />
            <p className="text-muted-foreground">Nenhuma comanda aberta encontrada.</p>
          </div>
        )}
        {filtered.map((c) => (
          <CommandCard key={c.id} command={c} />
        ))}
      </div>

      {openNew && <NewCommandDialog onClose={() => setOpenNew(false)} />}
    </div>
  );
}

function CommandCard({ command }: { command: Command }) {
  return (
    <Link 
      to="/comandas/$id"
      params={{ id: command.id }}
      className="bs-card p-4 hover:border-primary/50 transition-all cursor-pointer group block"
    >
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center font-mono font-bold text-primary border border-primary/20">
            {command.numero}
          </div>
          <div>
            <h3 className="font-bold text-sm uppercase truncate max-w-[150px]">{command.cliente_nome || "CONSUMIDOR"}</h3>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Aberta às {new Date(command.abertura).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-display font-bold bs-gold-text">{formatBRL(command.valor)}</div>
          <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-primary/10 text-primary border border-primary/20 uppercase font-semibold">
            {command.status}
          </span>
        </div>
      </div>
      <div className="flex justify-between items-center pt-3 border-t border-border/40">
        <span className="text-[11px] text-muted-foreground">Ver detalhes e itens</span>
        <ArrowRight className="h-4 w-4 text-primary group-hover:translate-x-1 transition-transform" />
      </div>
    </Link>
  );
}

function NewCommandDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [nome, setNome] = useState("");
  const [tel, setTel] = useState("");
  const [numero, setNumero] = useState("");
  const [showQuickRegister, setShowQuickRegister] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: matchedClients = [] } = useQuery({
    queryKey: ["client-search", nome],
    queryFn: async () => {
      if (nome.length < 2) return [];
      const { data } = await supabase.from("clients")
        .select("id, nome, tel")
        .ilike("nome", `%${nome}%`)
        .limit(5);
      return data || [];
    },
    enabled: nome.length >= 2 && !showQuickRegister,
  });

  const save = async () => {
    if (!numero) return toast.error("Informe o número da comanda");
    setSaving(true);

    try {
      let finalNome = nome.trim() || "Consumidor";
      
      if (showQuickRegister && tel.trim()) {
        const cleanPhone = tel.replace(/\D/g, "");
        if (cleanPhone.length >= 10) {
          const { data: existingClient } = await supabase
            .from("clients")
            .select("id")
            .eq("tel", cleanPhone)
            .maybeSingle();

          if (!existingClient) {
            await supabase.from("clients").insert({
              nome: finalNome,
              tel: cleanPhone,
              visitas: 0,
              total_gasto: 0
            });
            toast.success("Cliente cadastrado com sucesso");
          }
        }
      }

      const { error } = await supabase.from("commands").insert({
        numero: Number(numero),
        cliente_nome: finalNome,
        status: "aberta",
        abertura: new Date().toISOString(),
        valor: 0
      }).select().single();
      
      if (error) throw error;
      
      toast.success("Comanda aberta");
      qc.invalidateQueries({ queryKey: ["commands"] });
      onClose();
    } catch (error: any) {
      toast.error(error.message || "Erro ao abrir comanda");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bs-card">
        <DialogHeader><DialogTitle className="font-display">Nova Comanda</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Número da Comanda</Label>
            <Input 
              type="number" 
              placeholder="Ex: 01" 
              autoFocus
              value={numero} 
              onChange={(e) => setNumero(e.target.value)} 
            />
          </div>
          
          <div className="grid gap-2 relative">
            <div className="flex justify-between items-end">
              <Label>Nome do Cliente</Label>
              {!showQuickRegister && (
                <button 
                  type="button" 
                  onClick={() => setShowQuickRegister(true)}
                  className="text-[10px] uppercase font-bold text-primary hover:underline"
                >
                  + Cadastro Rápido
                </button>
              )}
            </div>
            <Input 
              placeholder="Nome do cliente" 
              value={nome} 
              onChange={(e) => setNome(e.target.value)} 
            />
            
            {matchedClients.length > 0 && !showQuickRegister && (
              <div className="absolute top-[calc(100%+4px)] left-0 right-0 z-50 bg-card border border-border rounded-md shadow-lg overflow-hidden">
                {matchedClients.map(c => (
                  <button
                    key={c.id}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-secondary transition-colors border-b border-border/50 last:border-0"
                    onClick={() => {
                      setNome(c.nome);
                      setTel(c.tel);
                      setShowQuickRegister(true);
                    }}
                  >
                    <span className="font-bold">{c.nome}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{c.tel}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {showQuickRegister && (
            <div className="grid gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
              <Label>Telefone</Label>
              <Input 
                placeholder="(00) 0 0000-0000" 
                value={tel} 
                onChange={(e) => setTel(maskPhone(e.target.value))} 
              />
              <button 
                type="button" 
                onClick={() => setShowQuickRegister(false)}
                className="text-[10px] text-muted-foreground hover:text-foreground text-right uppercase font-bold"
              >
                Remover telefone
              </button>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button className="bs-btn-primary border-0" disabled={saving} onClick={save}>
            {saving ? "Abrindo..." : "Abrir Comanda"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}