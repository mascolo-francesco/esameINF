"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HouseIcon, ListNumbersIcon, MapTrifoldIcon, PlusIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

const VOCI = [
  { href: "/", testo: "Home", Icona: HouseIcon },
  { href: "/mappa", testo: "Mappa", Icona: MapTrifoldIcon },
  { href: "/classifica", testo: "Classifica", Icona: ListNumbersIcon },
];

/** Navigazione in basso per i telefoni (sotto i 640 px), raggiungibile con il pollice. */
export function BarraMobile() {
  const percorso = usePathname();
  const nuova = percorso.startsWith("/nuova");
  return (
    <nav
      aria-label="Navigazione rapida"
      className="fixed inset-x-0 bottom-0 z-40 bg-carta pb-[env(safe-area-inset-bottom)] sm:hidden"
    >
      <ul className="grid grid-cols-4 px-1">
        {VOCI.map(({ href, testo, Icona }) => {
          const attiva = href === "/" ? percorso === "/" : percorso.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={attiva ? "page" : undefined}
                className={cn(
                  "premibile flex h-16 flex-col items-center justify-center gap-1 text-xs transition-[color,scale] duration-150 ease-(--ease-out) active:scale-95",
                  attiva ? "font-semibold text-primary" : "text-muted-foreground",
                )}
              >
                <Icona weight="regular" className="size-6" aria-hidden />
                {testo}
              </Link>
            </li>
          );
        })}
        <li>
          <Link
            href="/nuova"
            aria-current={nuova ? "page" : undefined}
            className="premibile flex h-16 flex-col items-center justify-center gap-1 text-xs font-semibold text-primary transition-[scale] duration-150 ease-(--ease-out) active:scale-95"
          >
            <span className="grid h-7 w-11 place-items-center rounded-full bg-primary text-primary-foreground shadow-card">
              <PlusIcon weight="bold" className="size-4" aria-hidden />
            </span>
            Segnala
          </Link>
        </li>
      </ul>
    </nav>
  );
}
