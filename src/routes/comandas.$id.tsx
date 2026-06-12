import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatBRL, formatDateBR, todayYMD } from "@/lib/format";
import { Receipt, Plus, Trash2, ChevronLeft, Printer, CreditCard, Banknote, QrCode } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/comandas/$id")({
  head: () => ({ meta: [{ title: "Detalhes da Comanda — Barbearia Status" }] }),
  component: CommandDetail,
});

function CommandDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [openAddItem, setOpenAddItem] = useState(false);
  const [openPay, setOpenPay] = useState(false);

  const { data: command, isLoading: loadingCmd } = useQuery({
    queryKey: ["command", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("commands").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: items = [], isLoading: loadingItems } = useQuery({
    queryKey: ["command-items", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("command_items")
        .select("*")
        .eq("command_id", id);
      if (error) throw error;
      return data as any[];
    },
  });

  const removeItem = async (itemId: string) => {
    if (!confirm("Remover item?")) return;
    const { error } = await supabase.from("command_items").delete().eq("id", itemId);
    if (error) return toast.error(error.message);
    
    // Recalcular total da comanda
    const newTotal = items.filter(i => i.id !== itemId).reduce((sum, i) => sum + Number(i.valor), 0);
    await supabase.from("commands").update({ valor: newTotal }).eq("id", id);
    
    qc.invalidateQueries({ queryKey: ["command", id] });
    qc.invalidateQueries({ queryKey: ["command-items", id] });
    toast.success("Item removido");
  };

  if (loadingCmd) return <div className="p-12 text-center">Carregando comanda...</div>;
  if (!command) return <div className="p-12 text-center text-destructive">Comanda não encontrada</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/comandas" })}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-display font-bold bs-gold-text">Comanda #{command.numero}</h1>
          <p className="text-sm text-muted-foreground">{command.cliente_nome} · Aberta em {formatDateBR(command.abertura)}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-1" /> Imprimir
          </Button>
          <Button className="bs-btn-primary border-0" onClick={() => setOpenPay(true)}>
            <Banknote className="h-4 w-4 mr-1" /> Fechar & Pagar
          </Button>
        </div>
      </div>

      <div className="print-only">
        <div className="text-[8px] font-bold leading-tight">Barbearia Status</div>
        <div className="text-[14px] font-black my-0.5">Comanda #{command.numero}</div>
        <div className="text-[8px] truncate w-full px-2">{command.cliente_nome}</div>
        <div className="text-[12px] font-bold mt-1">{formatBRL(command.valor)}</div>
        <div className="text-[6px] mt-1">{new Date().toLocaleString('pt-BR')}</div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="bs-card">
            <div className="p-4 border-b border-border/50 flex justify-between items-center">
              <h2 className="font-bold text-sm uppercase tracking-wider">Itens da Comanda</h2>
              <Button size="sm" variant="ghost" className="text-primary hover:text-primary/80" onClick={() => setOpenAddItem(true)}>
                <Plus className="h-4 w-4 mr-1" /> Adicionar Item
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Profissional</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      Nenhum item adicionado à comanda.
                    </TableCell>
                  </TableRow>
                )}
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium text-sm">{item.descricao}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{item.prof_id ? "Profissional" : "N/A"}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{formatBRL(item.valor)}</TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" onClick={() => removeItem(item.id)} className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="p-4 bg-secondary/20 flex justify-between items-center">
              <span className="font-bold text-sm tracking-wider uppercase">Total a Pagar</span>
              <span className="text-2xl font-display font-bold bs-gold-text">{formatBRL(command.valor)}</span>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bs-card p-5 space-y-4">
            <h3 className="font-bold text-xs uppercase tracking-widest text-muted-foreground">Resumo do Cliente</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Cliente</span>
                <span className="font-semibold uppercase">{command.cliente_nome}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Consumo total</span>
                <span className="font-semibold">{formatBRL(command.valor)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Status</span>
                <span className="text-primary font-bold uppercase text-[10px]">{command.status}</span>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" className="h-20 flex flex-col gap-2" onClick={() => setOpenAddItem(true)}>
              <Plus className="h-5 w-5" />
              <span className="text-[10px] uppercase font-bold">Add Produto</span>
            </Button>
            <Button variant="outline" className="h-20 flex flex-col gap-2" onClick={() => setOpenAddItem(true)}>
              <Receipt className="h-5 w-5" />
              <span className="text-[10px] uppercase font-bold">Add Serviço</span>
            </Button>
          </div>
        </div>
      </div>

      {openAddItem && <AddItemDialog commandId={id} onClose={() => setOpenAddItem(false)} onSaved={() => {
        setOpenAddItem(false);
        qc.invalidateQueries({ queryKey: ["command", id] });
        qc.invalidateQueries({ queryKey: ["command-items", id] });
      }} />}

      {openPay && <PaymentDialog command={command} items={items} onClose={() => setOpenPay(false)} onPaid={() => {
        setOpenPay(false);
        navigate({ to: "/comandas" });
      }} />}
    </div>
  );
}

