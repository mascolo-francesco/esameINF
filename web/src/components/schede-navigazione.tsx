"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/** Schede di una sezione (moderazione, amministrazione): evidenzia quella della pagina corrente. */
export function SchedeNavigazione({ voci }: { voci: { href: string; testo: string }[] }) {
  const percorso = usePathname();
  // la scheda attiva è quella con il prefisso più lungo che corrisponde al percorso
  const attiva = voci
    .filter((v) => percorso === v.href || percorso.startsWith(`${v.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
  return (
    <nav aria-label="Sezioni" className="-mx-4 overflow-x-auto px-4">
      <ul className="flex gap-1 border-b">
        {voci.map((v) => (
          <li key={v.href}>
            <Link
              href={v.href}
              aria-current={v.href === attiva ? "page" : undefined}
              className={cn(
                "-mb-px block border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap",
                v.href === attiva ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {v.testo}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
