import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { formatBRL, formatDateBR, todayYMD } from "@/lib/format";
import { Lock, Unlock, Plus, TrendingUp, TrendingDown } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/financeiro")({
  head: () => ({ meta: [{ title: "Financeiro — Barbearia Status" }] }),
  component: FinanceiroPage,
});

function FinanceiroPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-display font-bold bs-gold-text">Financeiro</h1>
        <p className="text-sm text-muted-foreground">Caixa, transações e movimentações</p>
      </div>
      <Tabs defaultValue="caixa">
        <TabsList>
          <TabsTrigger value="caixa">Caixa do dia</TabsTrigger>
          <TabsTrigger value="transacoes">Transações</TabsTrigger>
        </TabsList>
        <TabsContent value="caixa" className="mt-4"><CaixaTab /></TabsContent>
        <TabsContent value="transacoes" className="mt-4"><TransacoesTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function CaixaTab() {
  const qc = useQueryClient();
  const [openAdd, setOpenAdd] = useState(false);

  const { data: caixa } = useQuery({
    queryKey: ["caixa-today"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cash_registers")
        .select("*").eq("data", todayYMD()).eq("status", "aberto").maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: movs = [] } = useQuery({
    queryKey: ["cash-mov", caixa?.id],
    enabled: !!caixa,
    queryFn: async () => {
      const { data, error } = await supabase.from("cash_movements")
        .select("*").eq("cash_id", caixa!.id).order("hora", { ascending: false });
      if (error) throw error;
      return data as { id: string; tipo: string; descricao: string; valor: number; forma_pagamento: string | null; hora: string }[];
    },
  });

  const open = async () => {
    const inicial = Number(prompt("Valor inicial do caixa (R$)", "0") ?? 0);
    const { error } = await supabase.from("cash_registers").insert({
      data: todayYMD(), valor_inicial: inicial, status: "aberto",
    });
    if (error) return toast.error(error.message);
    toast.success("Caixa aberto");
    qc.invalidateQueries({ queryKey: ["caixa-today"] });
  };

  const close = async () => {
    if (!caixa) return;
    if (!confirm("Fechar caixa do dia?")) return;
    const entradas = movs.filter((m) => m.tipo === "entrada").reduce((s, m) => s + Number(m.valor), 0);
    const saidas = movs.filter((m) => m.tipo === "saida").reduce((s, m) => s + Number(m.valor), 0);
    const valor_final = Number(caixa.valor_inicial) + entradas - saidas;
    const { error } = await supabase.from("cash_registers")
      .update({ status: "fechado", fechamento: new Date().toISOString(), valor_final })
      .eq("id", caixa.id);
    if (error) return toast.error(error.message);
    toast.success("Caixa fechado");
    qc.invalidateQueries({ queryKey: ["caixa-today"] });
  };

  if (!caixa) {
    return (
      <div className="bs-card p-10 text-center space-y-3">
        <Lock className="h-10 w-10 text-muted-foreground mx-auto" />
        <h3 className="font-display text-xl">Caixa fechado</h3>
        <p className="text-sm text-muted-foreground">Abra o caixa para registrar movimentações de hoje.</p>
        <Button className="bs-btn-primary border-0" onClick={open}><Unlock className="h-4 w-4 mr-1" /> Abrir caixa</Button>
      </div>
    );
  }

  const entradas = movs.filter((m) => m.tipo === "entrada").reduce((s, m) => s + Number(m.valor), 0);
  const saidas = movs.filter((m) => m.tipo === "saida").reduce((s, m) => s + Number(m.valor), 0);
  const saldo = Number(caixa.valor_inicial) + entradas - saidas;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Valor Inicial" value={formatBRL(caixa.valor_inicial)} />
        <Stat label="Entradas" value={formatBRL(entradas)} accent="success" />
        <Stat label="Saídas" value={formatBRL(saidas)} accent="destructive" />
        <Stat label="Saldo" value={formatBRL(saldo)} accent="primary" />
      </div>
      <div className="flex justify-between items-center">
        <StatusBadge status="aberto" />
        <div className="flex gap-2">
          <Button className="bs-btn-primary border-0" onClick={() => setOpenAdd(true)}><Plus className="h-4 w-4 mr-1" /> Movimentação</Button>
          <Button variant="outline" onClick={close}><Lock className="h-4 w-4 mr-1" /> Fechar caixa</Button>
        </div>
      </div>

      <div className="bs-card overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Hora</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Pagamento</TableHead>
              <TableHead className="text-right">Valor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {movs.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nenhuma movimentação</TableCell></TableRow>}
            {movs.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="text-sm font-mono">{new Date(m.hora).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</TableCell>
                <TableCell>
                  {m.tipo === "entrada"
                    ? <span className="inline-flex items-center gap-1 text-success text-xs font-semibold"><TrendingUp className="h-3 w-3" /> Entrada</span>
                    : <span className="inline-flex items-center gap-1 text-destructive text-xs font-semibold"><TrendingDown className="h-3 w-3" /> Saída</span>}
                </TableCell>
                <TableCell>{m.descricao}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{m.forma_pagamento ?? "—"}</TableCell>
                <TableCell className={`text-right font-mono ${m.tipo === "entrada" ? "text-success" : "text-destructive"}`}>
                  {m.tipo === "entrada" ? "+" : "-"} {formatBRL(m.valor)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {openAdd && <AddMovDialog cashId={caixa.id} onClose={() => setOpenAdd(false)} onSaved={() => { setOpenAdd(false); qc.invalidateQueries({ queryKey: ["cash-mov"] }); }} />}
    </div>
  );
}

function AddMovDialog({ cashId, onClose, onSaved }: { cashId: string; onClose: () => void; onSaved: () => void }) {
  const [tipo, setTipo] = useState<"entrada" | "saida">("entrada");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [pgto, setPgto] = useState("dinheiro");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const v = Number(valor);
    if (!descricao.trim() || !v) return toast.error("Preencha descrição e valor");
    setSaving(true);
    const { error } = await supabase.from("cash_movements").insert({
      cash_id: cashId, tipo, descricao: descricao.trim(), valor: v, forma_pagamento: pgto,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Registrado");
    onSaved();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bs-card">
        <DialogHeader><DialogTitle className="font-display">Nova Movimentação</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1">
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as "entrada" | "saida")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="entrada">Entrada</SelectItem>
                <SelectItem value="saida">Saída</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1"><Label>Descrição</Label><Input value={descricao} onChange={(e) => setDescricao(e.target.value)} /></div>
          <div className="grid gap-1"><Label>Valor (R$)</Label><Input type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} /></div>
          <div className="grid gap-1">
            <Label>Forma de pagamento</Label>
            <Select value={pgto} onValueChange={setPgto}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="dinheiro">Dinheiro</SelectItem>
                <SelectItem value="pix">PIX</SelectItem>
                <SelectItem value="debito">Débito</SelectItem>
                <SelectItem value="credito">Crédito</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button className="bs-btn-primary border-0" disabled={saving} onClick={save}>{saving ? "Salvando..." : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TransacoesTab() {
  const qc = useQueryClient();
  const [openNew, setOpenNew] = useState(false);
  const { data: txs = [] } = useQuery({
    queryKey: ["transactions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("transactions").select("*").order("data", { ascending: false }).limit(200);
      if (error) throw error;
      return data as { id: string; data: string; tipo: string; categoria: string; descricao: string; valor: number; forma_pagamento: string | null }[];
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button className="bs-btn-primary border-0" onClick={() => setOpenNew(true)}><Plus className="h-4 w-4 mr-1" /> Nova transação</Button>
      </div>
      <div className="bs-card overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead className="text-right">Valor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {txs.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nenhuma transação</TableCell></TableRow>}
            {txs.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="text-sm">{formatDateBR(t.data)}</TableCell>
                <TableCell className={`text-xs font-semibold uppercase ${t.tipo === "receita" ? "text-success" : "text-destructive"}`}>{t.tipo}</TableCell>
                <TableCell>{t.categoria}</TableCell>
                <TableCell>{t.descricao}</TableCell>
                <TableCell className={`text-right font-mono ${t.tipo === "receita" ? "text-success" : "text-destructive"}`}>
                  {t.tipo === "receita" ? "+" : "-"} {formatBRL(t.valor)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {openNew && <NewTxDialog onClose={() => setOpenNew(false)} onSaved={() => { setOpenNew(false); qc.invalidateQueries({ queryKey: ["transactions"] }); }} />}
    </div>
  );
}

function NewTxDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [tipo, setTipo] = useState<"receita" | "despesa">("despesa");
  const [categoria, setCategoria] = useState("");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [data, setData] = useState(todayYMD());
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const v = Number(valor);
    if (!categoria || !descricao.trim() || !v) return toast.error("Preencha todos os campos");
    setSaving(true);
    const { error } = await supabase.from("transactions").insert({
      tipo, categoria, descricao: descricao.trim(), valor: v, data,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Registrada");
    onSaved();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bs-card">
        <DialogHeader><DialogTitle className="font-display">Nova Transação</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1">
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as "receita" | "despesa")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="receita">Receita</SelectItem>
                <SelectItem value="despesa">Despesa</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1"><Label>Categoria</Label><Input value={categoria} onChange={(e) => setCategoria(e.target.value)} placeholder="Aluguel, Produtos, Energia..." /></div>
          <div className="grid gap-1"><Label>Descrição</Label><Input value={descricao} onChange={(e) => setDescricao(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1"><Label>Valor (R$)</Label><Input type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} /></div>
            <div className="grid gap-1"><Label>Data</Label><Input type="date" value={data} onChange={(e) => setData(e.target.value)} /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button className="bs-btn-primary border-0" disabled={saving} onClick={save}>{saving ? "Salvando..." : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: "success" | "destructive" | "primary" }) {
  const color = accent === "success" ? "text-success" : accent === "destructive" ? "text-destructive" : accent === "primary" ? "bs-gold-text" : "";
  return (
    <div className="bs-card p-4">
      <div className="text-xs text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className={`mt-1 font-display text-xl font-bold ${color}`}>{value}</div>
    </div>
  );
}
