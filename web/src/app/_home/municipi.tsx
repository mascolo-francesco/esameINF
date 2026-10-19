"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export interface DatiMunicipio {
  id: number;
  nome: string;
  quartieri: string[];
  pubbliche: number;
  prima: { codice: string; titolo: string; sostegni: number; foto: string | null } | null;
}

const FOTO_VUOTA = "/archivio/milano.jpg";

/**
 * Scegli il tuo municipio: la tavola a sinistra mostra la segnalazione più sostenuta di quella zona.
 * Le schede sono link a ?municipio=N: senza JavaScript la pagina si ricarica sullo stesso municipio.
 */
export function SceltaMunicipio({ municipi, iniziale }: { municipi: DatiMunicipio[]; iniziale: number }) {
  const [scelto, setScelto] = useState(iniziale);
  const m = municipi.find((x) => x.id === scelto) ?? municipi[0];
  if (!m) return null;
  const altri = m.quartieri.length - 4;

  return (
    <div className="grid gap-10 sm:min-h-[88svh] sm:grid-cols-2 sm:items-center sm:gap-12">
      <figure className="grid gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- foto servite dall'API dell'app */}
        <img
          key={m.id}
          src={m.prima?.foto ?? FOTO_VUOTA}
          alt={m.prima ? `Foto della segnalazione: ${m.prima.titolo}` : "Una piazza di Milano negli anni Cinquanta, fotografata da Paolo Monti"}
          className={cn("aspect-square w-full animate-in object-cover duration-500 fade-in", !m.prima?.foto && "grayscale")}
        />
        <figcaption className="text-step-small text-muted-foreground">
          {m.prima ? `La più sostenuta del ${m.nome}: ${m.prima.titolo}` : `Nel ${m.nome} non c'è ancora una segnalazione pubblica.`}
        </figcaption>
      </figure>

      <div className="grid content-between gap-10 sm:self-stretch sm:py-6">
        <div className="grid gap-6">
          <h2 id="municipio" data-rivela className="text-step-head leading-[0.95] tracking-tight">
            Il tuo municipio
          </h2>
          <nav aria-label="Scegli il municipio" className="flex flex-wrap gap-x-1 gap-y-1">
            {municipi.map((x) => (
              <Link
                key={x.id}
                href={`/?municipio=${x.id}#municipio`}
                scroll={false}
                aria-current={x.id === m.id ? "true" : undefined}
                aria-label={x.nome}
                onClick={(e) => {
                  e.preventDefault();
                  setScelto(x.id);
                }}
                className={cn(
                  "premibile grid size-12 place-items-center font-display text-step-lead tabular-nums transition-[background-color,color,scale] duration-150",
                  x.id === m.id ? "bg-foreground text-background" : "bg-sunken text-foreground hover:bg-border",
                )}
              >
                {x.id}
              </Link>
            ))}
          </nav>
        </div>

        <div aria-live="polite" className="grid gap-5">
          <p className="font-display text-step-lead leading-tight">{m.nome}</p>
          <p className="max-w-[38ch] text-step-body leading-relaxed">
            {m.quartieri.slice(0, 4).join(", ")}
            {altri > 0 ? ` e altri ${altri} quartieri` : ""}.{" "}
            {m.pubbliche === 0
              ? "Nessuna segnalazione pubblica, per ora: la prima può essere la tua."
              : m.pubbliche === 1
                ? "Una segnalazione pubblica."
                : `${m.pubbliche} segnalazioni pubbliche.`}
            {m.prima && ` La più sostenuta ha ${m.prima.sostegni} ${m.prima.sostegni === 1 ? "sostegno" : "sostegni"}.`}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Link
            href={`/classifica?municipio=${m.id}`}
            className="premibile flex min-h-16 items-center justify-center bg-foreground px-4 py-3 text-center text-step-body text-background transition-[background-color,scale] duration-150 hover:bg-primary"
          >
            Vedi le segnalazioni
          </Link>
          <Link
            href="/nuova"
            className="premibile flex min-h-16 items-center justify-center bg-sunken px-4 py-3 text-center text-step-body transition-[background-color,scale] duration-150 hover:bg-border"
          >
            Segnala qui
          </Link>
        </div>
      </div>
    </div>
  );
}
