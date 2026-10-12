import type { Metadata } from "next";
import Link from "next/link";
import { BellIcon } from "@phosphor-icons/react/ssr";
import { db } from "@/lib/server/db";
import { richiediUtente } from "@/lib/server/auth/sessione";
import { Pagina } from "@/components/pagina";
import { StatoVuoto } from "@/components/stato-vuoto";
import { formattaDataOra } from "@/lib/formato";
import { cn } from "@/lib/utils";
import { SegnaLette } from "./segna-lette";

export const metadata: Metadata = { title: "Notifiche" };

// RF-29: le notifiche in-app (le email sono escluse dalla demo)
export default async function PaginaNotifiche() {
  const u = await richiediUtente(1, "/notifiche");
  const righe = await db.righe<{ id: number; testo: string; data: Date; letta: number; codice_pubblico: string | null }>(
    `SELECT n.id, n.testo, n.data, n.letta, s.codice_pubblico
       FROM notifica n LEFT JOIN segnalazione s ON s.id = n.id_segnalazione
      WHERE n.id_utente = ?
      ORDER BY n.data DESC, n.id DESC LIMIT 50`,
    [u.id],
  );
  const nonLette = righe.filter((r) => !r.letta).length;
  return (
    <Pagina
      titolo="Notifiche"
      descrizione={nonLette ? `${nonLette} da leggere` : "Nessuna notifica da leggere"}
      azioni={nonLette > 0 ? <SegnaLette /> : undefined}
      className="max-w-3xl"
    >
      {righe.length === 0 ? (
        <StatoVuoto icona={<BellIcon weight="duotone" />} titolo="Nessuna notifica">
          Qui troverai i cambi di stato delle tue segnalazioni e di quelle che sostieni o segui.
        </StatoVuoto>
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-card">
          {righe.map((r) => {
            const contenuto = (
              <>
                <span className={cn("flex items-start gap-2 text-sm", !r.letta && "font-semibold")}>
                  {!r.letta && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-hidden />}
                  {!r.letta && <span className="sr-only">Da leggere: </span>}
                  {r.testo}
                </span>
                <span className="text-xs text-muted-foreground">{formattaDataOra(r.data)}</span>
              </>
            );
            return (
              <li key={r.id} className={cn(!r.letta && "bg-secondary/40")}>
                {r.codice_pubblico ? (
                  <Link href={`/segnalazioni/${r.codice_pubblico}`} className="grid gap-1 p-4 transition-colors hover:bg-muted/60">
                    {contenuto}
                  </Link>
                ) : (
                  <div className="grid gap-0.5 p-4">{contenuto}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Pagina>
  );
}
