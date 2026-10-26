"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRightIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

export interface VoceLista {
  codice: string;
  titolo: string;
  sostegni: number;
  foto: string | null;
  luogo: string;
  stato: string;
  categorie: string | null;
}

const FOTO_SENZA_IMMAGINE = "/archivio/milano-periferia-2.jpg";

/**
 * Le segnalazioni più sostenute: a sinistra la foto resta ferma mentre l'elenco scorre,
 * e cambia con la riga attiva (quella al centro dello schermo, o quella sotto il puntatore o il focus).
 */
export function ListaSostenute({ voci }: { voci: VoceLista[] }) {
  const [attiva, setAttiva] = useState(0);
  const righe = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    const osservatore = new IntersectionObserver(
      (elementi) => {
        for (const e of elementi) if (e.isIntersecting) setAttiva(Number((e.target as HTMLElement).dataset.indice));
      },
      // una riga è attiva quando attraversa la fascia centrale dello schermo
      { rootMargin: "-45% 0px -45% 0px" },
    );
    righe.current.forEach((r) => r && osservatore.observe(r));
    return () => osservatore.disconnect();
  }, [voci.length]);

  return (
    <div className="grid gap-8 sm:grid-cols-12 sm:gap-x-8">
      <div className="sticky top-16 z-10 -mx-4 sm:top-[12vh] sm:col-span-5 sm:mx-0 sm:self-start">
        {/* le foto sono una sopra l'altra: cambia solo l'opacità, così il passaggio è una dissolvenza */}
        <div className="relative aspect-[4/3] max-h-[38svh] w-full overflow-hidden bg-sunken sm:aspect-[4/5] sm:max-h-none">
          {voci.map((v, i) => (
            // eslint-disable-next-line @next/next/no-img-element -- foto servite dall'API dell'app, già ridimensionate
            <img
              key={v.codice}
              src={v.foto ?? FOTO_SENZA_IMMAGINE}
              alt={i === attiva ? `Foto della segnalazione: ${v.titolo}` : ""}
              aria-hidden={i !== attiva}
              loading={i === 0 ? "eager" : "lazy"}
              className={cn(
                "absolute inset-0 size-full object-cover transition-opacity duration-300 ease-(--ease-out)",
                !v.foto && "grayscale",
                i === attiva ? "opacity-100" : "opacity-0",
              )}
            />
          ))}
        </div>
      </div>

      <div className="grid content-start gap-12 sm:col-span-6 sm:col-start-7">
        <h2 id="sostenute" data-rivela className="text-step-head leading-[0.95] tracking-tight">
          Le più sostenute
        </h2>
        <ol className="grid">
          {voci.map((v, i) => (
            <li
              key={v.codice}
              ref={(el) => {
                righe.current[i] = el;
              }}
              data-indice={i}
              onPointerEnter={() => setAttiva(i)}
              onFocus={() => setAttiva(i)}
              className="grid py-4"
            >
              <Link
                href={`/segnalazioni/${v.codice}`}
                className={cn(
                  "group flex items-baseline justify-between gap-6 transition-colors duration-200",
                  i === attiva ? "text-foreground" : "text-muted-foreground",
                )}
              >
                <span className="font-display text-step-lead leading-tight group-hover:text-primary">
                  {v.titolo}
                </span>
                <span className="shrink-0 text-step-small tabular-nums">
                  {v.sostegni} {v.sostegni === 1 ? "sostegno" : "sostegni"}
                </span>
              </Link>
              <div
                className={cn(
                  "grid transition-[grid-template-rows,opacity] duration-300 ease-(--ease-out)",
                  i === attiva ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
                )}
              >
                <p className="max-w-[40ch] overflow-hidden pt-2 text-step-body leading-snug">
                  {v.luogo} · {v.stato}
                  {v.categorie ? ` · ${v.categorie}` : ""}
                </p>
              </div>
            </li>
          ))}
        </ol>
        <p className="flex flex-wrap gap-x-8 gap-y-3 text-step-body">
          <Link href="/classifica" className="inline-flex items-center gap-2 font-medium text-primary underline-offset-4 hover:underline">
            Tutta la classifica <ArrowRightIcon weight="bold" className="size-4" aria-hidden />
          </Link>
          <Link href="/classifica?ordine=tendenza" className="underline-offset-4 hover:underline">
            Le segnalazioni in tendenza
          </Link>
        </p>
      </div>
    </div>
  );
}
