import Link from "next/link";
import { Heart, MapPin } from "lucide-react";
import { BadgeStato } from "@/components/stato";

export interface DatiScheda {
  codice: string;
  titolo: string;
  stato: string;
  statoCodice: string;
  quartiere: string;
  municipio?: string;
  categorie: string | null;
  colore: string | null;
  miniatura: string | null;
  sostegni: number;
}

/** Riga di elenco: miniatura, titolo, stato, quartiere e numero di sostegni. */
export function SchedaSegnalazione({ s, posizione }: { s: DatiScheda; posizione?: number }) {
  return (
    <Link
      href={`/segnalazioni/${s.codice}`}
      className="group flex gap-3 rounded-lg border bg-card p-3 transition-colors hover:border-primary/40 hover:bg-primary/[0.03]"
    >
      {posizione !== undefined && (
        <span className="w-6 shrink-0 pt-1 text-right text-sm font-semibold text-muted-foreground tabular-nums" aria-label={`Posizione ${posizione}`}>
          {posizione}
        </span>
      )}
      <div className="relative size-20 shrink-0 overflow-hidden rounded-md bg-muted sm:size-24">
        {s.miniatura && (
          // eslint-disable-next-line @next/next/no-img-element -- miniatura da 400 px già ottimizzata
          <img src={s.miniatura} alt="" loading="lazy" className="size-full object-cover" />
        )}
        {s.colore && <span className="absolute top-1.5 left-1.5 size-2.5 rounded-full ring-2 ring-white" style={{ background: s.colore }} aria-hidden />}
      </div>
      <div className="grid min-w-0 flex-1 content-start gap-1">
        <h3 className="line-clamp-2 font-medium text-balance group-hover:text-primary">{s.titolo}</h3>
        <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
          <MapPin className="size-3 shrink-0" aria-hidden />
          <span className="truncate">
            {s.quartiere}
            {s.municipio ? ` · ${s.municipio}` : ""}
          </span>
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <BadgeStato codice={s.statoCodice} nome={s.stato} />
          {s.categorie && <span className="truncate text-xs text-muted-foreground">{s.categorie}</span>}
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-center justify-center rounded-md px-2 text-center">
        <Heart className="size-4 text-primary" aria-hidden />
        <span className="text-lg font-semibold tabular-nums">{s.sostegni}</span>
        <span className="sr-only">sostegni</span>
      </div>
    </Link>
  );
}
