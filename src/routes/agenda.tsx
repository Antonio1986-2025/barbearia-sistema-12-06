import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/StatusBadge";
import { NovoAgendamentoDialog } from "@/components/NovoAgendamentoDialog";
import { formatBRL, generateSlots, todayYMD } from "@/lib/format";
import { ChevronLeft, ChevronRight, Plus, Trash2, Printer } from "lucide-react";

import { toast } from "sonner";

export const Route = createFileRoute("/agenda")({
  head: () => ({ meta: [{ title: "Agenda — Barbearia Status" }] }),
  component: AgendaPage,
});

type Pro = { id: number; nome: string; cor: string; avatar: string; ativo: boolean; ordem: number };
type Svc = { id: string; nome: string; duracao: number; preco: number };
type Setting = { horario_inicio: string; horario_fim: string; slot_minutos: number; dias_funcionamento: number[] };
type Appt = {
  id: string; prof_id: number; data: string; hora: string; duracao: number;
  servico: string; cliente: string; tel: string; valor: number; status: string;
  observacao: string | null; origem: string;
};

function AgendaPage() {
  const qc = useQueryClient();
  const [data, setData] = useState(todayYMD());
  const [agendar, setAgendar] = useState<{ prof_id?: number; hora?: string } | null>(null);
  const [openDetail, setOpenDetail] = useState<Appt | null>(null);

  const { data: pros = [] } = useQuery({
    queryKey: ["professionals"],
    queryFn: async () => {
      const { data, error } = await supabase.from("professionals").select("*").eq("ativo", true).order("ordem");
      if (error) throw error;
      return data as Pro[];
    },
  });

  const { data: svcs = [] } = useQuery({
    queryKey: ["services"],
    queryFn: async () => {
      const { data, error } = await supabase.from("services").select("id, nome, preco, duracao, ordem").eq("ativo", true).order("ordem");
      if (error) throw error;
      return data as Svc[];
    },
  });

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("settings").select("*").maybeSingle();
      if (error) throw error;
      return data as Setting;
    },
  });

  const { data: appts = [] } = useQuery({
    queryKey: ["appts", data],
    queryFn: async () => {
      const { data: rows, error } = await supabase.from("appointments").select("*").eq("data", data);
      if (error) throw error;
      return rows as Appt[];
    },
  });

  const slots = useMemo(
    () => (settings ? generateSlots(settings.horario_inicio, settings.horario_fim, settings.slot_minutos) : []),
    [settings],
  );

  const apptByCell = useMemo(() => {
    const m = new Map<string, Appt>();
    appts.forEach((a) => m.set(`${a.prof_id}|${a.hora.slice(0, 5)}`, a));
    return m;
  }, [appts]);

  const move = (days: number) => {
    const d = new Date(data + "T00:00:00");
    d.setDate(d.getDate() + days);
    setData(d.toISOString().slice(0, 10));
  };

  const refresh = () => qc.invalidateQueries({ queryKey: ["appts"] });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold bs-gold-text">Agenda</h1>
          <p className="text-sm text-muted-foreground">Visão diária por profissional</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bs-card p-1">
            <Button size="icon" variant="ghost" onClick={() => move(-1)} title="Anterior"><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="ghost" className="text-xs h-8 px-2" onClick={() => setData(todayYMD())}>Hoje</Button>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} className="w-40 border-0 bg-transparent text-sm h-8" />
            <Button size="icon" variant="ghost" onClick={() => move(1)} title="Próximo"><ChevronRight className="h-4 w-4" /></Button>
          </div>
          <Button className="bs-btn-primary border-0 h-10 font-semibold" onClick={() => setAgendar({})}>
            <Plus className="h-4 w-4 mr-1" /> Agendar
          </Button>
        </div>
      </div>

      <div className="bs-card overflow-auto">
        <div className="min-w-[720px] grid" style={{ gridTemplateColumns: `80px repeat(${pros.length}, 1fr)` }}>
          <div className="sticky top-0 z-10 bg-card border-b border-border p-3 text-xs font-semibold text-muted-foreground uppercase">Hora</div>
          {pros.map((p) => (
            <div key={p.id} className="sticky top-0 z-10 bg-card border-b border-l border-border p-3 flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold"
                style={{ backgroundColor: p.cor, color: "#0e0a05" }}>{p.avatar}</span>
              <div className="text-sm font-medium">{p.nome}</div>
            </div>
          ))}
          {slots.map((h) => (
            <SlotRow key={h} h={h} pros={pros} cellMap={apptByCell}
              onEmpty={(prof_id) => setAgendar({ prof_id, hora: h })}
              onAppt={(a) => setOpenDetail(a)}
            />
          ))}
        </div>
      </div>

      <NovoAgendamentoDialog
        open={!!agendar}
        onClose={() => setAgendar(null)}
        pros={pros}
        svcs={svcs}
        settings={settings}
        initial={agendar ? { prof_id: agendar.prof_id, hora: agendar.hora, data } : undefined}
        onSaved={() => { refresh(); setAgendar(null); }}
      />

      {openDetail && (
        <ApptDetailDialog
          appt={openDetail} onClose={() => setOpenDetail(null)}
          onChanged={() => { refresh(); setOpenDetail(null); }}
        />
      )}
      {openDetail && (
        <div className="print-grid">
          <div className="print-label">
            <div className="text-[6px] font-bold">Barbearia Status</div>
            <div className="text-[8px] font-black">{openDetail.cliente}</div>
            <div className="text-[7px]">{openDetail.data} - {openDetail.hora.slice(0, 5)}</div>
            <div className="text-[6px] truncate w-full">{openDetail.servico}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function SlotRow({ h, pros, cellMap, onEmpty, onAppt }: {
  h: string; pros: Pro[];
  cellMap: Map<string, Appt>;
  onEmpty: (prof_id: number) => void;
  onAppt: (a: Appt) => void;
}) {
  return (
    <>
      <div className="border-b border-border p-2 text-xs text-muted-foreground font-mono">{h}</div>
      {pros.map((p) => {
        const a = cellMap.get(`${p.id}|${h}`);
        return (
          <button key={p.id}
            onClick={() => (a ? onAppt(a) : onEmpty(p.id))}
            className={`border-b border-l border-border p-2 text-left transition-colors min-h-[56px] ${
              a ? "hover:brightness-110" : "hover:bg-secondary/40"
            }`}
            style={a ? { backgroundColor: `${p.cor}22`, borderLeft: `3px solid ${p.cor}` } : undefined}
          >
            {a ? (
              <div className="space-y-1">
                <div className="text-xs font-semibold truncate">{a.cliente}</div>
                <div className="text-[11px] text-muted-foreground truncate">{a.servico}</div>
                <StatusBadge status={a.status} />
              </div>
            ) : (
              <span className="text-[11px] text-muted-foreground/40">+ Livre</span>
            )}
          </button>
        );
      })}
    </>
  );
}

function ApptDetailDialog({ appt, onClose, onChanged }: {
  appt: Appt; onClose: () => void; onChanged: () => void;
}) {
  const [saving, setSaving] = useState(false);

  const updateStatus = async (newStatus: string) => {
    setSaving(true);
    const { error } = await supabase.from("appointments").update({ status: newStatus }).eq("id", appt.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Status atualizado");
    onChanged();
  };

  const remove = async () => {
    if (!confirm("Excluir agendamento?")) return;
    const { error } = await supabase.from("appointments").delete().eq("id", appt.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Excluído");
    onChanged();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bs-card">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            {appt.cliente} <StatusBadge status={appt.status} />
          </DialogTitle>
        </DialogHeader>
        <div className="text-sm space-y-2 no-print">
          <div><b>Serviço:</b> {appt.servico}</div>
          <div><b>Data/Hora:</b> {appt.data} às {appt.hora.slice(0, 5)} ({appt.duracao}min)</div>
          <div><b>Telefone:</b> {appt.tel}</div>
          <div><b>Valor:</b> {formatBRL(appt.valor)}</div>
          {appt.observacao && <div><b>Obs:</b> {appt.observacao}</div>}
          <div className="text-xs text-muted-foreground">Origem: {appt.origem}</div>
        </div>

        <DialogFooter className="flex flex-wrap gap-2 no-print">
          <Button variant="outline" size="icon" onClick={() => window.print()} title="Imprimir Etiqueta">
            <Printer className="h-4 w-4" />
          </Button>
          <Button variant="outline" disabled={saving} onClick={() => updateStatus("cancelado")}>Cancelar</Button>
          <Button variant="destructive" size="icon" onClick={remove}><Trash2 className="h-4 w-4" /></Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