function AddItemDialog({ commandId, onClose, onSaved }: { commandId: string; onClose: () => void; onSaved: () => void }) {
  const [tipo, setTipo] = useState<"servico" | "produto">("servico");
  const [itemId, setItemId] = useState("");
  const [profId, setProfId] = useState("");
  const [valorManual, setValorManual] = useState("");
  const [quantidade, setQuantidade] = useState("1");
  const [descManual, setDescManual] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: pros = [] } = useQuery({
    queryKey: ["pros-items"],
    queryFn: async () => {
      const { data } = await supabase.from("professionals").select("id, nome").eq("ativo", true);
      return data ?? [];
    },
  });

  const { data: svcs = [] } = useQuery({
    queryKey: ["svcs-items"],
    queryFn: async () => {
      const { data } = await supabase.from("services").select("id, nome, preco, duracao, ordem").eq("ativo", true).order("ordem");
      return data ?? [];
    },
  });

  const { data: prods = [] } = useQuery({
    queryKey: ["prods-items"],
    queryFn: async () => {
      const { data } = await supabase.from("stock_items").select("id, nome, preco_venda").order("nome");
      return data ?? [];
    },
  });

  const save = async () => {
    let desc = descManual;
    let v = Number(valorManual);
    const q = Number(quantidade) || 1;

    if (itemId) {
      if (tipo === "servico") {
        const s = svcs.find(x => x.id === itemId);
        desc = s?.nome || "";
        v = Number(s?.preco || 0) * q;
      } else {
        const p = prods.find(x => x.id === itemId);
        desc = p?.nome || "";
        v = Number(p?.preco_venda || 0) * q;
      }
    } else {
      v = v * q;
    }

    if (!desc || !v) return toast.error("Preencha descrição e valor");

    setSaving(true);

    if (tipo === "produto" && itemId) {
      const { error: stockErr } = await supabase.from("stock_movements").insert({
        item_id: itemId,
        tipo: "saida",
        quantidade: q,
        motivo: `Comanda #${commandId}`
      });
      if (stockErr) {
        setSaving(false);
        return toast.error("Erro ao baixar estoque: " + stockErr.message);
      }
    }

    const { error } = await supabase.from("command_items").insert({
      command_id: commandId,
      descricao: q > 1 ? `${q}x ${desc}` : desc,
      valor: v,
      prof_id: profId ? Number(profId) : null,
      tipo: tipo === "servico" ? "servico" : "produto"
    });

    if (error) {
      setSaving(false);
      return toast.error(error.message);
    }

    const { data: currentItems } = await supabase.from("command_items").select("valor").eq("command_id", commandId);
    const newTotal = (currentItems ?? []).reduce((s, i) => s + Number(i.valor), 0);
    await supabase.from("commands").update({ valor: newTotal }).eq("id", commandId);

    setSaving(false);
    onSaved();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bs-card max-w-sm">
        <DialogHeader><DialogTitle className="font-display">Adicionar Item</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-2 bg-secondary/50 p-1 rounded-md">
            <button onClick={() => { setTipo("servico"); setItemId(""); }} className={`py-1.5 text-xs font-bold uppercase rounded ${tipo === "servico" ? "bg-primary text-background" : "text-muted-foreground"}`}>Serviço</button>
            <button onClick={() => { setTipo("produto"); setItemId(""); }} className={`py-1.5 text-xs font-bold uppercase rounded ${tipo === "produto" ? "bg-primary text-background" : "text-muted-foreground"}`}>Produto</button>
          </div>

          <div className="grid gap-1">
            <Label>{tipo === "servico" ? "Serviço" : "Produto"}</Label>
            <Select value={itemId} onValueChange={setItemId}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {(tipo === "servico" ? svcs : prods).map((x: any) => (
                  <SelectItem key={x.id} value={x.id}>{x.nome} · {formatBRL(x.preco || x.preco_venda)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1">
            <Label>Quantidade</Label>
            <Input type="number" min="1" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} />
          </div>


          {tipo === "servico" && (
            <div className="grid gap-1">
              <Label>Barbeiro (Opcional)</Label>
              <Select value={profId} onValueChange={setProfId}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {pros.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="pt-2 border-t border-border/40">
            <p className="text-[10px] text-muted-foreground uppercase mb-2">Ou adicione manualmente</p>
            <div className="grid gap-3">
              <div className="grid gap-1"><Label>Descrição</Label><Input value={descManual} onChange={(e) => setDescManual(e.target.value)} disabled={!!itemId} /></div>
              <div className="grid gap-1"><Label>Valor</Label><Input type="number" value={valorManual} onChange={(e) => setValorManual(e.target.value)} disabled={!!itemId} /></div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button className="bs-btn-primary border-0" disabled={saving} onClick={save}>Adicionar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PaymentDialog({ command, items, onClose, onPaid }: { command: any; items: any[]; onClose: () => void; onPaid: () => void }) {
  const [method, setMethod] = useState("dinheiro");
  const [received, setReceived] = useState(String(command.valor));
  const [saving, setSaving] = useState(false);

  const total = Number(command.valor);
  const rec = Number(received);
  const change = Math.max(0, rec - total);

  const confirmPay = async () => {
    // Verificar se o caixa está aberto antes de permitir o pagamento
    const { data: caixa } = await supabase.from("cash_registers").select("id").eq("data", todayYMD()).eq("status", "aberto").maybeSingle();
    
    if (!caixa) {
      toast.error("O CAIXA DO DIA ESTÁ FECHADO!", {
        description: "ABRA O CAIXA NO PAINEL FINANCEIRO ANTES DE RECEBER PAGAMENTOS."
      });
      return;
    }

    setSaving(true);
    
    // 1. Fechar comanda
    const { error: err1 } = await supabase.from("commands").update({
      status: "paga",
      fechamento: new Date().toISOString(),
      forma_pagamento: method,
      valor_recebido: rec,
      troco: change
    }).eq("id", command.id);

    if (err1) { setSaving(false); return toast.error(err1.message); }

    // 2. Registrar no movimento de caixa (já garantimos que o caixa está aberto acima)
    await supabase.from("cash_movements").insert({
      cash_id: caixa.id,
      tipo: "entrada",
      descricao: `VENDA COMANDA #${command.numero} - ${command.cliente_nome}`,
      valor: total,
      forma_pagamento: method
    });

    // 3. Registrar transação geral
    await supabase.from("transactions").insert({
      tipo: "entrada",
      categoria: "VENDA DE SERVIÇOS/PRODUTOS",
      descricao: `VENDA COMANDA #${command.numero} - ${command.cliente_nome}`,
      valor: total,
      data: new Date().toISOString().slice(0, 10),
      forma_pagamento: method
    });

    toast.success("VENDA GERADA E PAGAMENTO FINALIZADO!");
    onPaid();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bs-card max-w-md">
        <DialogHeader><DialogTitle className="font-display">Finalizar Comanda #{command.numero}</DialogTitle></DialogHeader>
        <div className="grid gap-6 py-4">
          <div className="flex justify-between items-center bg-secondary/30 p-4 rounded-lg">
            <span className="text-sm uppercase font-bold text-muted-foreground">Valor Total</span>
            <span className="text-3xl font-display font-bold bs-gold-text">{formatBRL(total)}</span>
          </div>

          <div className="grid gap-2">
            <Label>Forma de Pagamento</Label>
            <div className="grid grid-cols-3 gap-2">
              <PaymentBtn active={method === "dinheiro"} onClick={() => setMethod("dinheiro")} icon={<Banknote className="h-5 w-5" />} label="Dinheiro" />
              <PaymentBtn active={method === "pix"} onClick={() => setMethod("pix")} icon={<QrCode className="h-5 w-5" />} label="PIX" />
              <PaymentBtn active={method === "cartao"} onClick={() => setMethod("cartao")} icon={<CreditCard className="h-5 w-5" />} label="Cartão" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1">
              <Label>Valor Recebido</Label>
              <Input type="number" step="0.01" value={received} onChange={(e) => setReceived(e.target.value)} />
            </div>
            <div className="grid gap-1">
              <Label>Troco</Label>
              <div className="h-10 flex items-center px-3 bg-secondary rounded-md font-mono text-success font-bold">
                {formatBRL(change)}
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Voltar</Button>
          <Button className="bs-btn-primary border-0 h-12 text-base font-bold flex-1" disabled={saving} onClick={confirmPay}>
            {saving ? "Processando..." : "FINALIZAR PAGAMENTO"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PaymentBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: any; label: string }) {
  return (
    <button onClick={onClick} className={`bs-card p-3 flex flex-col items-center gap-2 transition-all ${active ? "ring-2 ring-primary bg-primary/5" : "hover:border-primary/40"}`}>
      <span className={active ? "text-primary" : "text-muted-foreground"}>{icon}</span>
      <span className={`text-[10px] font-bold uppercase ${active ? "bs-gold-text" : "text-muted-foreground"}`}>{label}</span>
    </button>
  );
}
