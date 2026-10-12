import type { Metadata } from "next";
import { db } from "@/lib/server/db";
import { LIVELLO, richiediUtente } from "@/lib/server/auth/sessione";
import { formattaDataOra } from "@/lib/formato";
import { FormParametro } from "../moduli";

export const metadata: Metadata = { title: "Parametri" };

const GRUPPI: [string, string][] = [
  ["priorita.", "Punteggio di priorità"],
  ["segnalazione.", "Segnalazioni"],
  ["abuso.", "Segnalazioni di abuso"],
  ["auth.", "Accesso e sicurezza"],
  ["account.", "Account"],
  ["log.", "Registri"],
  ["ia.", "Moduli di intelligenza artificiale (non attivi nella demo)"],
];

export default async function Parametri() {
  await richiediUtente(LIVELLO.amministratore, "/admin/parametri");
  const righe = await db.righe<{
    chiave: string;
    valore: number;
    valore_min: number;
    valore_max: number;
    unita: string | null;
    descrizione: string;
    data_modifica: Date;
    modificato_da: string | null;
  }>(
    `SELECT p.chiave, p.valore, p.valore_min, p.valore_max, p.unita, p.descrizione, p.data_modifica, u.nome_visualizzato AS modificato_da
       FROM parametro_sistema p LEFT JOIN utente u ON u.id = p.id_utente_modifica ORDER BY p.chiave`,
  );
  return (
    <div className="grid gap-8">
      <p className="text-sm text-muted-foreground">
        Ogni modifica finisce nel registro di audit. Se cambi i pesi della priorità, i punteggi di tutte le segnalazioni si ricalcolano.
      </p>
      {GRUPPI.map(([prefisso, titolo]) => (
        <section key={prefisso} className="grid gap-2" aria-labelledby={`g-${prefisso}`}>
          <h2 id={`g-${prefisso}`} className="font-semibold">
            {titolo}
          </h2>
          <ul className="divide-y rounded-lg border">
            {righe
              .filter((r) => r.chiave.startsWith(prefisso))
              .map((r) => (
                <li key={r.chiave} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-3">
                  <div className="grid min-w-0 flex-1 gap-0.5">
                    <span className="text-sm">{r.descrizione}</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {r.chiave} · da {r.valore_min} a {r.valore_max}
                      {r.unita ? ` ${r.unita}` : ""}
                      {r.modificato_da && ` · modificato da ${r.modificato_da} il ${formattaDataOra(r.data_modifica)}`}
                    </span>
                  </div>
                  <FormParametro chiave={r.chiave} valore={r.valore} min={r.valore_min} max={r.valore_max} />
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
