import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { StatusBadge } from "@/components/StatusBadge";
import { NovoAgendamentoDialog } from "@/components/NovoAgendamentoDialog";
import { formatBRL, generateSlots, todayYMD } from "@/lib/format";
import { ChevronLeft, ChevronRight, Plus, Trash2, Printer, Loader2 } from "lucide-react";

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
  const [selectedPro, setSelectedPro] = useState<number | null>(null);

  const { data: pros = [], isLoading: loadingPros } = useQuery({
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

  const { data: settings, isLoading: loadingSettings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("settings").select("*").maybeSingle();
      if (error) throw error;
      return data as Setting;
    },
  });

  const { data: appts = [], isLoading: loadingAppts } = useQuery({
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

  const isLoading = loadingPros || loadingSettings || loadingAppts;

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

      <div className="bs-card overflow-auto rounded-xl">
        <div className="hidden md:block min-w-[800px] grid" style={{
          gridTemplateColumns: `68px repeat(${pros.length}, 1fr)`,
        }}>
          <div className="sticky top-0 z-10 bg-[#1a1408] border-b border-amber-800/40 p-2.5 text-[11px] font-bold text-amber-500/60 uppercase tracking-[0.15em] flex items-center justify-center">Hora</div>
          {pros.map((p, i) => (
            <div key={p.id} className={`sticky top-0 z-10 bg-[#1a1408] border-b border-amber-800/40 ${i > 0 ? 'border-l border-amber-800/20' : ''} p-2.5 flex items-center gap-2.5`}>
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold shadow-sm"
                style={{ backgroundColor: p.cor, color: "#0e0a05" }}>{p.avatar}</span>
              <span className="text-sm font-bold tracking-wide">{p.nome}</span>
            </div>
          ))}
          {slots.map((h, idx) => (
            <SlotRow key={h} h={h} idx={idx} pros={pros} cellMap={apptByCell}
              onEmpty={(prof_id) => setAgendar({ prof_id, hora: h })}
              onAppt={(a) => setOpenDetail(a)}
            />
          ))}
        </div>

        <div className="block md:hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <MobileAgenda
              pros={pros}
              slots={slots}
              apptByCell={apptByCell}
              selectedPro={selectedPro}
              onSelectPro={setSelectedPro}
              onEmpty={(prof_id, hora) => setAgendar({ prof_id, hora })}
              onAppt={setOpenDetail}
            />
          )}
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

function MobileAgenda({ pros, slots, apptByCell, selectedPro, onSelectPro, onEmpty, onAppt }: {
  pros: Pro[]; slots: string[]; apptByCell: Map<string, Appt>;
  selectedPro: number | null; onSelectPro: (id: number | null) => void;
  onEmpty: (prof_id: number, hora: string) => void;
  onAppt: (a: Appt) => void;
}) {
  const currentPro = selectedPro ?? pros[0]?.id ?? null;

  return (
    <div>
      <ScrollArea className="w-full pb-2">
        <div className="flex gap-1.5 px-1 pt-2 pb-1">
          {pros.map((p) => (
            <button key={p.id}
              onClick={() => onSelectPro(p.id === currentPro ? null : p.id)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium transition-all ${
                p.id === currentPro
                  ? "text-black font-bold shadow-md scale-105"
                  : "bg-black/20 text-muted-foreground/70 border border-border/40"
              }`}
              style={p.id === currentPro ? { backgroundColor: p.cor } : undefined}
            >
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold"
                style={{ backgroundColor: p.cor, color: "#0e0a05" }}>{p.avatar}</span>
              {p.nome}
            </button>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      <div className="divide-y divide-border/50">
        {slots.map((h) => {
          const appt = currentPro ? apptByCell.get(`${currentPro}|${h}`) : null;
          const pro = pros.find(p => p.id === currentPro);
          return (
            <button key={h}
              onClick={() => appt ? onAppt(appt) : currentPro && onEmpty(currentPro, h)}
              className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-all ${
                appt
                  ? "hover:brightness-110"
                  : "hover:bg-amber-500/5"
              }`}
              style={appt ? {
                background: `linear-gradient(135deg, ${pro?.cor}15 0%, transparent 100%)`,
                borderLeft: `4px solid ${pro?.cor ?? '#d4a853'}`,
              } : undefined}
            >
              <span className="text-xs font-mono text-muted-foreground w-12 shrink-0 font-bold">{h}</span>
              {appt ? (
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold truncate">{appt.cliente}</span>
                    <StatusBadge status={appt.status} />
                  </div>
                  <div className="text-xs text-muted-foreground/80 truncate">{appt.servico} · R$ {appt.valor.toFixed(2)}</div>
                </div>
              ) : (
                <span className="text-xs text-amber-500/40 font-medium opacity-0 group-hover:opacity-100">Toque para agendar</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SlotRow({ h, idx, pros, cellMap, onEmpty, onAppt }: {
  h: string; idx: number; pros: Pro[];
  cellMap: Map<string, Appt>;
  onEmpty: (prof_id: number) => void;
  onAppt: (a: Appt) => void;
}) {
  const isEven = idx % 2 === 0;
  return (
    <>
      <div className={`border-b border-border/60 p-2 text-xs text-muted-foreground font-mono flex items-center justify-center ${isEven ? 'bg-background/30' : 'bg-black/10'}`}>{h}</div>
      {pros.map((p, pi) => {
        const a = cellMap.get(`${p.id}|${h}`);
        const isFirst = pi === 0;
        return (
          <button key={p.id}
            onClick={() => (a ? onAppt(a) : onEmpty(p.id))}
            className={`border-b border-border/60 ${isFirst ? '' : 'border-l border-border/30'} p-1.5 text-left transition-all duration-150 min-h-[58px] group ${
              isEven ? 'bg-background/30' : 'bg-black/10'
            } ${a
              ? 'hover:brightness-110 cursor-pointer'
              : 'hover:bg-black/20 cursor-pointer'
            }`}
            style={a ? {
              background: `linear-gradient(135deg, ${p.cor}18 0%, ${p.cor}08 100%)`,
              borderLeft: isFirst ? undefined : `3px solid ${p.cor}55`,
            } : undefined}
          >
            {a ? (
              <div className="space-y-0.5 px-1">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-bold truncate leading-tight">{a.cliente}</span>
                  {a.status !== 'agendado' && (
                    <span className={`shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                      a.status === 'confirmado' ? 'bg-emerald-500/20 text-emerald-400' :
                      a.status === 'cancelado' ? 'bg-red-500/20 text-red-400' :
                      a.status === 'concluido' ? 'bg-blue-500/20 text-blue-400' :
                      'bg-amber-500/20 text-amber-400'
                    }`}>
                      {a.status === 'confirmado' ? 'Conf' : a.status === 'cancelado' ? 'X' : a.status === 'concluido' ? 'OK' : a.status.slice(0, 3)}
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-muted-foreground/80 truncate leading-tight font-medium">{a.servico}</div>
                <div className="flex items-center gap-1 text-[9px] text-muted-foreground/50">
                  <span>{a.hora.slice(0, 5)}</span>
                  <span>·</span>
                  <span>R$ {a.valor.toFixed(2)}</span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full w-full px-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                <span className="text-[10px] font-bold text-amber-500/60 uppercase tracking-wider">+ Agendar</span>
              </div>
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
