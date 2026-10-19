import { cn } from "@/lib/utils";

// Gli stati sono una macchina a stati: una sola tinta (il verde acqua) che si fa più intensa man mano che la
// segnalazione avanza verso i candidati. Grigio per ciò che aspetta o è chiuso; giallo solo per "da integrare",
// che chiede qualcosa all'autore; rosso solo per il rifiuto.
const COLORI: Record<string, string> = {
  RICEVUTA: "bg-sunken text-foreground",
  IN_REVISIONE: "bg-sunken text-foreground",
  DA_INTEGRARE: "bg-avviso text-avviso-ink ring-1 ring-inset ring-avviso-bordo",
  RIFIUTATA: "bg-negativo text-negativo-ink",
  PUBBLICATA: "bg-tinta-50 text-tinta-ink",
  PRESA_IN_CARICO: "bg-tinta-100 text-tinta-ink",
  INVIATA_CANDIDATI: "bg-tinta-200 text-tinta-ink",
  UNITA: "bg-sunken text-muted-foreground",
  ARCHIVIATA: "bg-sunken text-muted-foreground",
  RITIRATA: "bg-sunken text-muted-foreground",
};

/** Una sola etichetta di stato per riga: fondo chiaro, testo scuro della stessa tinta, mai schiacciata. */
export function BadgeStato({ codice, nome, className }: { codice: string; nome: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 flex-none items-center px-2 text-xs font-semibold whitespace-nowrap",
        COLORI[codice] ?? COLORI.RICEVUTA,
        className,
      )}
    >
      {nome}
    </span>
  );
}

/** La categoria resta un'informazione, non uno stato: il suo colore (lo stesso della mappa) solo nel pallino. */
export function BadgeCategoria({ nome, colore }: { nome: string; colore: string }) {
  return (
    <span className="inline-flex flex-none items-center gap-1.5 text-sm whitespace-nowrap text-muted-foreground">
      <span className="size-2 rounded-full" style={{ background: colore }} aria-hidden />
      {nome}
    </span>
  );
}
