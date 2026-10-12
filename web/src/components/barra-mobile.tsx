"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ListOrdered, Map, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const VOCI = [
  { href: "/", testo: "Home", Icona: Home },
  { href: "/mappa", testo: "Mappa", Icona: Map },
  { href: "/classifica", testo: "Classifica", Icona: ListOrdered },
  { href: "/nuova", testo: "Segnala", Icona: Plus },
];

/** Navigazione in basso per i telefoni (sotto i 640 px), raggiungibile con il pollice. */
export function BarraMobile() {
  const percorso = usePathname();
  return (
    <nav
      aria-label="Navigazione rapida"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden"
    >
      <ul className="grid grid-cols-4">
        {VOCI.map(({ href, testo, Icona }) => {
          const attiva = href === "/" ? percorso === "/" : percorso.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={attiva ? "page" : undefined}
                className={cn("flex h-14 flex-col items-center justify-center gap-0.5 text-xs", attiva ? "font-semibold text-primary" : "text-muted-foreground")}
              >
                <Icona className="size-5" aria-hidden />
                {testo}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
