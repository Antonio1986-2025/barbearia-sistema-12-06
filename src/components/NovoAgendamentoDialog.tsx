import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { formatBRL, generateSlots, maskPhone, todayYMD } from "@/lib/format";
import { User, Baby, Smile } from "lucide-react";
import { toast } from "sonner";

export type Pro = { id: number; nome: string; cor: string; avatar: string };
export type Svc = { id: string; nome: string; duracao: number; preco: number };
export type Setting = {
  horario_inicio: string; horario_fim: string; slot_minutos: number;
  dias_funcionamento: number[];
};
type Para = "mim" | "filho" | "amigo";

/**
 * Diálogo único e padronizado de agendamento (admin).
 * Segue o mesmo padrão do fluxo público (/agendar): "para quem", validação de
 * disponibilidade (bloqueia horários ocupados e passados) e abertura automática
 * de comanda. É a única fonte de verdade para criação de agendamento no admin —
 * usado tanto pelo botão "Agendar" quanto pelo clique em um horário vago.
 */
export function NovoAgendamentoDialog({
  open, onClose, pros, svcs, settings, initial, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  pros: Pro[];
  svcs: Svc[];
  settings?: Setting;
  initial?: { prof_id?: number; hora?: string; data?: string };
  onSaved: () => void;
}) {
  const [nome, setNome] = useState("");
  const [tel, setTel] = useState("");
  const [para, setPara] = useState<Para>("mim");
  const [dependenteNome, setDependenteNome] = useState("");
  const [profId, setProfId] = useState<string>("");
  const [svcId, setSvcId] = useState<string>("");
  const [data, setData] = useState(todayYMD());
  const [hora, setHora] = useState("");
  const [obs, setObs] = useState("");
  const [saving, setSaving] = useState(false);

  // Reinicia o formulário sempre que o diálogo abre, aplicando os valores iniciais.
  useEffect(() => {
    if (!open) return;
    setNome(""); setTel(""); setPara("mim"); setDependenteNome("");
    setProfId(initial?.prof_id ? String(initial.prof_id) : "");
    setSvcId("");
    setData(initial?.data ?? todayYMD());
    setHora(initial?.hora ?? "");
    setObs("");
    setSaving(false);
  }, [open, initial?.prof_id, initial?.hora, initial?.data]);

  const svc = svcs.find((s) => s.id === svcId);
  const pro = pros.find((p) => String(p.id) === profId);

  const slots = useMemo(
    () => (settings ? generateSlots(settings.horario_inicio, settings.horario_fim, settings.slot_minutos) : []),
    [settings],
  );

  // Horários já ocupados para o profissional/data selecionados (exceto cancelados).
  const { data: occupied = [] } = useQuery<string[]>({
    queryKey: ["appts-occupied", profId, data],
    enabled: open && !!profId && !!data,
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("appointments")
        .select("hora")
        .eq("prof_id", Number(profId))
        .eq("data", data)
        .neq("status", "cancelado");
      if (error) throw error;
      return (rows as { hora: string }[]).map((r) => r.hora.slice(0, 5));
    },
  });

  const isToday = data === todayYMD();
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const slotIsPast = (s: string) => {
    if (!isToday) return false;
    const [h, m] = s.split(":").map(Number);
    return h * 60 + m <= nowMin;
  };
  const slotTaken = (s: string) => occupied.includes(s) || slotIsPast(s);

  // Limpa o horário caso ele deixe de estar disponível (troca de profissional/data).
  useEffect(() => {
    if (hora && slotTaken(hora)) setHora("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profId, data, occupied.join(",")]);

  const clienteFinal = para === "mim"
    ? nome.trim()
    : `${nome.trim()} · ${dependenteNome.trim()}`;

  const podeConfirmar =
    !!nome.trim() &&
    tel.replace(/\D/g, "").length >= 10 &&
    (para === "mim" || !!dependenteNome.trim()) &&
    !!pro && !!svc && !!data && !!hora && !slotTaken(hora);

  const submit = async () => {
    if (!pro || !svc || !hora) {
      toast.error("Preencha cliente, telefone, barbeiro, serviço e horário");
      return;
    }
    if (slotTaken(hora)) {
      toast.error("Horário indisponível. Escolha outro.");
      return;
    }
    setSaving(true);
    try {
      // 0. Garantir cliente único (upsert por telefone como chave natural).
      // Salva apenas números para evitar duplicação por formatação diferente.
      const cleanPhone = tel.replace(/\D/g, "");
      const { data: client, error: clientError } = await supabase
        .from("clients")
        .upsert(
          { nome: nome.trim(), tel: cleanPhone, visitas: 0, total_gasto: 0 },
          { onConflict: "tel", ignoreDuplicates: false }
        )
        .select("id")
        .single();
      
      if (clientError) throw clientError;

      // 1. Criar o agendamento (também salva telefone limpo para consistência).
      const { data: appt, error: apptError } = await supabase
        .from("appointments").insert({
          prof_id: pro.id, data, hora,
          servico: svc.nome, servico_id: svc.id, duracao: svc.duracao, valor: svc.preco,
          cliente: clienteFinal, tel: cleanPhone,
          dependente_nome: para === "mim" ? null : dependenteNome.trim(),
          observacao: obs.trim() || null,
          status: "agendado", origem: "admin",
        }).select().single();
      if (apptError) throw apptError;

      // 2. Abrir comanda automaticamente com o serviço como primeiro item.
      const { data: lastCmd } = await supabase
        .from("commands").select("numero")
        .order("numero", { ascending: false }).limit(1).maybeSingle();
      const nextNum = (lastCmd?.numero || 0) + 1;

      const { data: cmd, error: cmdError } = await supabase
        .from("commands").insert({
          numero: nextNum,
          cliente_nome: clienteFinal,
          status: "aberta",
          abertura: new Date().toISOString(),
          valor: Number(svc.preco),
        }).select().single();

      if (!cmdError && cmd) {
        await supabase.from("command_items").insert({
          command_id: cmd.id,
          descricao: svc.nome,
          valor: Number(svc.preco),
          prof_id: pro.id,
          tipo: "servico",
        });
      }

      setSaving(false);
      toast.success("Agendamento criado e comanda aberta");
      onSaved();
    } catch (error: any) {
      setSaving(false);
      toast.error(error.message || "Erro ao processar agendamento");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bs-card max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">Novo agendamento</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          {/* Cliente + WhatsApp */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="grid gap-1">
              <Label>Cliente</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome completo" />
            </div>
            <div className="grid gap-1">
              <Label>WhatsApp</Label>
              <Input value={tel} onChange={(e) => setTel(maskPhone(e.target.value))} placeholder="(67) 99999-9999" inputMode="tel" />
            </div>
          </div>

          {/* Para quem */}
          <div className="grid gap-1">
            <Label>Agendar para</Label>
            <div className="grid grid-cols-3 gap-2">
              <ParaBtn active={para === "mim"} onClick={() => setPara("mim")} icon={<User className="h-4 w-4" />} label="O cliente" />
              <ParaBtn active={para === "filho"} onClick={() => setPara("filho")} icon={<Baby className="h-4 w-4" />} label="Filho(a)" />
              <ParaBtn active={para === "amigo"} onClick={() => setPara("amigo")} icon={<Smile className="h-4 w-4" />} label="Outro" />
            </div>
          </div>
          {para !== "mim" && (
            <div className="grid gap-1">
              <Label>{para === "filho" ? "Nome da criança" : "Nome da pessoa"}</Label>
              <Input value={dependenteNome} onChange={(e) => setDependenteNome(e.target.value)} placeholder="Nome completo" />
            </div>
          )}

          {/* Barbeiro + Serviço */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="grid gap-1">
              <Label>Barbeiro</Label>
              <Select value={profId} onValueChange={setProfId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {pros.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1">
              <Label>Serviço</Label>
              <Select value={svcId} onValueChange={setSvcId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {svcs.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.nome} · {s.duracao}min · {formatBRL(s.preco)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Data */}
          <div className="grid gap-1">
            <Label>Data</Label>
            <Input type="date" value={data} min={todayYMD()} onChange={(e) => setData(e.target.value)} />
          </div>

          {/* Horários disponíveis */}
          <div className="grid gap-1">
            <Label>Horário</Label>
            {!profId ? (
              <p className="text-xs text-muted-foreground">Selecione o barbeiro para ver os horários.</p>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {slots.map((s) => {
                  const taken = slotTaken(s);
                  const active = hora === s;
                  return (
                    <button
                      key={s} type="button" disabled={taken} onClick={() => setHora(s)}
                      className={`h-10 rounded-md border text-sm font-mono transition-colors ${
                        active ? "bs-btn-primary border-0"
                          : taken ? "border-border/40 text-muted-foreground/40 cursor-not-allowed line-through"
                            : "border-border hover:border-primary/50 hover:bg-secondary"
                      }`}
                    >
                      {s}
                    </button>
                  );
                })}
                {slots.length === 0 && (
                  <div className="col-span-4 text-sm text-muted-foreground">
                    Configure os horários de funcionamento em Configurações.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Observação */}
          <div className="grid gap-1">
            <Label>Observação (opcional)</Label>
            <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} />
          </div>

          {/* Resumo / total */}
          {svc && (
            <div className="flex items-center justify-between rounded-md bg-secondary/40 px-3 py-2">
              <span className="text-xs tracking-wider text-muted-foreground">TOTAL</span>
              <span className="font-display text-xl bs-gold-text font-bold">{formatBRL(svc.preco)}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button className="bs-btn-primary border-0" disabled={saving || !podeConfirmar} onClick={submit}>
            {saving ? "Salvando..." : "Confirmar agendamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ParaBtn({ active, onClick, icon, label }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string;
}) {
  return (
    <button
      type="button" onClick={onClick}
      className={`bs-card py-2 px-2 flex flex-col items-center gap-1 transition-all ${
        active ? "ring-2 ring-primary" : "hover:border-primary/40"
      }`}
    >
      <span className={active ? "text-primary" : "text-foreground/70"}>{icon}</span>
      <span className={`text-[11px] font-medium ${active ? "bs-gold-text" : "text-foreground/80"}`}>{label}</span>
    </button>
  );
}
