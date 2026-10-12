import type { Metadata } from "next";
import { db } from "@/lib/server/db";
import { LIVELLO, richiediUtente } from "@/lib/server/auth/sessione";
import { formattaNumero } from "@/lib/formato";

export const metadata: Metadata = { title: "Dashboard" };

interface Barra {
  etichetta: string;
  valore: number;
  dettaglio?: string;
  colore?: string;
}

/** Barre orizzontali dentro una tabella: i numeri restano leggibili anche senza il grafico. */
function TabellaBarre({ titolo, colonna, righe }: { titolo: string; colonna: string; righe: Barra[] }) {
  const max = Math.max(1, ...righe.map((r) => r.valore));
  return (
    <section className="grid content-start gap-3 rounded-lg border bg-card p-4">
      <h2 className="font-semibold">{titolo}</h2>
      <table className="w-full text-sm">
        <thead className="sr-only">
          <tr>
            <th scope="col">Voce</th>
            <th scope="col">{colonna}</th>
          </tr>
        </thead>
        <tbody>
          {righe.map((r) => (
            <tr key={r.etichetta} title={`${r.etichetta}: ${formattaNumero(r.valore)} ${colonna.toLowerCase()}${r.dettaglio ? ` · ${r.dettaglio}` : ""}`}>
              <th scope="row" className="w-2/5 py-1 pr-3 text-left font-normal">
                <span className="flex items-center gap-1.5">
                  {r.colore && <span className="size-2 shrink-0 rounded-full" style={{ background: r.colore }} aria-hidden />}
                  <span className="truncate">{r.etichetta}</span>
                </span>
              </th>
              <td className="py-1">
                <div className="flex items-center gap-2">
                  <div className="h-3 flex-1 overflow-hidden rounded-r bg-muted/60">
                    <div className="h-full rounded-r bg-primary" style={{ width: `${(r.valore / max) * 100}%` }} />
                  </div>
                  <span className="w-10 text-right tabular-nums">{formattaNumero(r.valore)}</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

// RF-47: query dashboard (viste v_dash_*)
export default async function Dashboard() {
  await richiediUtente(LIVELLO.amministratore, "/admin");
  const [stati, categorie, municipi, utenti, moderazione] = await Promise.all([
    db.righe<{ codice: string; nome: string; segnalazioni: number }>("SELECT * FROM v_dash_per_stato ORDER BY ordine"),
    db.righe<{ nome: string; colore_mappa: string; segnalazioni: number; sostegni: number }>(
      "SELECT * FROM v_dash_per_categoria ORDER BY segnalazioni DESC",
    ),
    db.righe<{ nome: string; segnalazioni: number; in_classifica: number; sostegni: number; residenti_iscritti: number }>(
      "SELECT * FROM v_dash_per_municipio ORDER BY id",
    ),
    db.riga<{ registrati: number; attivi: number; sanzionati: number; attivi_ultimi_30_giorni: number }>("SELECT * FROM v_dash_utenti"),
    db.riga<{ revisioni_concluse: number; ore_medie: number | null; ore_massime: number | null; in_attesa: number }>(
      "SELECT * FROM v_dash_moderazione",
    ),
  ]);

  const tile: [string, string][] = [
    ["Utenti registrati", formattaNumero(utenti?.registrati ?? 0)],
    ["Attivi negli ultimi 30 giorni", formattaNumero(utenti?.attivi_ultimi_30_giorni ?? 0)],
    ["In attesa di moderazione", formattaNumero(moderazione?.in_attesa ?? 0)],
    ["Tempo medio di revisione", moderazione?.ore_medie != null ? `${formattaNumero(moderazione.ore_medie, 1)} h` : "—"],
  ];

  return (
    <div className="grid gap-6">
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tile.map(([t, v]) => (
          <div key={t} className="grid gap-1 rounded-lg border bg-card p-4">
            <dt className="text-xs text-muted-foreground">{t}</dt>
            <dd className="text-2xl font-semibold tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="grid gap-6 lg:grid-cols-2">
        <TabellaBarre
          titolo="Segnalazioni per stato"
          colonna="Segnalazioni"
          righe={stati.filter((s) => s.codice !== "BOZZA").map((s) => ({ etichetta: s.nome, valore: s.segnalazioni }))}
        />
        <TabellaBarre
          titolo="Segnalazioni per categoria"
          colonna="Segnalazioni"
          righe={categorie.map((k) => ({ etichetta: k.nome, valore: k.segnalazioni, colore: k.colore_mappa, dettaglio: `${k.sostegni} sostegni` }))}
        />
        <TabellaBarre
          titolo="Sostegni per Municipio"
          colonna="Sostegni"
          righe={municipi.map((m) => ({
            etichetta: m.nome,
            valore: m.sostegni,
            dettaglio: `${m.segnalazioni} segnalazioni, ${m.residenti_iscritti} residenti iscritti`,
          }))}
        />
        <TabellaBarre
          titolo="Residenti iscritti per Municipio"
          colonna="Iscritti"
          righe={municipi.map((m) => ({ etichetta: m.nome, valore: m.residenti_iscritti }))}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Passa il mouse su una riga per il dettaglio. Le statistiche sui moduli di intelligenza artificiale compariranno quando i
        moduli saranno attivi.
      </p>
    </div>
  );
}
