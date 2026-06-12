const MAP: Record<string, { label: string; bg: string; fg: string }> = {
  agendado:   { label: "Agendado",   bg: "oklch(0.72 0.13 80 / 0.18)", fg: "var(--primary)" },
  confirmado: { label: "Confirmado", bg: "oklch(0.62 0.1 240 / 0.2)",  fg: "var(--info)" },
  concluido:  { label: "Concluído",  bg: "oklch(0.65 0.13 150 / 0.2)", fg: "var(--success)" },
  cancelado:  { label: "Cancelado",  bg: "oklch(0.6 0.16 25 / 0.2)",   fg: "var(--destructive)" },
  aberto:     { label: "Aberto",     bg: "oklch(0.72 0.13 80 / 0.18)", fg: "var(--primary)" },
  fechado:    { label: "Fechado",    bg: "oklch(0.65 0.13 150 / 0.2)", fg: "var(--success)" },
  aberta:     { label: "Aberta",     bg: "oklch(0.72 0.13 80 / 0.18)", fg: "var(--primary)" },
  finalizada: { label: "Finalizada", bg: "oklch(0.65 0.13 150 / 0.2)", fg: "var(--success)" },
  cancelada:  { label: "Cancelada",  bg: "oklch(0.6 0.16 25 / 0.2)",   fg: "var(--destructive)" },
  solicitado: { label: "Solicitado", bg: "oklch(0.72 0.13 80 / 0.18)", fg: "var(--primary)" },
  aprovado:   { label: "Aprovado",   bg: "oklch(0.62 0.1 240 / 0.2)",  fg: "var(--info)" },
  pago:       { label: "Pago",       bg: "oklch(0.65 0.13 150 / 0.2)", fg: "var(--success)" },
  recusado:   { label: "Recusado",   bg: "oklch(0.6 0.16 25 / 0.2)",   fg: "var(--destructive)" },
};

export function StatusBadge({ status }: { status: string }) {
  const s = MAP[status] ?? { label: status, bg: "var(--muted)", fg: "var(--muted-foreground)" };
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
      style={{ backgroundColor: s.bg, color: s.fg }}
    >
      {s.label}
    </span>
  );
}
