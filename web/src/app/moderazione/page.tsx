import type { Metadata } from "next";
import Link from "next/link";
import { Flag } from "lucide-react";
import { db } from "@/lib/server/db";
import { LIVELLO, richiediUtente } from "@/lib/server/auth/sessione";
import { formattaDataOra, tempoFa } from "@/lib/formato";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {voci.length === 0 ? "Nessun contenuto da controllare." : `${voci.length} contenuti da controllare, i più gravi in alto.`}
        </p>
        <form action={apriPerCodice} className="flex items-end gap-2">
          <label className="grid gap-1 text-xs font-medium">
            Apri una segnalazione
            <Input name="codice" placeholder="MI-2026-000012" className="w-44" required />
          </label>
          <Button type="submit" variant="outline" className="h-9">
            Apri
          </Button>
        </form>
      </div>
      {nontrovata && <p role="alert" className="text-sm text-destructive">Nessuna segnalazione con quel codice.</p>}

      <ul className="grid gap-3">
        {voci.map((v) => {
          const motivi = motiviDi(v);
          return (
            <li key={`${v.tipo_contenuto}-${v.id_contenuto}`} className="grid gap-2 rounded-lg border bg-card p-4">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded bg-muted px-1.5 py-0.5 font-medium capitalize">{v.tipo_contenuto}</span>
                <span className="text-muted-foreground">{ETICHETTE[v.stato] ?? v.stato}</span>
                <span className="text-muted-foreground" title={formattaDataOra(v.data_ingresso)}>
                  · {tempoFa(v.data_ingresso)}
                </span>
                {v.abusi_aperti > 0 && (
                  <span className="flex items-center gap-1 rounded bg-red-50 px-1.5 py-0.5 font-medium text-red-900">
                    <Flag className="size-3" aria-hidden />
                    {v.abusi_aperti} {v.abusi_aperti === 1 ? "segnalazione di abuso" : "segnalazioni di abuso"}
                    {motivi && `: ${motivi.replaceAll("_", " ")}`}
                  </span>
                )}
                <span className="ml-auto font-mono text-muted-foreground">{v.codice_pubblico}</span>
              </div>
              {v.tipo_contenuto === "segnalazione" ? (
                <Link href={`/moderazione/${v.codice_pubblico}`} className="font-medium text-primary underline-offset-4 hover:underline">
                  {v.anteprima}
                </Link>
              ) : (
                <p className="text-sm whitespace-pre-line">{v.anteprima}</p>
              )}
              {v.motivo && v.tipo_contenuto === "segnalazione" && <p className="text-xs text-muted-foreground">Motivo: {v.motivo}</p>}
              {v.tipo_contenuto !== "segnalazione" && (
                <AzioniContenuto tipo={v.tipo_contenuto} id={v.id_contenuto} visibile={v.stato === "visibile"} />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
