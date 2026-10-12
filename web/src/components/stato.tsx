import { cn } from "@/lib/utils";

// colori dei 10 stati visibili; il testo resta sempre leggibile (contrasto AA) e il pallino
// ripete il colore, così lo stato non dipende solo dallo sfondo
const COLORI: Record<string, [badge: string, pallino: string]> = {
  RICEVUTA: ["bg-slate-100 text-slate-800 border-slate-300", "bg-slate-500"],
  IN_REVISIONE: ["bg-amber-50 text-amber-900 border-amber-300", "bg-amber-500"],
  DA_INTEGRARE: ["bg-orange-50 text-orange-900 border-orange-300", "bg-orange-500"],
  RIFIUTATA: ["bg-red-50 text-red-900 border-red-300", "bg-red-500"],
  PUBBLICATA: ["bg-emerald-50 text-emerald-900 border-emerald-300", "bg-emerald-600"],
  PRESA_IN_CARICO: ["bg-sky-50 text-sky-900 border-sky-300", "bg-sky-600"],
  INVIATA_CANDIDATI: ["bg-indigo-50 text-indigo-900 border-indigo-300", "bg-indigo-500"],
  UNITA: ["bg-zinc-100 text-zinc-800 border-zinc-300", "bg-zinc-500"],
  ARCHIVIATA: ["bg-zinc-100 text-zinc-700 border-zinc-300", "bg-zinc-400"],
  RITIRATA: ["bg-zinc-100 text-zinc-700 border-zinc-300", "bg-zinc-400"],
};

export function BadgeStato({ codice, nome, className }: { codice: string; nome: string; className?: string }) {
  const [badge, pallino] = COLORI[codice] ?? COLORI.RICEVUTA;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium",
        badge,
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", pallino)} aria-hidden />
      {nome}
    </span>
  );
}

export function BadgeCategoria({ nome, colore }: { nome: string; colore: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border bg-card px-2 py-0.5 text-xs">
      <span className="size-2 rounded-full" style={{ background: colore }} aria-hidden />
      {nome}
    </span>
  );
}
