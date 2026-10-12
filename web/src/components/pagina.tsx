import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Contenitore comune: larghezza massima, margini e titolo della pagina. */
export function Pagina({
  titolo,
  sopratitolo,
  descrizione,
  azioni,
  stretta,
  className,
  children,
}: {
  titolo?: ReactNode;
  sopratitolo?: ReactNode;
  descrizione?: ReactNode;
  azioni?: ReactNode;
  stretta?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("mx-auto w-full px-4 pt-8 pb-12 sm:pt-10", stretta ? "max-w-md" : "max-w-6xl", className)}>
      {(titolo || azioni) && (
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div className="grid gap-2">
            {sopratitolo && <p className="text-sm font-medium text-primary">{sopratitolo}</p>}
            {titolo && <h1 className="text-3xl font-semibold tracking-tight">{titolo}</h1>}
            {descrizione && <p className="max-w-prose text-muted-foreground">{descrizione}</p>}
          </div>
          {azioni}
        </div>
      )}
      {children}
    </div>
  );
}
