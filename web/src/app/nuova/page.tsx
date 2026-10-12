import type { Metadata } from "next";
import { richiediUtente } from "@/lib/server/auth/sessione";
import { elencoCategorie } from "@/lib/server/catalogo";
import { Pagina } from "@/components/pagina";
import { Procedura } from "./procedura";

export const metadata: Metadata = { title: "Nuova segnalazione" };

export default async function PaginaNuova() {
  const u = await richiediUtente(1, "/nuova");
  return (
    <Pagina titolo="Nuova segnalazione" descrizione="Quattro passaggi: foto, posizione, descrizione e conferma." className="max-w-3xl">
      {u.puoScrivere ? (
        <Procedura categorie={await elencoCategorie()} />
      ) : (
        <p role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Il tuo account al momento non può pubblicare segnalazioni.
        </p>
      )}
    </Pagina>
  );
}
