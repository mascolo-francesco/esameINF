import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { classifica, PER_PAGINA, type FiltriClassifica } from "@/lib/server/consultazione";
import { elencoCategorie, elencoMunicipi, elencoQuartieri } from "@/lib/server/catalogo";
import { Pagina } from "@/components/pagina";
import { SchedaSegnalazione } from "@/components/scheda-segnalazione";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FiltriAutomatici } from "./filtri";

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

const classeSelect = "h-9 w-full min-w-0 rounded-lg border border-input bg-background px-2 text-sm";

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

  return (
    <Pagina titolo="Classifica" descrizione="Le segnalazioni pubblicate, ordinate per sostegno dei cittadini.">
      <div className="grid grid-cols-1 gap-6">
        <nav aria-label="Ordinamento" className="flex gap-1 rounded-lg bg-muted p-1 sm:w-fit">
          {(
            [
              ["sostenute", "Più sostenute"],
              ["tendenza", "Di tendenza"],
            ] as const
          ).map(([v, t]) => (
            <Link
              key={v}
              href={url({ ordine: v, pagina: 1 })}
              aria-current={p.ordine === v ? "page" : undefined}
              className={cn(
                "flex-1 rounded-md px-3 py-1.5 text-center text-sm font-medium whitespace-nowrap",
                p.ordine === v ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t}
            </Link>
          ))}
        </nav>
        {p.ordine === "tendenza" && (
          <p className="-mt-3 text-sm text-muted-foreground">
            &quot;Di tendenza&quot; premia le segnalazioni recenti: il punteggio si riduce man mano che passano i giorni dalla pubblicazione.
          </p>
        )}

        <form method="get" action="/classifica" className="grid grid-cols-1 gap-3 rounded-lg border p-4 sm:grid-cols-3 lg:grid-cols-6" aria-label="Filtri">
          <FiltriAutomatici />
          {p.ordine !== "sostenute" && <input type="hidden" name="ordine" value={p.ordine} />}
          <label className="grid gap-1 text-xs font-medium">
            Categoria
            <select name="categoria" defaultValue={p.categoria || ""} className={classeSelect}>
              <option value="">Tutte</option>
              {categorie.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-medium">
            Municipio
            <select name="municipio" defaultValue={p.municipio || ""} className={classeSelect}>
              <option value="">Tutti</option>
              {municipi.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-medium">
            Quartiere
            <select name="quartiere" defaultValue={p.quartiere || ""} className={classeSelect}>
              <option value="">Tutti</option>
              {quartieri
                .filter((q) => !p.municipio || q.idMunicipio === p.municipio)
                .map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.nome}
                  </option>
                ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-medium">
            Tipo
            <select name="tipo" defaultValue={p.tipo} className={classeSelect}>
              <option value="">Tutti</option>
              <option value="problema">Problemi</option>
              <option value="proposta">Proposte</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs font-medium">
            Stato
            <select name="stato" defaultValue={p.stato} className={classeSelect}>
              <option value="">Tutti</option>
              <option value="PUBBLICATA">Pubblicata</option>
              <option value="PRESA_IN_CARICO">Presa in carico</option>
              <option value="INVIATA_CANDIDATI">Inviata ai candidati</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs font-medium">
            Periodo
            <select name="giorni" defaultValue={p.giorni || ""} className={classeSelect}>
              <option value="">Sempre</option>
              <option value="7">Ultimi 7 giorni</option>
              <option value="30">Ultimi 30 giorni</option>
              <option value="90">Ultimi 90 giorni</option>
            </select>
          </label>
          <div className="flex gap-2 sm:col-span-3 lg:col-span-6">
            <button type="submit" className={cn(buttonVariants({ size: "sm" }), "js-nascondi")}>
              Applica i filtri
            </button>
            <Link href={p.ordine === "tendenza" ? "/classifica?ordine=tendenza" : "/classifica"} className={buttonVariants({ variant: "ghost", size: "sm" })}>
              Azzera
            </Link>
          </div>
        </form>

        {voci.length === 0 ? (
          <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">Nessuna segnalazione con questi filtri.</p>
        ) : (
          <ol className="grid gap-3">
            {voci.map((v, i) => (
              <li key={v.id}>
                <SchedaSegnalazione s={v} posizione={(p.pagina - 1) * PER_PAGINA + i + 1} />
              </li>
            ))}
          </ol>
        )}

        {(p.pagina > 1 || altre) && (
          <nav aria-label="Pagine" className="flex justify-between">
            {p.pagina > 1 ? (
              <Link href={url({ pagina: p.pagina - 1 })} className={buttonVariants({ variant: "outline" })}>
                ← Precedenti
              </Link>
            ) : (
              <span />
            )}
            {altre && (
              <Link href={url({ pagina: p.pagina + 1 })} className={buttonVariants({ variant: "outline" })}>
                Successive →
              </Link>
            )}
          </nav>
        )}
      </div>
    </Pagina>
  );
}
