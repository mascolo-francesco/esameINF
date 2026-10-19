import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRightIcon,
  ArrowsClockwiseIcon,
  ChatCircleIcon,
  CheckCircleIcon,
  FlagIcon,
  MagnifyingGlassIcon,
  MegaphoneIcon,
} from "@phosphor-icons/react/ssr";
import { db } from "@/lib/server/db";
import { LIVELLO, richiediUtente } from "@/lib/server/auth/sessione";
import { formattaDataOra, tempoFa } from "@/lib/formato";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatoVuoto } from "@/components/stato-vuoto";
import { cn } from "@/lib/utils";
import { apriPerCodice } from "./azioni";
import { AzioniContenuto } from "./azioni-contenuto";

export const metadata: Metadata = { title: "Moderazione" };

interface Voce {
  tipo_contenuto: "segnalazione" | "commento" | "aggiornamento";
  id_contenuto: number;
  codice_pubblico: string;
  anteprima: string | null;
  stato: string;
  data_ingresso: Date;
  abusi_aperti: number;
  motivo: string | null;
  gravita: number;
}

const ETICHETTE: Record<string, string> = {
  IN_REVISIONE: "In revisione",
  PUBBLICATA: "Pubblicata",
  PRESA_IN_CARICO: "Presa in carico",
  in_revisione: "In revisione",
  visibile: "Visibile",
};

export default async function CodaModerazione({ searchParams }: PageProps<"/moderazione">) {
  await richiediUtente(LIVELLO.moderatore, "/moderazione");
  const { nontrovata } = await searchParams;
  // RF-42: query coda_moderazione
  const voci = await db.righe<Voce>("SELECT * FROM v_coda_moderazione ORDER BY gravita DESC, data_ingresso LIMIT 100");
  const motiviAbuso = await db.righe<{ id_segnalazione: number | null; id_commento: number | null; id_aggiornamento: number | null; motivi: string }>(
    `SELECT id_segnalazione, id_commento, id_aggiornamento, GROUP_CONCAT(DISTINCT motivo SEPARATOR ', ') AS motivi
       FROM segnalazione_abuso WHERE esito = 'aperta'
      GROUP BY id_segnalazione, id_commento, id_aggiornamento`,
  );
  const motiviDi = (v: Voce) =>
    motiviAbuso.find((m) =>
      v.tipo_contenuto === "segnalazione"
        ? m.id_segnalazione === v.id_contenuto
        : v.tipo_contenuto === "commento"
          ? m.id_commento === v.id_contenuto
          : m.id_aggiornamento === v.id_contenuto,
    )?.motivi;

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <p className="text-muted-foreground" role="status">
          {voci.length === 0
            ? "Nessun contenuto da controllare."
            : voci.length === 1
              ? "1 contenuto da controllare."
              : `${voci.length} contenuti da controllare, i più gravi in alto.`}
        </p>
        <form action={apriPerCodice} className="flex w-full items-end gap-2 sm:w-auto">
          <label className="grid flex-1 gap-1.5 text-sm font-medium sm:flex-none">
            Apri una segnalazione per codice
            <Input name="codice" placeholder="MI-2026-000012" className="font-mono sm:w-52" required />
          </label>
          <Button type="submit" variant="outline">
            <MagnifyingGlassIcon aria-hidden />
            Apri
          </Button>
        </form>
      </div>
      {nontrovata && (
        <p role="alert" className="text-sm text-destructive">
          Nessuna segnalazione con quel codice.
        </p>
      )}

      {voci.length === 0 ? (
        <StatoVuoto icona={<CheckCircleIcon weight="duotone" />} titolo="Coda vuota">
          Quando arrivano nuove segnalazioni o qualcuno segnala un abuso, compaiono qui.
        </StatoVuoto>
      ) : (
        <ul className="grid gap-3">
          {voci.map((v) => {
            const motivi = motiviDi(v);
            const Icona = ICONE_TIPO[v.tipo_contenuto];
            return (
              <li
                key={`${v.tipo_contenuto}-${v.id_contenuto}`}
                className={cn(
                  "grid gap-3 rounded-xl border border-l-4 bg-card p-4 shadow-card",
                  v.abusi_aperti > 0 ? "border-l-destructive" : "border-l-amber-400",
                )}
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
                  <span className="flex items-center gap-1.5 font-medium capitalize">
                    <Icona className="size-4 text-muted-foreground" aria-hidden />
                    {v.tipo_contenuto}
                  </span>
                  <span className="text-muted-foreground">{ETICHETTE[v.stato] ?? v.stato}</span>
                  <time className="text-muted-foreground" dateTime={new Date(v.data_ingresso).toISOString()} title={formattaDataOra(v.data_ingresso)}>
                    {tempoFa(v.data_ingresso)}
                  </time>
                  <span className="ml-auto font-mono text-xs text-muted-foreground">{v.codice_pubblico}</span>
                </div>
                {v.abusi_aperti > 0 && (
                  <p className="flex w-fit items-center gap-1.5 rounded-md bg-red-50 px-2 py-1 text-sm font-medium text-red-900">
                    <FlagIcon weight="fill" className="size-4" aria-hidden />
                    {v.abusi_aperti} {v.abusi_aperti === 1 ? "segnalazione di abuso" : "segnalazioni di abuso"}
                    {motivi && `: ${motivi.replaceAll("_", " ")}`}
                  </p>
                )}
                {v.tipo_contenuto === "segnalazione" ? (
                  <Link
                    href={`/moderazione/${v.codice_pubblico}`}
                    className="flex items-center justify-between gap-3 text-lg leading-snug font-semibold text-foreground underline-offset-4 hover:text-primary hover:underline"
                  >
                    {v.anteprima}
                    <ArrowRightIcon className="size-5 shrink-0 text-primary" aria-hidden />
                  </Link>
                ) : (
                  <blockquote className="border-l-2 pl-3 text-sm whitespace-pre-line">{v.anteprima}</blockquote>
                )}
                {v.motivo && v.tipo_contenuto === "segnalazione" && <p className="text-sm text-muted-foreground">Motivo: {v.motivo}</p>}
                {v.tipo_contenuto !== "segnalazione" && (
                  <AzioniContenuto tipo={v.tipo_contenuto} id={v.id_contenuto} visibile={v.stato === "visibile"} />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

const ICONE_TIPO = { segnalazione: MegaphoneIcon, commento: ChatCircleIcon, aggiornamento: ArrowsClockwiseIcon };
