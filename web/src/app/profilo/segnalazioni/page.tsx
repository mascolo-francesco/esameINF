import type { Metadata } from "next";
import Link from "next/link";
import { MegaphoneIcon, PlusIcon } from "@phosphor-icons/react/ssr";
import { db } from "@/lib/server/db";
import { richiediUtente } from "@/lib/server/auth/sessione";
import { Pagina } from "@/components/pagina";
import { StatoVuoto } from "@/components/stato-vuoto";
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
          <PlusIcon weight="bold" aria-hidden />
          Fai una segnalazione
        </Link>
      }
      className="max-w-3xl"
    >
      {righe.length === 0 ? (
        <StatoVuoto
          icona={<MegaphoneIcon weight="regular" />}
          titolo="Non hai ancora inviato segnalazioni"
          azione={
            <Link href="/nuova" className={buttonVariants()}>
              <PlusIcon weight="bold" aria-hidden />
              Fai una segnalazione
            </Link>
          }
        >
          Allega una foto, indica il punto sulla mappa e descrivi il problema.
        </StatoVuoto>
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-card">
          {righe.map((r) => (
            <li key={r.codice_pubblico}>
              <Link href={`/segnalazioni/${r.codice_pubblico}`} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 p-4 transition-colors hover:bg-muted/60">
                <span className="min-w-0 flex-1 font-semibold">{r.titolo}</span>
                <BadgeStato codice={r.stato_corrente} nome={r.stato} />
                <span className="w-full text-sm text-muted-foreground sm:w-auto">
                  <span className="font-mono text-xs">{r.codice_pubblico}</span> · {formattaData(r.data_creazione)} · {r.num_sostegni} {r.num_sostegni === 1 ? "sostegno" : "sostegni"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Pagina>
  );
}
