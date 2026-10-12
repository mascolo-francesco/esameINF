import type { Metadata } from "next";
import { db } from "@/lib/server/db";
import { LIVELLO, richiediUtente } from "@/lib/server/auth/sessione";
import { FormCategoria } from "../moduli";

export const metadata: Metadata = { title: "Categorie" };

export default async function Categorie() {
  await richiediUtente(LIVELLO.amministratore, "/admin/categorie");
  const righe = await db.righe<{ id: number; nome: string; descrizione: string; colore_mappa: string; ordine: number; attiva: number }>(
    "SELECT id, nome, descrizione, colore_mappa, ordine, attiva FROM categoria ORDER BY ordine, nome",
  );
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <ul className="grid content-start gap-3">
        {righe.map((k) => (
          <li key={k.id} className="grid gap-2 rounded-lg border bg-card p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="size-3 rounded-full" style={{ background: k.colore_mappa }} aria-hidden />
              <span className="font-medium">{k.nome}</span>
              {!k.attiva && <span className="rounded bg-muted px-1.5 text-xs">disattivata</span>}
              <span className="ml-auto text-xs text-muted-foreground">ordine {k.ordine}</span>
            </div>
            <p className="text-sm text-muted-foreground">{k.descrizione}</p>
            <FormCategoria
              categoria={{ id: k.id, nome: k.nome, descrizione: k.descrizione, colore: k.colore_mappa, ordine: k.ordine, attiva: Boolean(k.attiva) }}
            />
          </li>
        ))}
      </ul>
      <section className="grid content-start gap-3 rounded-lg border p-4" aria-labelledby="nuova-cat">
        <h2 id="nuova-cat" className="font-semibold">
          Nuova categoria
        </h2>
        <p className="text-xs text-muted-foreground">
          Le categorie non si cancellano: se una non serve più si disattiva, così le segnalazioni già classificate restano coerenti.
        </p>
        <FormCategoria />
      </section>
    </div>
  );
}
