import { Button } from "@/components/ui/button";
import { periodRange } from "@/lib/format";

const OPTS = [
  { k: "hoje", label: "Hoje" },
  { k: "semana", label: "Semana" },
  { k: "mes", label: "Mês" },
  { k: "mes_anterior", label: "Mês ant." },
  { k: "trimestre", label: "Trim." },
  { k: "ano", label: "Ano" },
] as const;

export function PeriodFilter({
  value, onChange,
}: { value: string; onChange: (k: string, range: { from: string; to: string }) => void }) {
  return (
    <div className="flex flex-wrap gap-1 bs-card p-1">
      {OPTS.map((o) => (
        <Button
          key={o.k}
          size="sm"
          variant={value === o.k ? "default" : "ghost"}
          className={value === o.k ? "bs-btn-primary border-0" : ""}
          onClick={() => onChange(o.k, periodRange(o.k))}
        >
          {o.label}
        </Button>
      ))}
    </div>
  );
}
