"use client";

import { useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/** Schede di una sezione (moderazione, amministrazione): evidenzia quella della pagina corrente. */
export function SchedeNavigazione({ voci }: { voci: { href: string; testo: string; icona?: ReactNode }[] }) {
  const percorso = usePathname();
  const lista = useRef<HTMLUListElement>(null);
  // la scheda attiva è quella con il prefisso più lungo che corrisponde al percorso
  const attiva = voci
    .filter((v) => percorso === v.href || percorso.startsWith(`${v.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  // sui telefoni le schede scorrono: porto in vista quella attiva, senza animazione
  useEffect(() => {
    lista.current?.querySelector<HTMLElement>('[aria-current="page"]')?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [attiva]);

  return (
    <nav aria-label="Sezioni" className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none]">
      <ul ref={lista} className="flex w-max min-w-full gap-1 rounded-xl bg-sunken p-1 ring-1 ring-border sm:w-fit sm:min-w-0">
        {voci.map((v) => (
          <li key={v.href}>
            <Link
              href={v.href}
              aria-current={v.href === attiva ? "page" : undefined}
              className={cn(
                "flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium whitespace-nowrap transition-[color,background-color,box-shadow] [&_svg]:size-4",
                v.href === attiva ? "bg-card text-foreground shadow-card ring-1 ring-border" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {v.icona}
              {v.testo}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
