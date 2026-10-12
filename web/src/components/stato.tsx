import { cn } from "@/lib/utils";

// colori dei 10 stati visibili; il testo resta sempre leggibile (contrasto AA)
const COLORI: Record<string, string> = {
  RICEVUTA: "bg-slate-100 text-slate-800 border-slate-300",
  IN_REVISIONE: "bg-amber-50 text-amber-900 border-amber-300",
  DA_INTEGRARE: "bg-orange-50 text-orange-900 border-orange-300",
  RIFIUTATA: "bg-red-50 text-red-900 border-red-300",
  PUBBLICATA: "bg-emerald-50 text-emerald-900 border-emerald-300",
  PRESA_IN_CARICO: "bg-sky-50 text-sky-900 border-sky-300",
  INVIATA_CANDIDATI: "bg-indigo-50 text-indigo-900 border-indigo-300",
  UNITA: "bg-zinc-100 text-zinc-800 border-zinc-300",
  ARCHIVIATA: "bg-zinc-100 text-zinc-700 border-zinc-300",
  RITIRATA: "bg-zinc-100 text-zinc-700 border-zinc-300",
};

export function BadgeStato({ codice, nome, className }: { codice: string; nome: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium", COLORI[codice] ?? COLORI.RICEVUTA, className)}>
      {nome}
    </span>
  );
}

export function BadgeCategoria({ nome, colore }: { nome: string; colore: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border bg-background px-2 py-0.5 text-xs">
      <span className="size-2 rounded-full" style={{ background: colore }} aria-hidden />
      {nome}
    </span>
  );
}
