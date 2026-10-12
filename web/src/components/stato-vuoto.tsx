import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Riquadro per gli elenchi vuoti: dice cosa comparirà qui e, se serve, cosa fare. */
export function StatoVuoto({
  icona,
  titolo,
  children,
  azione,
  className,
}: {
  icona: ReactNode;
  titolo: string;
  children?: ReactNode;
  azione?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid justify-items-center gap-3 rounded-2xl border border-dashed bg-sunken/60 px-6 py-12 text-center", className)}>
      <span className="grid size-12 place-items-center rounded-xl bg-card text-primary shadow-card [&_svg]:size-6" aria-hidden>
        {icona}
      </span>
      <div className="grid max-w-sm gap-1">
        <p className="font-semibold">{titolo}</p>
        {children && <p className="text-sm text-muted-foreground">{children}</p>}
      </div>
      {azione}
    </div>
  );
}
