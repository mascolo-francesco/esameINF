import type { Metadata } from "next";
import { db } from "@/lib/server/db";
import { LIVELLO, richiediUtente } from "@/lib/server/auth/sessione";
import { formattaData, formattaDataOra } from "@/lib/formato";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormSanzione } from "../[codice]/pannelli";
import { FormRevoca } from "./revoca";

export const metadata: Metadata = { title: "Utenti e provvedimenti" };

export default async function UtentiModerazione({ searchParams }: PageProps<"/moderazione/utenti">) {
  const io = await richiediUtente(LIVELLO.moderatore, "/moderazione/utenti");
  const { q } = await searchParams;
  const cerca = typeof q === "string" ? q.trim().slice(0, 100) : "";

  const [provvedimenti, utenti] = await Promise.all([
    db.righe<{ id: number; tipo: string; motivazione: string; data_inizio: Date; data_fine: Date | null; destinatario: string }>(
      "SELECT id, tipo, motivazione, data_inizio, data_fine, destinatario FROM v_provvedimento_attivo ORDER BY data_inizio DESC",
    ),
    cerca
      ? db.righe<{
          id: number;
          nome_visualizzato: string;
          email: string;
          stato_account: string;
          ruolo: string;
          livello: number;
          data_registrazione: Date;
          segnalazioni: number;
        }>(
          `SELECT u.id, u.nome_visualizzato, u.email, u.stato_account, r.nome AS ruolo, r.livello, u.data_registrazione,
                  (SELECT COUNT(*) FROM segnalazione s WHERE s.id_autore = u.id AND s.stato_corrente <> 'BOZZA') AS segnalazioni
             FROM utente u JOIN ruolo r ON r.id = u.id_ruolo
            WHERE u.anonimizzato_il IS NULL AND (u.nome_visualizzato LIKE ? OR LOWER(u.email) LIKE ?)
            ORDER BY u.nome_visualizzato LIMIT 30`,
          [`%${cerca}%`, `%${cerca.toLowerCase()}%`],
        )
      : Promise.resolve([]),
  ]);

  return (
    <div className="grid gap-8">
      <section className="grid gap-3" aria-labelledby="attivi">
        <h2 id="attivi" className="text-lg font-semibold">
          Provvedimenti in corso
        </h2>
        {provvedimenti.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nessun utente sospeso o bannato.</p>
        ) : (
          <ul className="grid gap-2">
            {provvedimenti.map((p) => (
              <li key={p.id} className="grid gap-1 rounded-lg border p-3 text-sm">
                <p>
                  <span className="font-medium">{p.destinatario}</span> · {p.tipo === "ban" ? "ban permanente" : "sospensione"} dal{" "}
                  {formattaData(p.data_inizio)}
                  {p.data_fine && ` al ${formattaDataOra(p.data_fine)}`}
                </p>
                <p className="text-xs text-muted-foreground">{p.motivazione}</p>
                {io.livello >= LIVELLO.amministratore && <FormRevoca id={p.id} />}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-3" aria-labelledby="cerca">
        <h2 id="cerca" className="text-lg font-semibold">
          Cerca un utente
        </h2>
        <form method="get" className="flex max-w-md gap-2">
          <label htmlFor="q" className="sr-only">
            Nome visualizzato o email
          </label>
          <Input id="q" name="q" defaultValue={cerca} placeholder="Nome visualizzato o email" />
          <Button type="submit" variant="outline">
            Cerca
          </Button>
        </form>
        {cerca && utenti.length === 0 && <p className="text-sm text-muted-foreground">Nessun utente trovato.</p>}
        <ul className="grid gap-2">
          {utenti.map((u) => (
            <li key={u.id} className="grid gap-2 rounded-lg border p-3 text-sm">
              <p>
                <span className="font-medium">{u.nome_visualizzato}</span> <span className="text-muted-foreground">· {u.email}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                {u.ruolo} · account {u.stato_account} · registrato il {formattaData(u.data_registrazione)} · {u.segnalazioni} segnalazioni
              </p>
              {u.livello < io.livello && u.stato_account !== "cancellato" && <FormSanzione idUtente={u.id} nome={u.nome_visualizzato} />}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
