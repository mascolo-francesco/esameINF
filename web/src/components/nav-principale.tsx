"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const VOCI = [
  { href: "/mappa", testo: "Mappa" },
  { href: "/classifica", testo: "Classifica" },
];

/** Voci del menu in alto (da 640 px in su), con la pagina corrente evidenziata. */
export function NavPrincipale() {
  const percorso = usePathname();
  return (
    <nav aria-label="Principale" className="hidden items-center gap-1 sm:flex">
      {VOCI.map((v) => {
        const attiva = percorso.startsWith(v.href);
        return (
          <Link
            key={v.href}
            href={v.href}
            aria-current={attiva ? "page" : undefined}
            className={cn(
              "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              attiva ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {v.testo}
          </Link>
        );
      })}
    </nav>
  );
}
