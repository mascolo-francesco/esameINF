import Link from "next/link";
import { ImageIcon } from "@phosphor-icons/react/ssr";
import { BadgeStato } from "@/components/stato";
import { cn } from "@/lib/utils";

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

/**
 * Riga di elenco a due righe: posizione, foto, titolo e luogo, una sola etichetta di stato e i sostegni
 * allineati a destra. Niente riquadro: le righe le separa la riga sottile dell'elenco che le contiene.
 */
export function SchedaSegnalazione({ s, posizione, className }: { s: DatiScheda; posizione?: number; className?: string }) {
  return (
    <Link
      href={`/segnalazioni/${s.codice}`}
      className={cn(
        "group grid grid-cols-[auto_1fr_auto] items-center gap-x-4 py-4 sm:grid-cols-[auto_auto_1fr_auto]",
        posizione === undefined && "sm:grid-cols-[auto_1fr_auto]",
        className,
      )}
    >
      {posizione !== undefined && (
        <span className="hidden w-6 text-right text-sm text-muted-foreground tabular-nums sm:block">
          <span className="sr-only">Posizione </span>
          {posizione}
        </span>
      )}
      <div className="relative size-[72px] flex-none overflow-hidden bg-sunken">
        {s.miniatura ? (
          // eslint-disable-next-line @next/next/no-img-element -- miniatura da 400 px già ottimizzata
          <img src={s.miniatura} alt="" loading="lazy" className="size-full object-cover" />
        ) : (
          <ImageIcon weight="regular" className="absolute inset-0 m-auto size-6 text-muted-foreground" aria-hidden />
        )}
      </div>
      <div className="grid min-w-0 content-center gap-1">
        <h3 className="line-clamp-2 font-sans text-[17px] leading-snug font-semibold tracking-normal text-pretty group-hover:text-primary">
          {s.titolo}
        </h3>
        <p className="line-clamp-2 text-sm text-muted-foreground">
          {s.quartiere}
          {s.municipio ? ` · ${s.municipio}` : ""}
          {s.categorie ? ` · ${s.categorie}` : ""}
        </p>
        <div>
          <BadgeStato codice={s.statoCodice} nome={s.stato} />
        </div>
      </div>
      <p className="grid justify-items-end self-center text-right">
        <span className="text-xl leading-none tabular-nums">{s.sostegni}</span>
        <span className="text-[13px] text-muted-foreground">{s.sostegni === 1 ? "sostegno" : "sostegni"}</span>
      </p>
    </Link>
  );
}
