"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { MapTrifoldIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { Map as MappaLibre, NavigationControl, setWorkerUrl, type MapOptions } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { cn } from "@/lib/utils";

// copiato in public/ da scripts/copia-worker-mappa.mjs
setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

export const CENTRO_MILANO: [number, number] = [9.19, 45.4642];
// un po' più largo del riquadro di ck_segnalazione_bbox, per non tagliare la periferia
const LIMITI_MILANO: [[number, number], [number, number]] = [
  [8.95, 45.33],
  [9.42, 45.6],
];

/** Mappe gratuite di OpenFreeMap: nessuna chiave API. */
export const STILE_MAPPA = "https://tiles.openfreemap.org/styles/liberty";

interface Props {
  className?: string;
  etichetta: string;
  opzioni?: Partial<MapOptions>;
  onPronta: (mappa: MappaLibre) => void | (() => void);
}

/** Mappa di Milano. Il componente padre aggiunge sorgenti, livelli ed eventi in onPronta. */
export function MappaBase({ className, etichetta, opzioni, onPronta }: Props) {
  const contenitore = useRef<HTMLDivElement>(null);
  const pronta = useEffectEvent((m: MappaLibre) => onPronta(m));
  // lo stile e le prime tessere arrivano da OpenFreeMap: finché non ci sono il riquadro resterebbe vuoto
  const [stato, setStato] = useState<"carica" | "pronta" | "errore">("carica");

  useEffect(() => {
    if (!contenitore.current) return;
    const mappa = new MappaLibre({
      container: contenitore.current,
      style: STILE_MAPPA,
      center: CENTRO_MILANO,
      zoom: 11.5,
      minZoom: 10,
      maxBounds: LIMITI_MILANO,
      attributionControl: { compact: true },
      cooperativeGestures: false,
      ...opzioni,
    });
    mappa.addControl(new NavigationControl({ showCompass: false }), "top-right");
    let pulizia: void | (() => void);
    mappa.on("load", () => {
      setStato("pronta");
      pulizia = pronta(mappa);
    });
    // un errore prima di "load" vuol dire che lo stile non è arrivato; dopo sono tessere singole e la mappa resta usabile
    mappa.on("error", () => {
      if (!mappa.loaded()) setStato((s) => (s === "carica" ? "errore" : s));
    });
    return () => {
      pulizia?.();
      mappa.remove();
    };
    // la mappa si crea una volta sola; le opzioni iniziali non cambiano
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={cn("relative h-80 w-full overflow-hidden rounded-xl border bg-sunken shadow-card", className)}>
      <div ref={contenitore} role="region" aria-label={etichetta} aria-busy={stato === "carica"} className="size-full" />
      <div
        className={cn(
          "pointer-events-none absolute inset-0 grid place-items-center bg-sunken transition-opacity duration-300 ease-(--ease-out)",
          stato === "pronta" && "opacity-0",
        )}
        aria-hidden={stato === "pronta"}
      >
        {stato === "errore" ? (
          <p role="alert" className="flex max-w-xs flex-col items-center gap-2 px-4 text-center text-sm text-muted-foreground">
            <WarningCircleIcon weight="regular" className="size-6" aria-hidden />
            Non riesco a caricare la mappa. Controlla la connessione e ricarica la pagina.
          </p>
        ) : (
          <p role="status" className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
            <MapTrifoldIcon weight="regular" className="size-7 motion-safe:animate-pulse" aria-hidden />
            {stato === "carica" ? "Caricamento della mappa…" : ""}
          </p>
        )}
      </div>
    </div>
  );
}
