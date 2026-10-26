"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ArrowLeftIcon, ArrowRightIcon } from "@phosphor-icons/react";

export interface Passo {
  titolo: string;
  testo: string;
  foto: string;
  didascalia: string;
}

// lo spazio vuoto sopra ogni foto cambia da colonna a colonna: le foto salgono e scendono lungo la fila
const SPAZI = [
  "sm:h-24",
  "sm:h-36",
  "sm:h-20",
  "sm:h-32",
  "sm:h-28",
  "sm:h-16",
];
const SPAZI_TELEFONO = ["h-10", "h-16", "h-8", "h-14", "h-12", "h-8"];

/** Il percorso di una segnalazione come fila di momenti da scorrere in orizzontale. */
export function FilaPassi({ passi }: { passi: Passo[] }) {
  const fila = useRef<HTMLOListElement>(null);
  const [avanzamento, setAvanzamento] = useState(0);

  const scorri = (verso: 1 | -1) => {
    const f = fila.current;
    if (!f) return;
    // una "pagina" della fila alla volta: le colonne riempiono esattamente la larghezza visibile
    f.scrollBy({ left: verso * (f.clientWidth + 32), behavior: "smooth" });
  };

  return (
    <div className="grid gap-6">
      <div className="mx-auto flex w-full max-w-6xl items-end justify-between gap-6 px-4 sm:px-8">
        <h2
          id="percorso"
          data-rivela
          className="text-step-head leading-[0.95] tracking-tight"
        >
          Dal marciapiede ai candidati
        </h2>
        <div className="hidden shrink-0 gap-2 sm:flex">
          <button
            type="button"
            onClick={() => scorri(-1)}
            className="premibile grid size-12 place-items-center bg-foreground text-background transition-[background-color,scale] duration-150 hover:bg-primary disabled:opacity-40"
            aria-label="Momenti precedenti"
            disabled={avanzamento <= 0.01}
          >
            <ArrowLeftIcon weight="bold" className="size-5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => scorri(1)}
            className="premibile grid size-12 place-items-center bg-foreground text-background transition-[background-color,scale] duration-150 hover:bg-primary disabled:opacity-40"
            aria-label="Momenti successivi"
            disabled={avanzamento >= 0.99}
          >
            <ArrowRightIcon weight="bold" className="size-5" aria-hidden />
          </button>
        </div>
      </div>
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-8" aria-hidden>
        <div className="h-1.5 bg-sunken">
          <div
            className="h-full bg-foreground transition-[width] duration-150"
            style={{ width: `${Math.max(16, avanzamento * 100)}%` }}
          />
        </div>
      </div>
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-8">
        <ol
          ref={fila}
          onScroll={(e) => {
            const f = e.currentTarget;
            const max = f.scrollWidth - f.clientWidth;
            setAvanzamento(max > 0 ? f.scrollLeft / max : 1);
          }}
          className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 [scrollbar-width:none] sm:gap-8 [&::-webkit-scrollbar]:hidden"
          tabIndex={0}
          aria-labelledby="percorso"
        >
          {passi.map((p, i) => (
            <li
              key={p.titolo}
              data-rivela
              style={{ "--ritardo": `${i * 80}ms` } as React.CSSProperties}
              className="flex w-[72vw] shrink-0 snap-start flex-col sm:w-[calc((100%-2rem)/2)] lg:w-[calc((100%-6rem)/4)]"
            >
              <h3 className="font-display text-step-lead leading-tight">
                {p.titolo}
              </h3>
              <p className="mt-2 text-step-body leading-snug">{p.testo}</p>
              <div
                className={`${SPAZI_TELEFONO[i % 6]} ${SPAZI[i % 6]} shrink-0`}
              />
              <figure className="mt-auto grid gap-2">
                <Image
                  src={p.foto}
                  alt={p.didascalia}
                  width={560}
                  height={700}
                  sizes="(min-width: 1024px) 260px, (min-width: 640px) 45vw, 72vw"
                  className="aspect-[4/5] w-full object-cover grayscale"
                />
                <figcaption className="text-step-small text-muted-foreground">
                  {p.didascalia}
                </figcaption>
              </figure>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
