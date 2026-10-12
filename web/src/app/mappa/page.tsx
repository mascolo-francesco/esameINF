import type { Metadata } from "next";
import Link from "next/link";
import { elencoCategorie } from "@/lib/server/catalogo";
import { Pagina } from "@/components/pagina";
import { MappaSegnalazioni } from "./mappa-segnalazioni";

export const metadata: Metadata = {
  title: "Mappa",
  description: "Le segnalazioni pubblicate dai cittadini, sulla mappa di Milano.",
};

export default async function PaginaMappa() {
  const categorie = await elencoCategorie();
  return (
    <Pagina
      titolo="Mappa delle segnalazioni"
      descrizione="Tocca un gruppo per avvicinarti, un punto per aprire la segnalazione."
    >
      <div className="grid gap-4">
        <MappaSegnalazioni />
        <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm" aria-label="Legenda dei colori">
          {categorie.map((k) => (
            <li key={k.id} className="flex items-center gap-1.5">
              <span className="size-3 rounded-full border border-white shadow-sm" style={{ background: k.colore }} aria-hidden />
              {k.nome}
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted-foreground">
          In alternativa puoi consultare la{" "}
          <Link href="/classifica" className="font-medium text-primary underline-offset-4 hover:underline">
            classifica
          </Link>
          , che mostra le stesse segnalazioni con filtri per quartiere e categoria.
        </p>
      </div>
    </Pagina>
  );
}
