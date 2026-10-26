import type { Metadata } from "next";
import Link from "next/link";
import { FileTextIcon } from "@phosphor-icons/react/ssr";
import { db } from "@/lib/server/db";
import { LIVELLO, richiediUtente } from "@/lib/server/auth/sessione";
import { formattaNumero } from "@/lib/formato";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

const elenco = new Intl.ListFormat("it", { type: "conjunction" });

/** ["Municipio 4", "Municipio 7"] diventa "Municipi 4 e 7"; uno solo resta "Municipio 4". */
function municipiInParole(nomi: string[]): string {
  if (nomi.length === 1) return nomi[0];
  return `Municipi ${elenco.format(nomi.map((n) => n.replace(/^Municipio\s+/, "")))}`;
}

/** Larghezza della barra: la quota sul valore più alto della tabella. Lo zero non disegna niente. */
function Barra({ valore, max, className }: { valore: number; max: number; className?: string }) {
  return (
    <span className={cn("block h-2 flex-1", className)} aria-hidden>
      {valore > 0 && <span className="block h-full bg-primary" style={{ width: `${(valore / max) * 100}%` }} />}
    </span>
  );
}

interface Riga {
  etichetta: string;
  valore: number;
  colore?: string;
}

/** Una tabella con la barra accanto al numero: il numero è il dato, la barra aiuta solo a confrontare. */
function TabellaBarre({ titolo, nota, colonna, voce, righe }: { titolo: string; nota?: string; colonna: string; voce: string; righe: Riga[] }) {
  const max = Math.max(1, ...righe.map((r) => r.valore));
  return (
    <section aria-labelledby={`t-${voce}`} className="grid content-start gap-3 border bg-card p-5">
      <header className="grid gap-1">
        <h2 id={`t-${voce}`} className="text-lg tracking-tight">
          {titolo}
        </h2>
        {nota && <p className="text-[13px] text-muted-foreground">{nota}</p>}
      </header>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-muted-foreground">
            <th scope="col" className="pb-1 text-left font-normal">
              {voce}
            </th>
            <th scope="col" className="pb-1 text-right font-normal">
              {colonna}
            </th>
          </tr>
        </thead>
        <tbody>
          {righe.map((r) => (
            <tr key={r.etichetta}>
              <th scope="row" className="w-1/2 py-1 pr-3 text-left font-normal">
                <span className="flex items-center gap-1.5">
                  {r.colore && <span className="size-2 shrink-0 rounded-full" style={{ background: r.colore }} aria-hidden />}
                  <span className="truncate">{r.etichetta}</span>
                </span>
              </th>
              <td className="py-1">
                <span className="flex items-center gap-3">
                  <Barra valore={r.valore} max={max} />
                  <span className="w-8 text-right tabular-nums">{formattaNumero(r.valore)}</span>
                </span>
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
      "SELECT * FROM v_dash_per_categoria ORDER BY segnalazioni DESC, nome",
    ),
    db.righe<{ nome: string; in_classifica: number; sostegni: number; residenti_iscritti: number }>(
      "SELECT * FROM v_dash_per_municipio ORDER BY id",
    ),
    db.riga<{ attivi_ultimi_30_giorni: number }>("SELECT * FROM v_dash_utenti"),
    db.riga<{ revisioni_concluse: number; ore_medie: number | null; in_attesa: number }>("SELECT * FROM v_dash_moderazione"),
  ]);

  // Totali sommati dalle stesse righe che la pagina mostra, così cifre e tabelle non possono divergere
  const inClassifica = municipi.reduce((t, m) => t + m.in_classifica, 0);
  const sostegni = municipi.reduce((t, m) => t + m.sostegni, 0);
  const iscritti = municipi.reduce((t, m) => t + m.residenti_iscritti, 0);
  const presiInCarico = stati.find((s) => s.codice === "PRESA_IN_CARICO")?.segnalazioni ?? 0;
  const maxSostegni = Math.max(0, ...municipi.map((m) => m.sostegni));
  const piuSostenuti = maxSostegni > 0 ? municipi.filter((m) => m.sostegni === maxSostegni).map((m) => m.nome) : [];
  const senzaSegnalazioni = municipi.filter((m) => m.in_classifica === 0).map((m) => m.nome);

  // sotto l'ora il tempo medio si legge meglio in minuti; senza revisioni concluse non c'è un tempo da mostrare
  const ore = moderazione?.ore_medie;
  const tempoMedio = ore == null ? null : ore < 1 ? `${formattaNumero(Math.round(ore * 60))} min` : `${formattaNumero(ore, 1)} h`;
  const inAttesa = moderazione?.in_attesa ?? 0;

  const fatto =
    senzaSegnalazioni.length === 0
      ? "Ogni Municipio ha almeno una segnalazione in classifica."
      : senzaSegnalazioni.length === municipi.length
        ? "Nessuna segnalazione è ancora in classifica."
        : `${senzaSegnalazioni.length === 1 ? "Il" : "I"} ${municipiInParole(senzaSegnalazioni)} non ${senzaSegnalazioni.length === 1 ? "ha" : "hanno"} ancora segnalazioni in classifica.`;

  const cifre: { etichetta: string; valore: string; nota: React.ReactNode; guida?: boolean }[] = [
    {
      etichetta: "Segnalazioni in classifica",
      valore: formattaNumero(inClassifica),
      nota: `${formattaNumero(presiInCarico)} prese in carico`,
      guida: true,
    },
    {
      etichetta: "Sostegni raccolti",
      valore: formattaNumero(sostegni),
      nota: piuSostenuti.length ? `Di più ${piuSostenuti.length === 1 ? "nel" : "nei"} ${municipiInParole(piuSostenuti)}` : "Ancora nessun sostegno",
    },
    {
      etichetta: "Da moderare",
      valore: formattaNumero(inAttesa),
      nota:
        inAttesa > 0 ? (
          <Link href="/moderazione" className="font-medium text-primary underline underline-offset-4">
            Apri la coda
          </Link>
        ) : tempoMedio ? (
          `Revisione media: ${tempoMedio}`
        ) : (
          "Coda vuota"
        ),
    },
    {
      etichetta: "Cittadini iscritti",
      valore: formattaNumero(iscritti),
      nota: `${formattaNumero(utenti?.attivi_ultimi_30_giorni ?? 0)} attivi nell'ultimo mese`,
    },
  ];

  return (
    <div className="grid gap-6">
      {/* il fatto che conta oggi, con accanto il lavoro che ne segue */}
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <p className="max-w-[60ch] text-base">{fatto}</p>
        <Link href="/admin/documenti" className={cn(buttonVariants(), "w-full sm:w-auto")}>
          <FileTextIcon aria-hidden />
          Prepara il documento programmatico
        </Link>
      </div>

      {/* un solo contenitore diviso da righe sottili: etichetta sopra, cifra sotto, una nota che dice rispetto a cosa */}
      <dl className="grid grid-cols-2 border bg-card lg:grid-cols-4 [&>div]:border-border max-lg:[&>div:nth-child(-n+2)]:border-b max-lg:[&>div:nth-child(odd)]:border-r lg:[&>div:not(:last-child)]:border-r">
        {cifre.map((c) => (
          <div key={c.etichetta} className="grid content-start gap-1 p-4 sm:p-5">
            <dt className="text-sm text-muted-foreground">{c.etichetta}</dt>
            <dd className="grid gap-1">
              <span className={cn("leading-tight tabular-nums", c.guida ? "text-[2.25rem]" : "text-[1.625rem]")}>{c.valore}</span>
              <span className="text-[13px] text-muted-foreground">{c.nota}</span>
            </dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="t-municipi" className="grid content-start gap-3 border bg-card p-5">
        <header className="grid gap-1">
          <h2 id="t-municipi" className="text-lg tracking-tight">
            Municipi
          </h2>
          <p className="text-[13px] text-muted-foreground">
            Il documento programmatico deve parlare di tutta la città: qui si vede dove la partecipazione è ancora scarsa.
          </p>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground">
                <th scope="col" className="pb-1 text-left font-normal">
                  Municipio
                </th>
                <th scope="col" className="w-16 pb-1 text-right font-normal sm:w-24">
                  Iscritti
                </th>
                <th scope="col" className="w-24 pb-1 text-right font-normal sm:w-28">
                  In classifica
                </th>
                <th scope="col" className="pb-1 pl-4 text-right font-normal sm:w-2/5 sm:pl-6">
                  Sostegni
                </th>
              </tr>
            </thead>
            <tbody>
              {municipi.map((m) => (
                <tr key={m.nome} className="border-t border-border/60">
                  <th scope="row" className="py-2 pr-3 text-left font-normal whitespace-nowrap">
                    {m.nome}
                  </th>
                  <td className="py-2 text-right tabular-nums">{formattaNumero(m.residenti_iscritti)}</td>
                  <td className="py-2 text-right tabular-nums">{formattaNumero(m.in_classifica)}</td>
                  <td className="py-2 pl-4 sm:pl-6">
                    <span className="flex items-center justify-end gap-3">
                      {/* sul telefono la barra lascerebbe troppo poco spazio ai nomi: resta il numero */}
                      <Barra valore={m.sostegni} max={Math.max(1, maxSostegni)} className="hidden sm:block" />
                      <span className="w-8 text-right tabular-nums">{formattaNumero(m.sostegni)}</span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border font-semibold">
                <th scope="row" className="pt-2 text-left">
                  Totale
                </th>
                <td className="pt-2 text-right tabular-nums">{formattaNumero(iscritti)}</td>
                <td className="pt-2 text-right tabular-nums">{formattaNumero(inClassifica)}</td>
                <td className="pt-2 text-right tabular-nums">{formattaNumero(sostegni)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <TabellaBarre
          titolo="Segnalazioni per stato"
          voce="Stato"
          colonna="Segnalazioni"
          righe={stati.filter((s) => s.codice !== "BOZZA").map((s) => ({ etichetta: s.nome, valore: s.segnalazioni }))}
        />
        <TabellaBarre
          titolo="Segnalazioni per categoria"
          nota="Una segnalazione può avere fino a tre categorie, quindi il totale è più alto di quello per stato."
          voce="Categoria"
          colonna="Segnalazioni"
          righe={categorie.map((k) => ({ etichetta: k.nome, valore: k.segnalazioni, colore: k.colore_mappa }))}
        />
      </div>

      <p className="text-[13px] text-muted-foreground">
        Le statistiche sui moduli di intelligenza artificiale compariranno quando i moduli saranno attivi.
      </p>
    </div>
  );
}
