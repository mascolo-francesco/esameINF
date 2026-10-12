import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/server/db";
import { LIVELLO, richiediUtente } from "@/lib/server/auth/sessione";
import { formattaData } from "@/lib/formato";
import { PulsanteAzione } from "@/components/pulsante-azione";
import { attivaCandidato } from "../azioni";
import { FormCandidato, FormDocumento } from "../moduli";

export const metadata: Metadata = { title: "Documento programmatico" };

const STATI: Record<string, string> = { bozza: "Bozza", definitivo: "Definitivo", inviato: "Inviato" };

export default async function Documenti() {
  await richiediUtente(LIVELLO.amministratore, "/admin/documenti");
  const [documenti, candidati, presi] = await Promise.all([
    db.righe<{ id: number; titolo: string; versione: number; stato: string; data_creazione: Date; data_invio: Date | null; n: number }>(
      `SELECT d.id, d.titolo, d.versione, d.stato, d.data_creazione, d.data_invio,
              (SELECT COUNT(*) FROM documento_segnalazione x WHERE x.id_documento = d.id) AS n
         FROM documento_programmatico d ORDER BY d.data_creazione DESC`,
    ),
    db.righe<{ id: number; nome: string; cognome: string; lista_coalizione: string; email_contatto: string; attivo: number }>(
      "SELECT id, nome, cognome, lista_coalizione, email_contatto, attivo FROM candidato ORDER BY cognome, nome",
    ),
    db.riga<{ n: number }>("SELECT COUNT(*) AS n FROM segnalazione WHERE stato_corrente = 'PRESA_IN_CARICO'"),
  ]);

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_24rem]">
      <div className="grid content-start gap-6">
        <p className="text-sm text-muted-foreground">
          Il documento raccoglie le segnalazioni prese in carico dal comitato ({presi?.n ?? 0} al momento). Quando è definitivo si
          esporta in CSV e si invia a tutti i candidati attivi insieme, senza preferenze.
        </p>
        <section className="grid gap-3" aria-labelledby="elenco-doc">
          <h2 id="elenco-doc" className="font-semibold">
            Documenti
          </h2>
          {documenti.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessun documento ancora.</p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {documenti.map((d) => (
                <li key={d.id}>
                  <Link href={`/admin/documenti/${d.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 p-3 hover:bg-muted/50">
                    <span className="flex-1 font-medium">
                      {d.titolo} <span className="text-muted-foreground">v{d.versione}</span>
                    </span>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-xs">{STATI[d.stato]}</span>
                    <span className="w-full text-xs text-muted-foreground sm:w-auto">
                      {d.n} segnalazioni · creato il {formattaData(d.data_creazione)}
                      {d.data_invio && ` · inviato il ${formattaData(d.data_invio)}`}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="grid gap-3 rounded-lg border p-4" aria-labelledby="nuovo-doc">
          <h2 id="nuovo-doc" className="font-semibold">
            Nuovo documento
          </h2>
          <FormDocumento />
        </section>
      </div>

      <section className="grid content-start gap-4" aria-labelledby="candidati">
        <h2 id="candidati" className="font-semibold">
          Candidati sindaco
        </h2>
        <ul className="grid gap-2">
          {candidati.map((c) => (
            <li key={c.id} className="flex items-start justify-between gap-2 rounded-lg border p-3 text-sm">
              <div className={c.attivo ? undefined : "opacity-60"}>
                <p className="font-medium">
                  {c.nome} {c.cognome}
                </p>
                <p className="text-xs text-muted-foreground">{c.lista_coalizione}</p>
                <p className="text-xs text-muted-foreground">{c.email_contatto}</p>
              </div>
              <PulsanteAzione size="sm" variant="ghost" azione={attivaCandidato.bind(null, c.id, !c.attivo)}>
                {c.attivo ? "Disattiva" : "Riattiva"}
              </PulsanteAzione>
            </li>
          ))}
        </ul>
        <div className="rounded-lg border p-4">
          <FormCandidato />
        </div>
      </section>
    </div>
  );
}
