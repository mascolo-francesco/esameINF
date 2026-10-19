import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CaretDownIcon,
  FunnelSimpleIcon,
  HeartIcon,
  MagnifyingGlassIcon,
  TrendUpIcon,
  XIcon,
} from "@phosphor-icons/react/ssr";
import { classifica, PER_PAGINA, type FiltriClassifica } from "@/lib/server/consultazione";
import { elencoCategorie, elencoMunicipi, elencoQuartieri } from "@/lib/server/catalogo";
import { Pagina } from "@/components/pagina";
import { SchedaSegnalazione } from "@/components/scheda-segnalazione";
import { StatoVuoto } from "@/components/stato-vuoto";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FiltroScelta } from "./filtri";

export const metadata: Metadata = {
  title: "Classifica",
  description: "Le segnalazioni più sostenute e quelle di tendenza a Milano, per quartiere e categoria.",
};

const id = z.coerce.number().int().positive().catch(0);
const schemaFiltri = z.object({
  ordine: z.enum(["sostenute", "tendenza"]).catch("sostenute"),
  categoria: id,
  municipio: id,
  quartiere: id,
  tipo: z.enum(["problema", "proposta", ""]).catch(""),
  stato: z.enum(["PUBBLICATA", "PRESA_IN_CARICO", "INVIATA_CANDIDATI", ""]).catch(""),
  giorni: z.coerce.number().int().refine((n) => [7, 30, 90].includes(n)).catch(0),
  pagina: z.coerce.number().int().min(1).max(500).catch(1),
});

