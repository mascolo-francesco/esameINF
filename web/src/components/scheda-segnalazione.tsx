import Link from "next/link";
import { HeartIcon, ImageIcon, MapPinIcon } from "@phosphor-icons/react/ssr";
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
  const sostegni = `${s.sostegni} ${s.sostegni === 1 ? "sostegno" : "sostegni"}`;
  return (
    <Link
      href={`/segnalazioni/${s.codice}`}
      className="group grid grid-cols-[auto_1fr] items-start gap-3 rounded-xl border bg-card p-3 shadow-card transition-[border-color,box-shadow] duration-200 hover:border-primary/40 hover:shadow-raised sm:grid-cols-[auto_1fr_auto] sm:gap-4"
    >
      <div className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-muted sm:size-24">
        {s.miniatura ? (
          // eslint-disable-next-line @next/next/no-img-element -- miniatura da 400 px già ottimizzata
          <img src={s.miniatura} alt="" loading="lazy" className="size-full object-cover" />
        ) : (
          <ImageIcon className="absolute inset-0 m-auto size-7 text-muted-foreground/60" aria-hidden />
        )}
        {posizione !== undefined && (
          <span className="absolute top-1.5 left-1.5 grid h-6 min-w-6 place-items-center rounded-md bg-card/95 px-1 text-xs font-semibold tabular-nums shadow-card">
            <span className="sr-only">Posizione </span>
            {posizione}
          </span>
        )}
      </div>
      <div className="grid min-w-0 content-start gap-1.5">
        <h3 className="line-clamp-2 leading-snug font-semibold text-pretty group-hover:text-primary">{s.titolo}</h3>
        <p className="flex min-w-0 items-center gap-1 text-sm text-muted-foreground">
          <MapPinIcon className="size-4 shrink-0" aria-hidden />
          <span className="truncate">
            {s.quartiere}
            {s.municipio ? ` · ${s.municipio}` : ""}
          </span>
        </p>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <BadgeStato codice={s.statoCodice} nome={s.stato} />
          {/* sui telefoni i sostegni stanno qui, così il titolo ha tutta la larghezza */}
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary tabular-nums sm:hidden">
            <HeartIcon weight="fill" className="size-3.5" aria-hidden />
            {sostegni}
          </span>
          {s.categorie && (
            <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
              {s.colore && <span className="size-2 shrink-0 rounded-full" style={{ background: s.colore }} aria-hidden />}
              <span className="truncate">{s.categorie}</span>
            </span>
          )}
        </div>
      </div>
      <div className="hidden w-16 flex-col items-center justify-center self-center rounded-lg bg-secondary/70 py-2 text-secondary-foreground sm:flex">
        <HeartIcon weight="fill" className="size-4 text-primary" aria-hidden />
        <span className="text-xl leading-tight font-semibold tabular-nums">{s.sostegni}</span>
        <span className="text-[11px] text-muted-foreground">{s.sostegni === 1 ? "sostegno" : "sostegni"}</span>
      </div>
    </Link>
  );
}
