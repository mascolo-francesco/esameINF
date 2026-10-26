"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClockCounterClockwiseIcon,
  FileTextIcon,
  GaugeIcon,
  type Icon,
  ShieldCheckIcon,
  SlidersHorizontalIcon,
  TagIcon,
  UserGearIcon,
  UsersIcon,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

interface Voce {
  href: string;
  testo: string;
  Icona: Icon;
}

const MODERAZIONE: Voce[] = [
  { href: "/moderazione", testo: "Coda di revisione", Icona: ShieldCheckIcon },
  { href: "/moderazione/utenti", testo: "Utenti e provvedimenti", Icona: UsersIcon },
];
const AMMINISTRAZIONE: Voce[] = [
  { href: "/admin", testo: "Dashboard", Icona: GaugeIcon },
  { href: "/admin/documenti", testo: "Documento programmatico", Icona: FileTextIcon },
  { href: "/admin/utenti", testo: "Ruoli", Icona: UserGearIcon },
  { href: "/admin/categorie", testo: "Categorie", Icona: TagIcon },
  { href: "/admin/parametri", testo: "Parametri", Icona: SlidersHorizontalIcon },
  { href: "/admin/audit", testo: "Registro di audit", Icona: ClockCounterClockwiseIcon },
];

/** La voce attiva è quella con il prefisso più lungo che corrisponde al percorso. */
function useAttiva(admin: boolean) {
  const percorso = usePathname();
  const voci = admin ? [...MODERAZIONE, ...AMMINISTRAZIONE] : MODERAZIONE;
  return voci
    .filter((v) => percorso === v.href || percorso.startsWith(`${v.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];
}

/** Il titolo della schermata è il nome della voce attiva: una sola fonte, nessuna pagina da toccare. */
export function TitoloStaff({ admin }: { admin: boolean }) {
  const attiva = useAttiva(admin);
  return <h1 className="text-[1.75rem] leading-tight tracking-tight">{attiva?.testo ?? "Area del comitato"}</h1>;
}

/**
 * Menu dell'area del comitato. Da desktop è una colonna a sinistra con i gruppi;
 * sul telefono diventa una riga che scorre di lato, con la voce attiva portata in vista.
 */
export function NavStaff({ admin, inCoda }: { admin: boolean; inCoda: number }) {
  const attiva = useAttiva(admin)?.href;
  const lista = useRef<HTMLElement>(null);
  useEffect(() => {
    lista.current?.querySelector<HTMLElement>('[aria-current="page"]')?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [attiva]);

  const gruppi: [string, Voce[]][] = admin
    ? [
        ["Moderazione", MODERAZIONE],
        ["Amministrazione", AMMINISTRAZIONE],
      ]
    : [["Moderazione", MODERAZIONE]];

  return (
    <nav
      ref={lista}
      aria-label="Area del comitato"
      className="-mx-4 flex gap-1 overflow-x-auto px-4 [scrollbar-width:none] lg:-mx-3 lg:grid lg:content-start lg:gap-6 lg:overflow-visible lg:px-0"
    >
      {gruppi.map(([nome, voci]) => (
        <div key={nome} className="contents lg:grid lg:gap-0.5">
          <p className="hidden px-3 pb-1 text-[13px] text-muted-foreground lg:block">{nome}</p>
          {voci.map(({ href, testo, Icona }) => {
            const qui = href === attiva;
            return (
              <Link
                key={href}
                href={href}
                aria-current={qui ? "page" : undefined}
                className={cn(
                  "flex h-10 flex-none items-center gap-2.5 px-3 text-sm whitespace-nowrap transition-colors lg:h-8",
                  // voce attiva in grigio neutro: il colore del sito resta sui dati e sulle azioni
                  qui ? "bg-sunken font-semibold text-foreground" : "text-muted-foreground hover:bg-sunken hover:text-foreground",
                )}
              >
                <Icona className="size-4 flex-none" weight={qui ? "bold" : "regular"} aria-hidden />
                <span className="flex-1">{testo}</span>
                {href === "/moderazione" && inCoda > 0 && (
                  <span className="text-xs font-semibold tabular-nums" aria-label={`${inCoda} da controllare`}>
                    {inCoda}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
