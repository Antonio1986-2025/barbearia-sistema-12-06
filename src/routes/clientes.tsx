import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatBRL, formatDateBR, maskPhone } from "@/lib/format";
import { Plus, Search, Trash2, Phone, Mail, DollarSign } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/clientes")({
  head: () => ({ meta: [{ title: "Clientes — Barbearia Status" }] }),
  component: ClientesPage,
});

type Client = {
  id: string; nome: string; tel: string; email: string | null;
  data_nascimento: string | null; visitas: number; total_gasto: number;
  ultima_visita: string | null; observacao: string | null;
};

function ClientesPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [openNew, setOpenNew] = useState(false);

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["clients", q],
    queryFn: async () => {
      let query = supabase.from("clients").select("*").order("nome");
      if (q.trim()) query = query.or(`nome.ilike.%${q}%,tel.ilike.%${q}%,email.ilike.%${q}%`);
      const { data, error } = await query.limit(200);
      if (error) throw error;
      return data as Client[];
    },
  });

  const remove = async (id: string) => {
    if (!confirm("Excluir cliente?")) return;
    const { error } = await supabase.from("clients").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Excluído");
    qc.invalidateQueries({ queryKey: ["clients"] });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold bs-gold-text">Clientes</h1>
          <p className="text-sm text-muted-foreground">{clients.length} cadastrados</p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar nome, telefone, email" className="pl-9 w-72" />
          </div>
          <Button className="bs-btn-primary border-0" onClick={() => setOpenNew(true)}>
            <Plus className="h-4 w-4 mr-1" /> Novo
          </Button>
        </div>
      </div>

      <div className="bs-card overflow-auto">
        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="text-right">Visitas</TableHead>
                <TableHead className="text-right">Total Gasto</TableHead>
                <TableHead>Última visita</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Carregando...</TableCell></TableRow>}
              {!isLoading && clients.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Nenhum cliente encontrado</TableCell></TableRow>
              )}
              {clients.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.nome}</TableCell>
                  <TableCell className="font-mono text-sm">{c.tel}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{c.email ?? "—"}</TableCell>
                  <TableCell className="text-right">{c.visitas}</TableCell>
                  <TableCell className="text-right font-mono">{formatBRL(c.total_gasto)}</TableCell>
                  <TableCell className="text-sm">{c.ultima_visita ? formatDateBR(c.ultima_visita) : "—"}</TableCell>
                  <TableCell><Button size="icon" variant="ghost" onClick={() => remove(c.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="block md:hidden divide-y divide-border">
          {isLoading && <p className="text-center text-muted-foreground py-8">Carregando...</p>}
          {!isLoading && clients.length === 0 && (
            <p className="text-center text-muted-foreground py-8">Nenhum cliente encontrado</p>
          )}
          {clients.map((c) => (
            <div key={c.id} className="flex items-start gap-3 px-4 py-4">
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm">{c.nome}</div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-muted-foreground">
                  {c.tel && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{c.tel}</span>}
                  {c.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{c.email}</span>}
                  <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" />{formatBRL(c.total_gasto)} · {c.visitas} visitas</span>
                </div>
              </div>
              <Button size="icon" variant="ghost" className="shrink-0 h-9 w-9" onClick={() => remove(c.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
      </div>

      {openNew && <NewClientDialog onClose={() => setOpenNew(false)} onSaved={() => { setOpenNew(false); qc.invalidateQueries({ queryKey: ["clients"] }); }} />}
    </div>
  );
}

function NewClientDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [nome, setNome] = useState("");
  const [tel, setTel] = useState("");
  const [email, setEmail] = useState("");
  const [nasc, setNasc] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!nome.trim() || !tel.trim()) return toast.error("Nome e telefone são obrigatórios");
    setSaving(true);
    const cleanPhone = tel.replace(/\D/g, "");
    const { error } = await supabase.from("clients").insert({
      nome: nome.trim(), tel: cleanPhone,
      email: email.trim() || null,
      data_nascimento: nasc || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Cliente cadastrado");
    onSaved();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bs-card">
        <DialogHeader><DialogTitle className="font-display">Novo Cliente</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1"><Label>Nome</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} /></div>
          <div className="grid gap-1"><Label>Telefone</Label><Input value={tel} onChange={(e) => setTel(maskPhone(e.target.value))} /></div>
          <div className="grid gap-1"><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div className="grid gap-1"><Label>Data de nascimento</Label><Input type="date" value={nasc} onChange={(e) => setNasc(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button className="bs-btn-primary border-0" disabled={saving} onClick={save}>{saving ? "Salvando..." : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
