"use client";

import { Marker } from "maplibre-gl";
import { MappaBase } from "./mappa-base";

/** Piccola mappa con il segnaposto di una segnalazione. */
export function MappaPunto({ lat, lon, colore, className }: { lat: number; lon: number; colore?: string; className?: string }) {
  return (
    <MappaBase
      etichetta="Posizione della segnalazione"
      className={className}
      opzioni={{ center: [lon, lat], zoom: 15.5 }}
      onPronta={(m) => {
        new Marker({ color: colore ?? "#1f6f5c" }).setLngLat([lon, lat]).addTo(m);
      }}
    />
  );
}
