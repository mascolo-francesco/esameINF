import { cn } from "@/lib/utils";

/**
 * Il marchio: un tabellone delle affissioni elettorali sulle sue due gambe, con quattro spazi.
 * Uno è il nostro: un foglio verde acqua appena incollato, con l'angolo ancora piegato.
 * Disegnato su una griglia di 32: si legge anche a 16 px (favicon).
 */
export function Marchio({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8 flex-none", className)} aria-hidden focusable="false">
      {/* lamiera e gambe */}
      <rect x="0" y="0" width="32" height="24" fill="var(--lamiera, #1f3038)" />
      <rect x="5" y="24" width="3" height="8" fill="var(--lamiera, #1f3038)" />
      <rect x="24" y="24" width="3" height="8" fill="var(--lamiera, #1f3038)" />
      {/* gli spazi degli altri: carta bianca */}
      <rect x="17" y="3" width="12" height="8" fill="#ffffff" />
      <rect x="3" y="13" width="12" height="8" fill="#ffffff" />
      <rect x="17" y="13" width="12" height="8" fill="#ffffff" />
      {/* il nostro foglio, con l'angolo piegato */}
      <path d="M3 3h8l4 4v4H3z" fill="var(--primary, #0d7480)" />
      <path d="M11 3v4h4z" fill="var(--tinta-200, #a7d3d9)" />
    </svg>
  );
}

/** Marchio e nome: il nome nel carattere dei titoli, la città sotto, piccola. */
export function Logo({ className, chiaro }: { className?: string; chiaro?: boolean }) {
  return (
    <span className={cn("flex items-center gap-3", className)}>
      <Marchio />
      <span className="grid leading-none">
        <span className={cn("font-display text-[19px] tracking-tight", chiaro && "text-lamiera-foreground")}>La Nostra Città</span>
        <span className={cn("mt-1 text-xs text-muted-foreground", chiaro && "text-lamiera-foreground/70")}>Milano</span>
      </span>
    </span>
  );
}
