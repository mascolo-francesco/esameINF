import { cn } from "@/lib/utils";

const TAPPE = ["Ricevuta", "In revisione", "Pubblicata", "Presa in carico", "Inviata ai candidati"] as const;

// dove si trova ogni stato lungo il percorso; gli stati di uscita (rifiutata, unita, archiviata, ritirata) non ci stanno
const POSIZIONE: Record<string, number> = {
  RICEVUTA: 0,
  IN_REVISIONE: 1,
  DA_INTEGRARE: 1,
  PUBBLICATA: 2,
  PRESA_IN_CARICO: 3,
  INVIATA_CANDIDATI: 4,
};

/**
 * Il percorso di una segnalazione, dal marciapiede ai candidati: cinque tappe su una traccia,
 * quelle già fatte nel verde acqua pieno. Restituisce null per gli stati che escono dal percorso.
 */
export function Percorso({ codice, className }: { codice: string; className?: string }) {
  const qui = POSIZIONE[codice];
  if (qui === undefined) return null;
  return (
    <ol aria-label="Percorso della segnalazione" className={cn("grid grid-cols-5 gap-1", className)}>
      {TAPPE.map((t, i) => (
        <li key={t} aria-current={i === qui ? "step" : undefined} className="grid content-start gap-2">
          <span className={cn("h-1.5", i <= qui ? "bg-primary" : "bg-sunken")} aria-hidden />
          <span
            className={cn(
              "text-xs leading-tight",
              i === qui ? "font-semibold text-foreground" : i < qui ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {t}
            {i < qui && <span className="sr-only"> (fatto)</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}
