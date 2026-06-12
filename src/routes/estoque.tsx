import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatBRL } from "@/lib/format";
import { Plus, AlertTriangle, ArrowUpCircle, ArrowDownCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/estoque")({
  head: () => ({ meta: [{ title: "Estoque — Barbearia Status" }] }),
  component: EstoquePage,
});

type Item = { id: string; nome: string; unidade: string; quantidade: number; minimo: number; custo: number; preco_venda: number; ativo: boolean };

function EstoquePage() {
  const qc = useQueryClient();
  const [openNew, setOpenNew] = useState(false);
  const [openMov, setOpenMov] = useState<Item | null>(null);

  const { data: items = [] } = useQuery({
    queryKey: ["stock-items"],
    queryFn: async () => {
      const { data, error } = await supabase.from("stock_items").select("*").order("nome");
      if (error) throw error;
      return data as Item[];
    },
  });

  const lowStock = items.filter((i) => Number(i.quantidade) <= Number(i.minimo));

  const remove = async (id: string) => {
    if (!confirm("Excluir item?")) return;
    const { error } = await supabase.from("stock_items").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["stock-items"] });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold bs-gold-text">Estoque</h1>
          <p className="text-sm text-muted-foreground">{items.length} produtos {lowStock.length > 0 && <span className="text-destructive">· {lowStock.length} abaixo do mínimo</span>}</p>
        </div>
        <Button className="bs-btn-primary border-0" onClick={() => setOpenNew(true)}><Plus className="h-4 w-4 mr-1" /> Novo item</Button>
      </div>

      <div className="bs-card overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead className="text-right">Quantidade</TableHead>
              <TableHead className="text-right">Mínimo</TableHead>
              <TableHead className="text-right">Custo</TableHead>
              <TableHead className="text-right">Venda</TableHead>
              <TableHead className="w-40 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Nenhum item cadastrado</TableCell></TableRow>}
            {items.map((i) => {
              const low = Number(i.quantidade) <= Number(i.minimo);
              return (
                <TableRow key={i.id}>
                  <TableCell className="font-medium flex items-center gap-2">
                    {low && <AlertTriangle className="h-4 w-4 text-destructive" />}
                    {i.nome}
                  </TableCell>
                  <TableCell className={`text-right font-mono ${low ? "text-destructive font-bold" : ""}`}>
                    {Number(i.quantidade)} {i.unidade}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground font-mono">{Number(i.minimo)}</TableCell>
                  <TableCell className="text-right font-mono">{formatBRL(i.custo)}</TableCell>
                  <TableCell className="text-right font-mono">{formatBRL(i.preco_venda)}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => setOpenMov(i)}>Movimentar</Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(i.id)}><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {openNew && <NewItemDialog onClose={() => setOpenNew(false)} onSaved={() => { setOpenNew(false); qc.invalidateQueries({ queryKey: ["stock-items"] }); }} />}
      {openMov && <MovDialog item={openMov} onClose={() => setOpenMov(null)} onSaved={() => { setOpenMov(null); qc.invalidateQueries({ queryKey: ["stock-items"] }); }} />}
    </div>
  );
}

function NewItemDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [nome, setNome] = useState("");
  const [unidade, setUnidade] = useState("un");
  const [quantidade, setQuantidade] = useState("0");
  const [minimo, setMinimo] = useState("0");
  const [custo, setCusto] = useState("0");
  const [precoVenda, setPrecoVenda] = useState("0");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!nome.trim()) return toast.error("Informe o nome");
    setSaving(true);
    const { error } = await supabase.from("stock_items").insert({
      nome: nome.trim(), unidade, quantidade: Number(quantidade), minimo: Number(minimo),
      custo: Number(custo), preco_venda: Number(precoVenda),
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Item cadastrado");
    onSaved();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bs-card">
        <DialogHeader><DialogTitle className="font-display">Novo Item de Estoque</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1"><Label>Nome</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1"><Label>Unidade</Label><Input value={unidade} onChange={(e) => setUnidade(e.target.value)} /></div>
            <div className="grid gap-1"><Label>Quantidade inicial</Label><Input type="number" step="0.01" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} /></div>
            <div className="grid gap-1"><Label>Mínimo</Label><Input type="number" step="0.01" value={minimo} onChange={(e) => setMinimo(e.target.value)} /></div>
            <div className="grid gap-1"><Label>Custo (R$)</Label><Input type="number" step="0.01" value={custo} onChange={(e) => setCusto(e.target.value)} /></div>
            <div className="grid gap-1 col-span-2"><Label>Preço de venda (R$)</Label><Input type="number" step="0.01" value={precoVenda} onChange={(e) => setPrecoVenda(e.target.value)} /></div>
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

function MovDialog({ item, onClose, onSaved }: { item: Item; onClose: () => void; onSaved: () => void }) {
  const [tipo, setTipo] = useState<"entrada" | "saida" | "ajuste">("entrada");
  const [quantidade, setQuantidade] = useState("");
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const q = Number(quantidade);
    if (!q && tipo !== "ajuste") return toast.error("Informe a quantidade");
    setSaving(true);
    const { error } = await supabase.from("stock_movements").insert({
      item_id: item.id, tipo, quantidade: q, motivo: motivo || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Movimentação registrada");
    onSaved();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bs-card">
        <DialogHeader><DialogTitle className="font-display">{item.nome} · estoque atual: {Number(item.quantidade)} {item.unidade}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1">
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as typeof tipo)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="entrada"><ArrowUpCircle className="h-3 w-3 inline mr-1" />Entrada (compra)</SelectItem>
                <SelectItem value="saida"><ArrowDownCircle className="h-3 w-3 inline mr-1" />Saída (venda)</SelectItem>
                <SelectItem value="ajuste">Ajuste de inventário</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1"><Label>Quantidade</Label><Input type="number" step="0.01" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} /></div>
          <div className="grid gap-1"><Label>Motivo (opcional)</Label><Input value={motivo} onChange={(e) => setMotivo(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button className="bs-btn-primary border-0" disabled={saving} onClick={save}>{saving ? "Salvando..." : "Confirmar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
