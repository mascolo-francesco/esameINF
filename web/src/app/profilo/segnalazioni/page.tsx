import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/server/db";
import { richiediUtente } from "@/lib/server/auth/sessione";
import { Pagina } from "@/components/pagina";
import { BadgeStato } from "@/components/stato";
import { buttonVariants } from "@/components/ui/button";
import { formattaData } from "@/lib/formato";

export const metadata: Metadata = { title: "Le mie segnalazioni" };

export default async function MieSegnalazioni() {
  const u = await richiediUtente(1, "/profilo/segnalazioni");
  // query mie_segnalazioni
  const righe = await db.righe<{
    codice_pubblico: string;
    titolo: string | null;
    stato_corrente: string;
    stato: string;
    data_creazione: Date;
    num_sostegni: number;
  }>(
    `SELECT s.codice_pubblico, s.titolo, s.stato_corrente, st.nome AS stato, s.data_creazione, s.num_sostegni
       FROM segnalazione s JOIN stato st ON st.codice = s.stato_corrente
      WHERE s.id_autore = ? AND s.stato_corrente <> 'BOZZA'
      ORDER BY s.data_creazione DESC`,
    [u.id],
  );
  return (
    <Pagina
      titolo="Le mie segnalazioni"
      azioni={
        <Link href="/nuova" className={buttonVariants()}>
          Nuova segnalazione
        </Link>
      }
      className="max-w-3xl"
    >
      {righe.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">Non hai ancora inviato segnalazioni.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {righe.map((r) => (
            <li key={r.codice_pubblico}>
              <Link href={`/segnalazioni/${r.codice_pubblico}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 p-4 hover:bg-muted/50">
                <span className="min-w-0 flex-1 font-medium">{r.titolo}</span>
                <BadgeStato codice={r.stato_corrente} nome={r.stato} />
                <span className="w-full text-xs text-muted-foreground sm:w-auto">
                  {r.codice_pubblico} · {formattaData(r.data_creazione)} · {r.num_sostegni} sostegni
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Pagina>
  );
}
