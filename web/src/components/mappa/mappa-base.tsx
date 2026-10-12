"use client";

import { useEffect, useEffectEvent, useRef } from "react";
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
      pulizia = pronta(mappa);
    });
    return () => {
      pulizia?.();
      mappa.remove();
    };
    // la mappa si crea una volta sola; le opzioni iniziali non cambiano
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={contenitore} role="region" aria-label={etichetta} className={cn("h-80 w-full overflow-hidden rounded-xl border shadow-card", className)} />;
}
