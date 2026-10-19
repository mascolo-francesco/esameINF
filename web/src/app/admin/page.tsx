import type { Metadata } from "next";
import Link from "next/link";
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
    <section className="grid content-start gap-4 border bg-card p-5">
      <h2 className="text-lg tracking-tight">{titolo}</h2>
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
                  <div className="h-2 flex-1 overflow-hidden bg-sunken">
                    <div className="h-full bg-primary" style={{ width: `${(r.valore / max) * 100}%` }} />
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

  // sotto l'ora il tempo medio si legge meglio in minuti; senza revisioni concluse è un trattino, non uno zero
  const ore = moderazione?.ore_medie;
  const tempoMedio = ore == null ? "—" : ore < 1 ? `${formattaNumero(Math.round(ore * 60))} min` : `${formattaNumero(ore, 1)} h`;
  const concluse = moderazione?.revisioni_concluse ?? 0;
  const inAttesa = moderazione?.in_attesa ?? 0;
  const cifre: { etichetta: string; valore: string; nota: React.ReactNode }[] = [
    {
      etichetta: "In attesa di moderazione",
      valore: formattaNumero(inAttesa),
      nota: inAttesa > 0 ? <Link href="/moderazione" className="font-medium text-primary hover:underline">Apri la coda</Link> : "Coda vuota",
    },
    { etichetta: "Tempo medio di revisione", valore: tempoMedio, nota: `su ${formattaNumero(concluse)} ${concluse === 1 ? "revisione conclusa" : "revisioni concluse"}` },
    { etichetta: "Utenti registrati", valore: formattaNumero(utenti?.registrati ?? 0), nota: `${formattaNumero(utenti?.sanzionati ?? 0)} con un provvedimento` },
    { etichetta: "Attivi negli ultimi 30 giorni", valore: formattaNumero(utenti?.attivi_ultimi_30_giorni ?? 0), nota: `su ${formattaNumero(utenti?.registrati ?? 0)} registrati` },
  ];

  return (
    <div className="grid gap-6">
      {/* un solo contenitore diviso da righe sottili: etichetta sopra, cifra sotto, una nota che dice rispetto a cosa */}
      <dl className="grid grid-cols-2 border bg-card lg:grid-cols-4 [&>div]:border-border max-lg:[&>div:nth-child(-n+2)]:border-b max-lg:[&>div:nth-child(odd)]:border-r lg:[&>div:not(:last-child)]:border-r">
        {cifre.map((c) => (
          <div key={c.etichetta} className="grid content-start gap-1 p-4 sm:p-5">
            <dt className="text-sm text-muted-foreground">{c.etichetta}</dt>
            <dd className="grid gap-1">
              <span className="text-[1.75rem] leading-tight tabular-nums">{c.valore}</span>
              <span className="text-[13px] text-muted-foreground">{c.nota}</span>
            </dd>
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
            dettaglio: `${m.segnalazioni} segnalazioni, ${m.residenti_iscritti} residenti registrati`,
          }))}
        />
        <TabellaBarre
          titolo="Residenti registrati per Municipio"
          colonna="Registrati"
          righe={municipi.map((m) => ({ etichetta: m.nome, valore: m.residenti_iscritti }))}
        />
      </div>
      <p className="text-[13px] text-muted-foreground">
        Le statistiche sui moduli di intelligenza artificiale compariranno quando i moduli saranno attivi.
      </p>
    </div>
  );
}
