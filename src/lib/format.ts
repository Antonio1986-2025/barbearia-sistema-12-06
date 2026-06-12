export const formatBRL = (n: number | null | undefined): string => {
  const v = Number(n ?? 0);
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

export const formatDateBR = (s: string | Date | null | undefined): string => {
  if (!s) return "";
  const d = typeof s === "string" ? new Date(s + (s.length === 10 ? "T00:00:00" : "")) : s;
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR");
};

export const maskPhone = (s: string): string => {
  const v = s.replace(/\D/g, "").slice(0, 11);
  if (v.length <= 2) return v;
  if (v.length <= 3) return `(${v.slice(0, 2)}) ${v.slice(2)}`;
  if (v.length <= 7) return `(${v.slice(0, 2)}) ${v.slice(2, 3)} ${v.slice(3)}`;
  return `(${v.slice(0, 2)}) ${v.slice(2, 3)} ${v.slice(3, 7)}-${v.slice(7)}`;
};

export const todayYMD = (): string => {
  const d = new Date();
  const offset = d.getTimezoneOffset();
  const localDate = new Date(d.getTime() - (offset * 60 * 1000));
  return localDate.toISOString().split('T')[0];
};

export const ymd = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const diffDays = (d1: string | Date, d2: string | Date): number => {
  const a = typeof d1 === "string" ? new Date(d1) : d1;
  const b = typeof d2 === "string" ? new Date(d2) : d2;
  return Math.round((a.getTime() - b.getTime()) / 86400000);
};

export const generateSlots = (inicio: string, fim: string, slotMin: number): string[] => {
  const [hi, mi] = inicio.split(":").map(Number);
  const [hf, mf] = fim.split(":").map(Number);
  const start = hi * 60 + mi;
  const end = hf * 60 + mf;
  const out: string[] = [];
  for (let t = start; t < end; t += slotMin) {
    out.push(`${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`);
  }
  return out;
};

export const initials = (name: string): string => {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export const periodRange = (kind: string): { from: string; to: string } => {
  const today = new Date();
  const t = ymd(today);
  const start = new Date(today);
  switch (kind) {
    case "hoje":
      return { from: t, to: t };
    case "semana": {
      const day = today.getDay() || 7;
      start.setDate(today.getDate() - day + 1);
      return { from: ymd(start), to: t };
    }
    case "mes":
      start.setDate(1);
      return { from: ymd(start), to: t };
    case "mes_anterior": {
      const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const last = new Date(today.getFullYear(), today.getMonth(), 0);
      return { from: ymd(first), to: ymd(last) };
    }
    case "trimestre":
      start.setMonth(today.getMonth() - 3);
      return { from: ymd(start), to: t };
    case "ano":
      start.setMonth(0, 1);
      return { from: ymd(start), to: t };
    default:
      return { from: t, to: t };
  }
};