export default async function PaginaClassifica({ searchParams }: PageProps<"/classifica">) {
  const p = schemaFiltri.parse(await searchParams);
  const filtri: FiltriClassifica = {
    ordine: p.ordine,
    categoria: p.categoria || null,
    municipio: p.municipio || null,
    quartiere: p.quartiere || null,
    tipo: p.tipo || null,
    stato: p.stato || null,
    giorni: p.giorni || null,
    pagina: p.pagina,
  };
  const [{ voci, altre }, categorie, municipi, quartieri] = await Promise.all([
    classifica(filtri),
    elencoCategorie(),
    elencoMunicipi(),
    elencoQuartieri(),
  ]);

  const url = (modifiche: Record<string, string | number>) => {
    const q = new URLSearchParams();
    const tutti = { ...p, ...modifiche } as Record<string, string | number>;
    for (const [k, v] of Object.entries(tutti)) if (v && !(k === "pagina" && v === 1) && !(k === "ordine" && v === "sostenute")) q.set(k, String(v));
    const s = q.toString();
    return s ? `/classifica?${s}` : "/classifica";
  };

  // filtri attivi, con il link che li toglie uno alla volta
  const nomeDi = <T extends { id: number; nome: string }>(lista: T[], id: number) => lista.find((x) => x.id === id)?.nome ?? "";
  const attivi = [
    p.categoria && { chiave: "categoria", testo: nomeDi(categorie, p.categoria) },
    p.municipio && { chiave: "municipio", testo: nomeDi(municipi, p.municipio) },
    p.quartiere && { chiave: "quartiere", testo: nomeDi(quartieri, p.quartiere) },
    p.tipo && { chiave: "tipo", testo: p.tipo === "problema" ? "Problemi" : "Proposte" },
    p.stato && { chiave: "stato", testo: STATI[p.stato] },
    p.giorni && { chiave: "giorni", testo: `Ultimi ${p.giorni} giorni` },
  ].filter((f): f is { chiave: string; testo: string } => Boolean(f));

  return (
    <Pagina titolo="Classifica" descrizione="Le segnalazioni pubblicate, ordinate per sostegno dei cittadini.">
      <div className="grid grid-cols-1 gap-5">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b">
          <nav aria-label="Ordinamento" className="-mb-px flex gap-6">
            {(
              [
                ["sostenute", "Più sostenute", <HeartIcon key="s" aria-hidden />],
                ["tendenza", "Di tendenza", <TrendUpIcon key="t" aria-hidden />],
              ] as const
            ).map(([v, t, icona]) => (
              <Link
                key={v}
                href={url({ ordine: v, pagina: 1 })}
                aria-current={p.ordine === v ? "page" : undefined}
                className={cn(
                  "flex h-11 items-center gap-2 border-b-2 text-[15px] whitespace-nowrap transition-colors [&_svg]:size-4",
                  p.ordine === v ? "border-primary font-semibold text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {icona}
                {t}
              </Link>
            ))}
          </nav>
          {p.ordine === "tendenza" && (
            <p className="max-w-md pb-3 text-sm text-muted-foreground">
              Premia le segnalazioni recenti: il punteggio cala man mano che passano i giorni dalla pubblicazione.
            </p>
          )}
        </div>

        <details className="group bg-sunken" open={attivi.length > 0}>
          <summary className="flex h-12 cursor-pointer list-none items-center gap-2 px-4 text-sm font-medium select-none [&::-webkit-details-marker]:hidden">
            <FunnelSimpleIcon className="size-4 text-muted-foreground" aria-hidden />
            Filtri
            {attivi.length > 0 && (
              <span className="bg-tinta-100 px-2 py-0.5 text-xs font-semibold text-tinta-ink tabular-nums">
                {attivi.length}
                <span className="sr-only"> attivi</span>
              </span>
            )}
            <CaretDownIcon className="ml-auto size-4 text-muted-foreground transition-transform duration-200 group-open:rotate-180" aria-hidden />
          </summary>
          <form method="get" action="/classifica" className="grid grid-cols-2 gap-3 px-4 pb-4 sm:grid-cols-3 lg:grid-cols-6" aria-label="Filtri">
            {p.ordine !== "sostenute" && <input type="hidden" name="ordine" value={p.ordine} />}
            <FiltroScelta etichetta="Categoria" nome="categoria" valore={p.categoria || ""} vuoto="Tutte" opzioni={categorie.map((k) => [k.id, k.nome])} />
            <FiltroScelta etichetta="Municipio" nome="municipio" valore={p.municipio || ""} vuoto="Tutti" opzioni={municipi.map((m) => [m.id, m.nome])} />
            <FiltroScelta
              etichetta="Quartiere"
              nome="quartiere"
              valore={p.quartiere || ""}
              vuoto="Tutti"
              opzioni={quartieri.filter((q) => !p.municipio || q.idMunicipio === p.municipio).map((q) => [q.id, q.nome])}
            />
            <FiltroScelta etichetta="Tipo" nome="tipo" valore={p.tipo} vuoto="Tutti" opzioni={[["problema", "Problemi"], ["proposta", "Proposte"]]} />
            <FiltroScelta etichetta="Stato" nome="stato" valore={p.stato} vuoto="Tutti" opzioni={Object.entries(STATI)} />
            <FiltroScelta
              etichetta="Periodo"
              nome="giorni"
              valore={p.giorni || ""}
              vuoto="Sempre"
              opzioni={[7, 30, 90].map((g) => [g, `Ultimi ${g} giorni`])}
            />
          </form>
        </details>

        {attivi.length > 0 && (
          <div className="flex flex-wrap items-center gap-2" aria-label="Filtri attivi" role="group">
            {attivi.map((f) => (
              <Link
                key={f.chiave}
                href={url({ [f.chiave]: "", pagina: 1 })}
                className="inline-flex h-8 items-center gap-1.5 bg-tinta-50 pr-2 pl-3 text-sm text-tinta-ink transition-colors hover:bg-negativo hover:text-negativo-ink"
              >
                {f.testo}
                <XIcon className="size-3.5" aria-hidden />
                <span className="sr-only">: togli il filtro</span>
              </Link>
            ))}
            <Link
              href={p.ordine === "tendenza" ? "/classifica?ordine=tendenza" : "/classifica"}
              className="px-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Azzera tutto
            </Link>
          </div>
        )}

        <h2 className="sr-only">Risultati</h2>
        {voci.length === 0 ? (
          <StatoVuoto icona={<MagnifyingGlassIcon weight="duotone" />} titolo="Nessuna segnalazione con questi filtri">
            Prova a togliere un filtro o a scegliere un periodo più lungo.
          </StatoVuoto>
        ) : (
          <ol className="grid divide-y border-y">
            {voci.map((v, i) => (
              <li key={v.id}>
                <SchedaSegnalazione s={v} posizione={(p.pagina - 1) * PER_PAGINA + i + 1} />
              </li>
            ))}
          </ol>
        )}

        {(p.pagina > 1 || altre) && (
          <nav aria-label="Pagine" className="flex items-center justify-between gap-3">
            {p.pagina > 1 ? (
              <Link href={url({ pagina: p.pagina - 1 })} className={buttonVariants({ variant: "outline" })}>
                <ArrowLeftIcon aria-hidden />
                Precedenti
              </Link>
            ) : (
              <span />
            )}
            <span className="text-sm text-muted-foreground tabular-nums">Pagina {p.pagina}</span>
            {altre ? (
              <Link href={url({ pagina: p.pagina + 1 })} className={buttonVariants({ variant: "outline" })}>
                Successive
                <ArrowRightIcon aria-hidden />
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </div>
    </Pagina>
  );
}

const STATI = { PUBBLICATA: "Pubblicata", PRESA_IN_CARICO: "Presa in carico", INVIATA_CANDIDATI: "Inviata ai candidati" } as Record<string, string>;
