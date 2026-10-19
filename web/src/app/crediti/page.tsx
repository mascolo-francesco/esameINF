import type { Metadata } from "next";
import { Pagina } from "@/components/pagina";
import crediti from "../../../public/archivio/credits.json";
import creditiDemo from "../../../scripts/foto-demo/crediti.json";

export const metadata: Metadata = {
  title: "Crediti delle fotografie",
  description: "Le fotografie usate nel sito e nelle segnalazioni di prova: autore, licenza e pagina d'origine.",
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

      <section className="mt-12 grid max-w-prose gap-6">
        <div className="grid gap-2">
          <h2 className="font-display text-2xl">Foto delle segnalazioni di prova</h2>
          <p className="text-muted-foreground">
            Le segnalazioni create da <code>npm run seed</code> usano foto di Wikimedia Commons, ritagliate e con i
            colori leggermente attenuati. Non tutte sono state scattate a Milano: servono a mostrare come appare una
            segnalazione vera.
          </p>
        </div>
        <ul className="grid gap-4">
          {creditiDemo.map((c) => (
            <li key={c.chiave} className="grid gap-1">
              <p className="font-medium">{c.title}</p>
              <p className="text-sm">
                {c.creator} ·{" "}
                {c.licenseUrl ? (
                  <a href={c.licenseUrl} className="underline underline-offset-4 hover:text-primary">
                    {c.license}
                  </a>
                ) : (
                  c.license
                )}{" "}
                ·{" "}
                <a href={c.page} className="underline underline-offset-4 hover:text-primary">
                  pagina su Wikimedia Commons
                </a>
              </p>
            </li>
          ))}
        </ul>
      </section>
    </Pagina>
  );
}
