import type { ReactNode } from "react";
import { db } from "@/lib/server/db";
import { LIVELLO, type Utente } from "@/lib/server/auth/sessione";
import { NavStaff, TitoloStaff } from "./nav-staff";

/**
 * Guscio dell'area del comitato (moderazione e amministrazione): menu a sinistra sul fondo della pagina,
 * titolo della schermata e contenuto a destra. Griglia da lg in su: 15rem + 2.5rem di spazio + il resto.
 * Stesso contenitore dell'intestazione (max-w-6xl, px-4): menu e contenuto partono e finiscono sui suoi bordi.
 */
export async function AreaStaff({ utente, children }: { utente: Utente; children: ReactNode }) {
  const coda = await db.riga<{ n: number }>("SELECT COUNT(*) AS n FROM v_coda_moderazione");
  const admin = utente.livello >= LIVELLO.amministratore;
  return (
    <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 pt-6 pb-12 lg:grid-cols-[15rem_1fr] lg:gap-10 lg:pt-8">
      <aside className="grid content-start gap-4 lg:sticky lg:top-24 lg:self-start">
        <p className="hidden text-sm lg:block">
          <span className="block font-display text-base">Comitato</span>
          <span className="text-muted-foreground">{admin ? "Amministratore" : "Moderatore"}</span>
        </p>
        <NavStaff admin={admin} inCoda={coda?.n ?? 0} />
      </aside>
      <div className="grid min-w-0 content-start gap-6">
        <TitoloStaff admin={admin} />
        {children}
      </div>
    </div>
  );
}
