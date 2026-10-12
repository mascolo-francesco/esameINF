import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Contenitore comune: larghezza massima, margini e titolo della pagina. */
export function Pagina({
  titolo,
  descrizione,
  azioni,
  stretta,
  className,
  children,
}: {
  titolo?: ReactNode;
  descrizione?: ReactNode;
  azioni?: ReactNode;
  stretta?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("mx-auto w-full px-4 py-8", stretta ? "max-w-md" : "max-w-6xl", className)}>
      {(titolo || azioni) && (
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div className="grid gap-1">
            {titolo && <h1 className="text-2xl font-semibold tracking-tight">{titolo}</h1>}
            {descrizione && <p className="text-muted-foreground">{descrizione}</p>}
          </div>
          {azioni}
        </div>
      )}
      {children}
    </div>
  );
}
