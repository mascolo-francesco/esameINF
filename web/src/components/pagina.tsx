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
    <div className={cn("mx-auto w-full px-4 pt-8 pb-12 sm:pt-10", stretta ? "max-w-md" : "max-w-6xl", className)}>
      {(titolo || azioni) && (
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div className="grid gap-2">
                        {titolo && <h1 className="text-2xl leading-tight tracking-tight sm:text-[2rem]">{titolo}</h1>}
            {descrizione && <p className="max-w-prose text-base text-muted-foreground">{descrizione}</p>}
          </div>
          {azioni}
        </div>
      )}
      {children}
    </div>
  );
}
