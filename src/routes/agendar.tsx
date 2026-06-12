import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatBRL, generateSlots, maskPhone, todayYMD, ymd, formatDateBR } from "@/lib/format";
import {
  CheckCircle2, ChevronLeft, ChevronRight, Scissors, User, Baby, Smile, Bell, CalendarDays,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/agendar")({
  head: () => ({ meta: [{ title: "Agendar Horário — Barbearia Status" }] }),
  component: AgendarPublic,
});

type Pro = { id: number; nome: string; categoria: string; cor: string; avatar: string; foto_url: string | null };
type Svc = { id: string; nome: string; duracao: number; preco: number; categoria: string };
type Para = "mim" | "filho" | "amigo";

const STEPS = 6;

function AgendarPublic() {
  const [step, setStep] = useState(1);
  const [nome, setNome] = useState("");
  const [tel, setTel] = useState("");
  const [para, setPara] = useState<Para>("mim");
  const [dependenteNome, setDependenteNome] = useState("");
  const [profId, setProfId] = useState<number | null>(null);
  const [svcId, setSvcId] = useState<string>("");
  const [data, setData] = useState(todayYMD());
  const [hora, setHora] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const { data: settings } = useQuery({
    queryKey: ["settings-public"],
    queryFn: async () => {
      const { data, error } = await supabase.from("settings").select("*").maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: pros = [] } = useQuery<Pro[]>({
    queryKey: ["pros-public"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("professionals")
        .select("id, nome, categoria, cor, avatar, foto_url")
        .eq("ativo", true).order("ordem");
      if (error) throw error;
      return data as Pro[];
    },
  });

  const { data: svcs = [] } = useQuery<Svc[]>({
    queryKey: ["svcs-public"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("id, nome, duracao, preco, categoria, ordem")
        .eq("ativo", true).order("ordem");
      if (error) throw error;
      return data as Svc[];
    },
  });

  const { data: occupied = [] } = useQuery<string[]>({
    queryKey: ["appts-public", profId, data],
    enabled: !!profId,
    queryFn: async () => {
      const { data: rows, error } = await supabase.from("appointments")
        .select("hora").eq("prof_id", profId!).eq("data", data).neq("status", "cancelado");
      if (error) throw error;
      return (rows as { hora: string }[]).map((r) => r.hora.slice(0, 5));
    },
  });

  const slots = useMemo(
    () => (settings ? generateSlots(settings.horario_inicio, settings.horario_fim, settings.slot_minutos) : []),
    [settings],
  );
  const isToday = data === todayYMD();
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const slotIsPast = (s: string) => {
    if (!isToday) return false;
    const [h, m] = s.split(":").map(Number);
    return h * 60 + m <= nowMin;
  };

  useEffect(() => setHora(""), [profId, data]);

  const svc = svcs.find((s) => s.id === svcId);
  const pro = pros.find((p) => p.id === profId);
  const clienteFinal = para === "mim"
    ? nome.trim()
    : `${nome.trim()} · ${dependenteNome.trim()}`;

  const reset = () => {
    setStep(1); setNome(""); setTel(""); setPara("mim"); setDependenteNome("");
    setProfId(null); setSvcId(""); setData(todayYMD()); setHora(""); setDone(false);
  };

  const submit = async () => {
    if (!pro || !svc || !hora) return;
    setSaving(true);
    
    try {
      // 0. Cadastrar/atualizar cliente (evitando duplicidade por telefone com upsert)
      const cleanPhone = tel.replace(/\D/g, "");
      await supabase.from("clients").upsert(
        {
          nome: nome.trim(),
          tel: cleanPhone,
          visitas: 0,
          total_gasto: 0
        },
        {
          onConflict: "tel",
          ignoreDuplicates: false
        }
      );

      // 1. Criar o agendamento (também salva telefone limpo)
      const { data: appt, error: apptError } = await supabase.from("appointments").insert({
        prof_id: pro.id, data, hora,
        servico: svc.nome, servico_id: svc.id, duracao: svc.duracao, valor: svc.preco,
        cliente: clienteFinal, tel: cleanPhone,
        dependente_nome: para === "mim" ? null : dependenteNome.trim(),
        status: "agendado", origem: "link",
      }).select().single();

      if (apptError) throw apptError;

      // 2. Abrir comanda automaticamente
      const { data: lastCmd } = await supabase.from("commands")
        .select("numero")
        .order("numero", { ascending: false })
        .limit(1)
        .maybeSingle();
      
      const nextNum = (lastCmd?.numero || 0) + 1;

      const { data: cmd, error: cmdError } = await supabase.from("commands").insert({
        numero: nextNum,
        cliente_nome: clienteFinal,
        status: "aberta",
        abertura: new Date().toISOString(),
        valor: Number(svc.preco)
      }).select().single();

      if (!cmdError && cmd) {
        await supabase.from("command_items").insert({
          command_id: cmd.id,
          descricao: svc.nome,
          valor: Number(svc.preco),
          prof_id: pro.id,
          tipo: "servico"
        });
      }

      setSaving(false);
      setDone(true);
    } catch (error: any) {
      setSaving(false);
      toast.error(error.message || "Erro ao processar agendamento");
    }
  };

  // ───── Step gating ─────
  const canNext = () => {
    if (step === 1) {
      if (!nome.trim() || tel.replace(/\D/g, "").length < 10) return false;
      if (para !== "mim" && !dependenteNome.trim()) return false;
      return true;
    }
    if (step === 2) return !!profId;
    if (step === 3) return !!svcId;
    if (step === 4) return !!data && !!hora;
    return true;
  };

  // ───── Success ─────
  if (done) {
    return (
      <Shell logo={settings?.logo_url}>
        <StepDots step={STEPS} />
        <div className="flex flex-col items-center text-center gap-4 mt-6">
          <div className="h-16 w-16 rounded-full border-2 border-success flex items-center justify-center">
            <CheckCircle2 className="h-9 w-9 text-success" />
          </div>
          <h1 className="font-display text-3xl font-bold text-success">Agendado!</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Seu horário na <b className="text-foreground">Barbearia Status</b> está confirmado.<br />
            Você receberá um lembrete 30 minutos antes pelo WhatsApp. 🔔
          </p>
        </div>

        <div className="bs-card p-3 mt-6 flex items-center gap-3 text-xs text-muted-foreground">
          <Bell className="h-4 w-4 text-primary shrink-0" />
          Lembrete automático via WhatsApp antes do seu horário
        </div>

        <SummaryCard pro={pro!} svc={svc!} data={data} hora={hora} compact />

        <Button className="bs-btn-primary border-0 w-full h-12 mt-6 font-semibold" onClick={reset}>
          Novo agendamento
        </Button>
      </Shell>
    );
  }

  return (
    <Shell logo={settings?.logo_url}>
      <StepDots step={step} />

      {step === 1 && (
        <>
          <Badge>🗓 AGENDAMENTO ONLINE</Badge>
          <Heading title="Bem-vindo à" highlight="Barbearia Status" />
          <p className="text-sm text-muted-foreground -mt-3 mb-5">
            Preencha abaixo e agende em menos de 1 minuto.
          </p>

          <FieldLabel>Nome completo</FieldLabel>
          <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Digite seu nome completo" className="h-12 mb-4" />

          <FieldLabel>WhatsApp</FieldLabel>
          <Input value={tel} onChange={(e) => setTel(maskPhone(e.target.value))} placeholder="(67) 99999-9999" className="h-12 mb-5" inputMode="tel" />

          <FieldLabel>Vamos agendar o corte para...</FieldLabel>
          <div className="grid grid-cols-3 gap-2 mb-4">
            <ParaBtn active={para === "mim"} onClick={() => setPara("mim")} icon={<User className="h-5 w-5" />} label="Para mim" />
            <ParaBtn active={para === "filho"} onClick={() => setPara("filho")} icon={<Baby className="h-5 w-5" />} label="Meu filho(a)" />
            <ParaBtn active={para === "amigo"} onClick={() => setPara("amigo")} icon={<Smile className="h-5 w-5" />} label="Um amigo" />
          </div>

          {para !== "mim" && (
            <>
              <FieldLabel>{para === "filho" ? "Nome da criança" : "Nome do amigo"}</FieldLabel>
              <Input value={dependenteNome} onChange={(e) => setDependenteNome(e.target.value)} placeholder="Digite o nome completo" className="h-12 mb-4" />
            </>
          )}
        </>
      )}

      {step === 2 && (
        <>
          <Heading title="Seu barbeiro" subtitle="Selecione com quem deseja ser atendido" />
          <div className="grid grid-cols-2 gap-3">
            {pros.map((p) => (
              <button
                key={p.id}
                onClick={() => setProfId(p.id)}
                className={`bs-card p-3 text-left transition-all ${profId === p.id ? "ring-2 ring-primary" : "hover:border-primary/40"}`}
              >
                <div className="aspect-square w-full rounded-md overflow-hidden bg-secondary flex items-center justify-center mb-3">
                  {p.foto_url ? (
                    <img src={p.foto_url} alt={p.nome} className="w-full h-full object-cover" />
                  ) : (
                    <span className="font-display text-3xl bs-gold-text">{p.avatar}</span>
                  )}
                </div>
                <div className="font-display font-bold text-base">{p.nome.toUpperCase()}</div>
                <div className="text-xs bs-gold-text">{p.categoria}</div>
              </button>
            ))}
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <Heading title="Serviço" subtitle="O que você deseja realizar?" />
          {Array.from(new Set(svcs.map((s) => s.categoria))).map((cat) => (
            <div key={cat} className="mb-4">
              <div className="text-[11px] tracking-widest bs-gold-text font-semibold mb-2">{cat.toUpperCase()}</div>
              <div className="space-y-2">
                {svcs.filter((s) => s.categoria === cat).map((s) => {
                  const active = svcId === s.id;
                  return (
                    <button key={s.id} onClick={() => setSvcId(s.id)}
                      className={`bs-card w-full p-3 flex items-center gap-3 text-left transition-all ${active ? "ring-2 ring-primary" : "hover:border-primary/40"}`}>
                      <Scissors className="h-4 w-4 text-primary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{s.nome}</div>
                        <div className="text-[11px] text-muted-foreground">⏱ {s.duracao}min</div>
                      </div>
                      <div className="font-display bs-gold-text font-bold text-base shrink-0">{formatBRL(s.preco)}</div>
                      <span className={`h-4 w-4 rounded-full border ${active ? "bg-primary border-primary" : "border-muted-foreground/40"}`} />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </>
      )}

      {step === 4 && (
        <>
          <Heading title="Data & Horário" subtitle="Selecione quando deseja ser atendido" />
          <MiniCalendar value={data} onChange={setData} workDays={settings?.dias_funcionamento as number[] | undefined} />

          <div className="text-[11px] tracking-widest bs-gold-text font-semibold mt-5 mb-2">HORÁRIOS DISPONÍVEIS</div>
          <div className="grid grid-cols-3 gap-2">
            {slots.map((s) => {
              const taken = occupied.includes(s) || slotIsPast(s);
              const active = hora === s;
              return (
                <button key={s} disabled={taken} onClick={() => setHora(s)}
                  className={`h-11 rounded-md border text-sm font-mono transition-colors ${
                    active ? "bs-btn-primary border-0"
                    : taken ? "border-border/40 text-muted-foreground/40 cursor-not-allowed"
                    : "border-border hover:border-primary/50 hover:bg-secondary"
                  }`}>
                  {s}
                </button>
              );
            })}
            {slots.length === 0 && <div className="col-span-3 text-sm text-muted-foreground">Sem horários disponíveis.</div>}
          </div>
        </>
      )}

      {step === 5 && pro && svc && (
        <>
          <Heading title="Confirmar" subtitle="Revise os detalhes antes de confirmar" />
          <SummaryCard pro={pro} svc={svc} data={data} hora={hora} cliente={clienteFinal} />
          <div className="flex items-center justify-between px-4 mt-4">
            <div className="text-sm tracking-wider text-muted-foreground">TOTAL</div>
            <div className="font-display text-3xl bs-gold-text font-bold">{formatBRL(svc.preco)}</div>
          </div>
          <Button disabled={saving} onClick={submit} className="bs-btn-primary border-0 w-full h-12 mt-6 font-semibold text-base">
            {saving ? "Confirmando..." : "✓ Confirmar agendamento"}
          </Button>
          <Button variant="ghost" className="w-full mt-2 text-muted-foreground" onClick={() => setStep(4)}>
            ← Voltar
          </Button>
        </>
      )}

      {step < 5 && (
        <>
          <Button
            disabled={!canNext()}
            onClick={() => setStep((s) => Math.min(s + 1, 5))}
            className="bs-btn-primary border-0 w-full h-12 mt-6 font-semibold"
          >
            {step === 1 && "Escolher barbeiro →"}
            {step === 2 && "Escolher serviço →"}
            {step === 3 && "Escolher horário →"}
            {step === 4 && "Revisar agendamento →"}
          </Button>
          {step > 1 && (
            <Button variant="ghost" className="w-full mt-2 text-muted-foreground" onClick={() => setStep((s) => s - 1)}>
              ← Voltar
            </Button>
          )}
        </>
      )}
    </Shell>
  );
}

// ─────────── Components ───────────

function Shell({ children, logo }: { children: React.ReactNode; logo?: string | null }) {
  return (
    <div className="min-h-screen px-4 py-6 bg-background">
      <div className="max-w-md mx-auto">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="h-20 w-20 rounded-full bg-secondary border border-primary/30 overflow-hidden flex items-center justify-center mb-3">
            {logo ? <img src={logo} alt="Logo" className="w-full h-full object-cover" /> : <Scissors className="h-8 w-8 text-primary" />}
          </div>
          <h1 className="font-display text-2xl tracking-[0.18em] bs-gold-text font-bold">BARBEARIA STATUS</h1>
          <p className="text-[10px] tracking-[0.3em] text-muted-foreground mt-1">COXIM, MS · DESDE 1991</p>
        </div>
        {children}
      </div>
    </div>
  );
}

function StepDots({ step }: { step: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {Array.from({ length: STEPS }).map((_, i) => (
        <span key={i} className={`h-[2px] rounded-full transition-all ${
          i + 1 === step ? "w-8 bg-primary" : i + 1 < step ? "w-6 bg-primary/60" : "w-6 bg-border"
        }`} />
      ))}
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-block px-3 py-1 rounded-full border border-primary/40 text-[11px] tracking-wider bs-gold-text mb-3">
      {children}
    </div>
  );
}

function Heading({ title, highlight, subtitle }: { title: string; highlight?: string; subtitle?: string }) {
  return (
    <div className="mb-5">
      <h2 className="font-display text-3xl font-bold leading-tight">
        {title}{" "}
        {highlight && <span className="bs-gold-text italic">{highlight}</span>}
      </h2>
      {subtitle && <p className="text-sm bs-gold-text/80 mt-1">{subtitle}</p>}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <Label className="text-[11px] tracking-widest font-semibold bs-gold-text mb-1.5 block">{children}</Label>;
}

function ParaBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick}
      className={`bs-card py-3 px-2 flex flex-col items-center gap-1 transition-all ${active ? "ring-2 ring-primary" : "hover:border-primary/40"}`}>
      <span className="text-2xl">{label === "Para mim" ? "👤" : label.includes("filho") ? "👶" : "🧑‍🤝‍🧑"}</span>
      <span className={`text-[11px] font-medium ${active ? "bs-gold-text" : "text-foreground/80"}`}>{label}</span>
    </button>
  );
}

function SummaryCard({ pro, svc, data, hora, cliente, compact }: {
  pro: Pro; svc: Svc; data: string; hora: string; cliente?: string; compact?: boolean;
}) {
  const row = (k: string, v: React.ReactNode) => (
    <div className="flex justify-between items-center px-4 py-3 border-b border-border/50 last:border-0">
      <span className="text-xs tracking-wider text-muted-foreground">{k}</span>
      <span className="text-sm font-medium text-right">{v}</span>
    </div>
  );
  return (
    <div className="bs-card overflow-hidden mt-4">
      {!compact && cliente && row("CLIENTE", cliente)}
      {row("BARBEIRO", <span className="bs-gold-text font-semibold">{pro.nome}</span>)}
      {row("SERVIÇO", svc.nome)}
      {row("DATA", formatDateBR(data))}
      {row("HORÁRIO", <span className="bs-gold-text font-semibold">{hora}</span>)}
    </div>
  );
}

// ─────────── Mini Calendar ───────────

function MiniCalendar({ value, onChange, workDays }: {
  value: string; onChange: (s: string) => void; workDays?: number[];
}) {
  const [view, setView] = useState(() => {
    const d = new Date(value + "T00:00:00");
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const today = todayYMD();
  const monthName = view.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const firstDow = view.getDay();
  const daysInMonth = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(view.getFullYear(), view.getMonth(), d));

  const isWork = (d: Date) => !workDays || workDays.includes(d.getDay());

  return (
    <div className="bs-card p-3">
      <div className="flex items-center justify-between mb-2">
        <button onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}
          className="h-8 w-8 rounded-md border border-border hover:border-primary/50 flex items-center justify-center">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="font-display text-base capitalize bs-gold-text">{monthName}</div>
        <button onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}
          className="h-8 w-8 rounded-md border border-border hover:border-primary/50 flex items-center justify-center">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] tracking-widest text-muted-foreground mb-1">
        {["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SAB"].map((d) => <div key={d}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const s = ymd(d);
          const past = s < today;
          const work = isWork(d);
          const active = s === value;
          const disabled = past || !work;
          return (
            <button key={i} disabled={disabled} onClick={() => onChange(s)}
              className={`h-9 rounded-md text-sm transition-colors ${
                active ? "bs-btn-primary border-0 font-bold"
                : disabled ? "text-muted-foreground/30 cursor-not-allowed"
                : "border border-transparent hover:border-primary/50"
              }`}>
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
