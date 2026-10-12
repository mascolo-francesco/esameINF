import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/server/db";
import { richiediUtente } from "@/lib/server/auth/sessione";
import { Pagina } from "@/components/pagina";
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
        <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          Qui troverai i cambi di stato delle tue segnalazioni e di quelle che sostieni o segui.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {righe.map((r) => {
            const contenuto = (
              <>
                <span className={cn("text-sm", !r.letta && "font-semibold")}>{r.testo}</span>
                <span className="text-xs text-muted-foreground">{formattaDataOra(r.data)}</span>
              </>
            );
            return (
              <li key={r.id} className={cn(!r.letta && "bg-primary/[0.04]")}>
                {r.codice_pubblico ? (
                  <Link href={`/segnalazioni/${r.codice_pubblico}`} className="grid gap-0.5 p-4 hover:bg-muted/50">
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
