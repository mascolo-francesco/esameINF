import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";

/** Sagome grigie con la stessa forma del contenuto, mentre la pagina carica. */
export function ScheletroElenco({ righe = 5 }: { righe?: number }) {
  return (
    <ul className="grid gap-3" aria-hidden>
      {Array.from({ length: righe }, (_, i) => (
        <li key={i} className="flex gap-3 rounded-xl border bg-card p-3 shadow-card sm:gap-4">
          <Skeleton className="size-20 shrink-0 rounded-lg sm:size-24" />
          <div className="grid flex-1 content-start gap-2 pt-1">
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-3.5 w-1/2" />
            <Skeleton className="h-5 w-24" />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function ScheletroPagina({ children }: { children?: ReactNode }) {
  return (
    <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 pt-8 pb-12 sm:pt-10" role="status" aria-live="polite">
      <span className="sr-only">Caricamento della pagina…</span>
      <div className="grid gap-3" aria-hidden>
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      {children ?? <ScheletroElenco />}
    </div>
  );
}
