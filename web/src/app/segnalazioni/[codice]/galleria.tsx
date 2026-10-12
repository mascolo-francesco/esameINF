"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface Foto {
  id: number;
  larghezza: number | null;
  altezza: number | null;
  pubblica: string;
  miniatura: string;
}

export function Galleria({ foto, titolo }: { foto: Foto[]; titolo: string }) {
  const [attiva, setAttiva] = useState(0);
  if (foto.length === 0) return null;
  const f = foto[attiva];
  return (
    <div className="grid gap-2">
      <a href={f.pubblica} target="_blank" rel="noopener" className="block overflow-hidden rounded-lg border bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element -- immagini servite dal nostro endpoint, già ridimensionate */}
        <img
          src={f.pubblica}
          alt={`Foto ${attiva + 1} di ${foto.length}: ${titolo}`}
          width={f.larghezza ?? undefined}
          height={f.altezza ?? undefined}
          className="max-h-[32rem] w-full object-contain"
        />
      </a>
      {foto.length > 1 && (
        <ul className="flex gap-2" aria-label="Altre foto">
          {foto.map((x, i) => (
            <li key={x.id}>
              <button
                type="button"
                onClick={() => setAttiva(i)}
                aria-label={`Mostra la foto ${i + 1}`}
                aria-pressed={i === attiva}
                className={cn("overflow-hidden rounded-md border-2", i === attiva ? "border-primary" : "border-transparent")}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={x.miniatura} alt="" className="size-16 object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
