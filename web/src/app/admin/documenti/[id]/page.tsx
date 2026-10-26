import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DownloadSimpleIcon } from "@phosphor-icons/react/ssr";
import { db } from "@/lib/server/db";
import { LIVELLO, richiediUtente } from "@/lib/server/auth/sessione";
import { formattaDataOra, nomeQuartiere } from "@/lib/formato";
import { PulsanteAzione } from "@/components/pulsante-azione";
import { buttonVariants } from "@/components/ui/button";
import { inviaDocumento, rendiDefinitivo, togliSegnalazione } from "../../azioni";
import { FormIncludi } from "../../moduli";

export const metadata: Metadata = { title: "Documento programmatico" };

export default async function Documento({ params }: PageProps<"/admin/documenti/[id]">) {
  await richiediUtente(LIVELLO.amministratore, "/admin/documenti");
  const idDoc = Number((await params).id);
  if (!Number.isInteger(idDoc)) notFound();
  const d = await db.riga<{ id: number; titolo: string; versione: number; stato: string; introduzione: string | null; data_invio: Date | null }>(
    "SELECT id, titolo, versione, stato, introduzione, data_invio FROM documento_programmatico WHERE id = ?",
    [idDoc],
  );
  if (!d) notFound();

  const [incluse, disponibili, invii, candidatiAttivi] = await Promise.all([
    db.righe<{ id: number; posizione: number; codice_pubblico: string; titolo: string; quartiere: string; num_sostegni: number; nota_comitato: string | null }>(
      `SELECT s.id, ds.posizione, s.codice_pubblico, s.titolo, q.nome AS quartiere, s.num_sostegni, ds.nota_comitato
         FROM documento_segnalazione ds
         JOIN segnalazione s ON s.id = ds.id_segnalazione
         JOIN quartiere q ON q.id = s.id_quartiere
        WHERE ds.id_documento = ? ORDER BY ds.posizione`,
      [idDoc],
    ),
    d.stato === "bozza"
      ? db.righe<{ id: number; codice_pubblico: string; titolo: string; quartiere: string; num_sostegni: number; punteggio_priorita: number }>(
          `SELECT s.id, s.codice_pubblico, s.titolo, q.nome AS quartiere, s.num_sostegni, s.punteggio_priorita
             FROM segnalazione s JOIN quartiere q ON q.id = s.id_quartiere
            WHERE s.stato_corrente = 'PRESA_IN_CARICO'
              AND NOT EXISTS (SELECT 1 FROM documento_segnalazione x WHERE x.id_documento = ? AND x.id_segnalazione = s.id)
            ORDER BY s.punteggio_priorita DESC`,
          [idDoc],
        )
      : Promise.resolve([]),
    db.righe<{ nome: string; cognome: string; email_inviata: string; data_invio: Date }>(
      `SELECT c.nome, c.cognome, i.email_inviata, i.data_invio FROM invio_documento i JOIN candidato c ON c.id = i.id_candidato
        WHERE i.id_documento = ? ORDER BY c.cognome`,
      [idDoc],
    ),
    db.riga<{ n: number }>("SELECT COUNT(*) AS n FROM candidato WHERE attivo"),
  ]);

  return (
    <div className="grid gap-6">
      <Link href="/admin/documenti" className="text-sm text-primary underline-offset-4 hover:underline">
        ← Tutti i documenti
      </Link>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <h2 className="text-xl font-semibold">
            {d.titolo} <span className="text-muted-foreground">v{d.versione}</span>
          </h2>
          <p className="text-sm text-muted-foreground">
            Stato: {d.stato}
            {d.data_invio && ` · inviato il ${formattaDataOra(d.data_invio)}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {incluse.length > 0 && (
            <a href={`/api/documenti/${d.id}/csv`} className={buttonVariants({ variant: "outline" })}>
              <DownloadSimpleIcon weight="bold" className="size-4" aria-hidden /> Esporta CSV
            </a>
          )}
          {d.stato === "bozza" && (
            <PulsanteAzione
              variant="outline"
              azione={rendiDefinitivo.bind(null, d.id)}
              conferma="Dopo questo passaggio il documento non sarà più modificabile. Vuoi continuare?"
            >
              Rendi definitivo
            </PulsanteAzione>
          )}
          {d.stato === "definitivo" && (
            <PulsanteAzione
              azione={inviaDocumento.bind(null, d.id)}
              conferma={`Il documento risulterà inviato a tutti i ${candidatiAttivi?.n ?? 0} candidati attivi. Vuoi continuare?`}
            >
              Invia ai candidati
            </PulsanteAzione>
          )}
        </div>
      </header>
      {d.introduzione && <p className="max-w-3xl whitespace-pre-line">{d.introduzione}</p>}

      <section className="grid gap-3" aria-labelledby="incluse">
        <h3 id="incluse" className="font-semibold">
          Segnalazioni incluse ({incluse.length})
        </h3>
        {incluse.length === 0 && <p className="text-sm text-muted-foreground">Nessuna segnalazione inclusa.</p>}
        <ol className="grid gap-2">
          {incluse.map((s) => (
            <li key={s.id} className="flex flex-wrap items-start gap-3 rounded-lg border p-3 text-sm">
              <span className="w-6 font-semibold text-muted-foreground tabular-nums">{s.posizione}</span>
              <div className="grid min-w-0 flex-1 gap-0.5">
                <Link href={`/segnalazioni/${s.codice_pubblico}`} className="font-medium hover:underline">
                  {s.titolo}
                </Link>
                <span className="text-xs text-muted-foreground">
                  {s.codice_pubblico} · {nomeQuartiere(s.quartiere)} · {s.num_sostegni} sostegni
                </span>
                {s.nota_comitato && <p className="text-xs">Nota: {s.nota_comitato}</p>}
              </div>
              {d.stato === "bozza" && (
                <PulsanteAzione size="sm" variant="ghost" azione={togliSegnalazione.bind(null, d.id, s.id)}>
                  Togli
                </PulsanteAzione>
              )}
            </li>
          ))}
        </ol>
      </section>

      {d.stato === "bozza" && (
        <section className="grid gap-3" aria-labelledby="disponibili">
          <h3 id="disponibili" className="font-semibold">
            Prese in carico da includere
          </h3>
          {disponibili.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nessuna. Una segnalazione pubblicata si prende in carico dalla sua scheda di moderazione.
            </p>
          )}
          <ul className="grid gap-2">
            {disponibili.map((s) => (
              <li key={s.id} className="grid gap-2 rounded-lg border p-3 text-sm">
                <p>
                  <span className="font-medium">{s.titolo}</span>{" "}
                  <span className="text-xs text-muted-foreground">
                    {s.codice_pubblico} · {nomeQuartiere(s.quartiere)} · {s.num_sostegni} sostegni
                  </span>
                </p>
                <FormIncludi idDocumento={d.id} idSegnalazione={s.id} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {invii.length > 0 && (
        <section className="grid gap-2" aria-labelledby="invii">
          <h3 id="invii" className="font-semibold">
            Invii registrati
          </h3>
          <p className="text-xs text-muted-foreground">Nella versione dimostrativa non viene inviata alcuna email: l&apos;elenco registra i destinatari.</p>
          <ul className="grid gap-1 text-sm">
            {invii.map((i) => (
              <li key={i.email_inviata}>
                {i.nome} {i.cognome} · {i.email_inviata} · {formattaDataOra(i.data_invio)}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
