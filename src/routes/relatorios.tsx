import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PeriodFilter } from "@/components/PeriodFilter";
import { formatBRL, periodRange } from "@/lib/format";
import { TrendingUp, Users, Calendar, Percent } from "lucide-react";

export const Route = createFileRoute("/relatorios")({
  head: () => ({ meta: [{ title: "Relatórios — Barbearia Status" }] }),
  component: RelatoriosPage,
});

function RelatoriosPage() {
  const [period, setPeriod] = useState("mes");
  const [range, setRange] = useState(periodRange("mes"));

  const { data: stats } = useQuery({
    queryKey: ["fat", range.from, range.to],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("faturamento_periodo", { p_inicio: range.from, p_fim: range.to });
      if (error) throw error;
      const row = (data as Array<{ total_faturado: number; total_atendimentos: number; ticket_medio: number; taxa_conclusao: number }>)[0];
      return row ?? { total_faturado: 0, total_atendimentos: 0, ticket_medio: 0, taxa_conclusao: 0 };
    },
  });

  const { data: byPro = [] } = useQuery({
    queryKey: ["byPro", range.from, range.to],
    queryFn: async () => {
      // 1. Buscar de atendimentos legados/agenda
      const { data: appts } = await supabase.from("appointments")
        .select("prof_id, valor")
        .gte("data", range.from).lte("data", range.to)
        .in("status", ["concluido", "paga", "pago"]);
      
      // 2. Buscar de comandas pagas
      const { data: closedCmds } = await supabase.from("commands")
        .select("id")
        .eq("status", "paga")
        .gte("fechamento", range.from + "T00:00:00")
        .lte("fechamento", range.to + "T23:59:59");
      
      const cmdIds = (closedCmds ?? []).map(c => c.id);
      let cmdItems: any[] = [];
      if (cmdIds.length > 0) {
        const { data } = await supabase.from("command_items")
          .select("valor, prof_id")
          .in("command_id", cmdIds);
        cmdItems = data || [];
      }

      const map = new Map<number, { count: number; total: number }>();
      
      const process = (rows: any[]) => {
        rows.forEach((r) => {
          if (!r.prof_id) return;
          const pid = Number(r.prof_id);
          const cur = map.get(pid) ?? { count: 0, total: 0 };
          cur.count += 1; 
          cur.total += Number(r.valor);
          map.set(pid, cur);
        });
      };

      process(appts || []);
      process(cmdItems);

      const { data: pros } = await supabase.from("professionals").select("id, nome, cor, comissao_pct");
      return (pros ?? []).map((p) => ({
        ...p,
        ...(map.get(p.id) ?? { count: 0, total: 0 }),
      })).sort((a, b) => b.total - a.total);
    },
  });

  const { data: byService = [] } = useQuery({
    queryKey: ["bySvc", range.from, range.to],
    queryFn: async () => {
      // 1. Agenda
      const { data: appts } = await supabase.from("appointments")
        .select("servico, valor")
        .gte("data", range.from).lte("data", range.to)
        .in("status", ["concluido", "paga", "pago"]);
      
      // 2. Comandas
      const { data: closedCmds } = await supabase.from("commands")
        .select("id")
        .eq("status", "paga")
        .gte("fechamento", range.from + "T00:00:00")
        .lte("fechamento", range.to + "T23:59:59");
      
      const cmdIds = (closedCmds ?? []).map(c => c.id);
      let cmdItems: any[] = [];
      if (cmdIds.length > 0) {
        const { data } = await supabase.from("command_items")
          .select("descricao, valor")
          .in("command_id", cmdIds);
        cmdItems = data || [];
      }

      const map = new Map<string, { count: number; total: number }>();
      
      const process = (rows: any[], key: string) => {
        rows.forEach((r) => {
          const nome = r[key] || "Outros";
          const cur = map.get(nome) ?? { count: 0, total: 0 };
          cur.count += 1; 
          cur.total += Number(r.valor);
          map.set(nome, cur);
        });
      };

      process(appts || [], "servico");
      process(cmdItems, "descricao");

      return Array.from(map.entries()).map(([nome, v]) => ({ nome, ...v })).sort((a, b) => b.total - a.total);
    },
  });

  const { data: recentTransactions = [] } = useQuery({
    queryKey: ["recentTransactions", range.from, range.to],
    queryFn: async () => {
      const { data } = await supabase.from("transactions")
        .select("*")
        .gte("data", range.from).lte("data", range.to)
        .order("created_at", { ascending: false })
        .limit(50);
      return data || [];
    },
  });

  return (
    <div className="space-y-4 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold bs-gold-text">Relatórios</h1>
          <p className="text-sm text-muted-foreground">Performance do negócio · {range.from} → {range.to}</p>
        </div>
        <PeriodFilter value={period} onChange={(k, r) => { setPeriod(k); setRange(r); }} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={TrendingUp} label="Faturamento" value={formatBRL(stats?.total_faturado ?? 0)} />
        <Stat icon={Calendar} label="Atendimentos" value={String(stats?.total_atendimentos ?? 0)} />
        <Stat icon={Users} label="Ticket Médio" value={formatBRL(stats?.ticket_medio ?? 0)} />
        <Stat icon={Percent} label="Taxa de Conclusão" value={`${stats?.taxa_conclusao ?? 0}%`} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="bs-card p-5">
          <h3 className="font-display text-lg mb-3">Por profissional</h3>
          {byPro.length === 0 && <p className="text-sm text-muted-foreground">Sem dados.</p>}
          <div className="space-y-3">
            {byPro.map((p) => {
              const comissao = p.total * (Number(p.comissao_pct) / 100);
              if (p.total === 0) return null;
              return (
                <div key={p.id} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ background: p.cor }} />
                      {p.nome}
                    </span>
                    <span className="font-mono">{formatBRL(p.total)}</span>
                  </div>
                  <div className="text-xs text-muted-foreground flex justify-between">
                    <span>{p.count} atendimentos · comissão {p.comissao_pct}%</span>
                    <span className="font-mono">{formatBRL(comissao)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bs-card p-5">
          <h3 className="font-display text-lg mb-3">Por serviço</h3>
          {byService.length === 0 && <p className="text-sm text-muted-foreground">Sem dados.</p>}
          <div className="space-y-2">
            {byService.map((s) => (
              <div key={s.nome} className="flex items-center justify-between text-sm border-b border-border/50 pb-2">
                <span>{s.nome} <span className="text-muted-foreground text-xs">({s.count}x)</span></span>
                <span className="font-mono">{formatBRL(s.total)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bs-card overflow-hidden">
        <div className="p-4 border-b border-border/50">
          <h3 className="font-display text-lg">Registros de Vendas</h3>
          <p className="text-xs text-muted-foreground">Lista de transações no período selecionado</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs uppercase bg-secondary/30 text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Descrição</th>
                <th className="px-4 py-3">Pagamento</th>
                <th className="px-4 py-3 text-right">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {recentTransactions.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">Nenhum registro encontrado.</td>
                </tr>
              )}
              {recentTransactions.map((t) => (
                <tr key={t.id} className="hover:bg-secondary/10">
                  <td className="px-4 py-3 font-mono text-xs">{t.data}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{t.descricao}</div>
                    <div className="text-[10px] text-muted-foreground uppercase">{t.categoria}</div>
                  </td>
                  <td className="px-4 py-3 uppercase text-[10px] font-bold">{t.forma_pagamento}</td>
                  <td className={`px-4 py-3 text-right font-bold ${t.tipo === 'entrada' ? 'text-success' : 'text-destructive'}`}>
                    {t.tipo === 'entrada' ? '+' : '-'} {formatBRL(t.valor)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="bs-card p-4">
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="text-xs uppercase tracking-wider">{label}</span>
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="mt-2 font-display text-2xl font-bold bs-gold-text">{value}</div>
    </div>
  );
}
