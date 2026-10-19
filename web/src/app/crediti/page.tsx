import type { Metadata } from "next";
import { Pagina } from "@/components/pagina";
import crediti from "../../../public/archivio/credits.json";

export const metadata: Metadata = {
  title: "Crediti delle fotografie",
  description: "Le fotografie d'archivio usate nel sito: autore, data, licenza e pagina d'origine.",
};

/** Attribuzione delle foto d'archivio (CC BY-SA 4.0 chiede titolo, autore, fonte e licenza). */
export default function PaginaCrediti() {
  return (
    <Pagina
      titolo="Crediti delle fotografie"
      descrizione="Le fotografie di Milano nel sito sono di Paolo Monti (1908–1982) e fanno parte del Fondo Paolo Monti della Biblioteca Europea di Informazione e Cultura (BEIC). Mostrano la città, non le segnalazioni."
    >
      <ul className="grid max-w-prose gap-6">
        {crediti.map((c) => (
          <li key={c.ref} className="grid gap-1">
            <p className="font-display text-xl">{c.title}</p>
            <p>
              {c.creator}, {c.date.replace("between", "tra").replace(" and ", " e ")} ·{" "}
              <a href={c.licenseUrl ?? undefined} className="underline underline-offset-4 hover:text-primary">
                {c.license}
              </a>{" "}
              ·{" "}
              <a href={c.page} className="underline underline-offset-4 hover:text-primary">
                pagina su {c.via}
              </a>
            </p>
          </li>
        ))}
      </ul>
    </Pagina>
  );
}
