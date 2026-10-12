"use client";

import { Popup, type GeoJSONSource, type Map as MappaLibre, type MapLayerMouseEvent } from "maplibre-gl";
import { MappaBase } from "@/components/mappa/mappa-base";

const SORGENTE = "segnalazioni";

function escape(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/**
 * RF-38: marker colorati per categoria e raggruppati quando sono vicini. Ricarico i dati
 * dell'area visibile a ogni spostamento della mappa (query marker_mappa).
 */
export function MappaSegnalazioni() {
  function configura(m: MappaLibre) {
    m.addSource(SORGENTE, {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
      cluster: true,
      clusterRadius: 45,
      clusterMaxZoom: 15,
    });
    m.addLayer({
      id: "gruppi",
      type: "circle",
      source: SORGENTE,
      filter: ["has", "point_count"],
      paint: {
        "circle-color": "#1f6f5c",
        "circle-opacity": 0.85,
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 2,
        "circle-radius": ["step", ["get", "point_count"], 16, 10, 22, 50, 28],
      },
    });
    m.addLayer({
      id: "gruppi-numero",
      type: "symbol",
      source: SORGENTE,
      filter: ["has", "point_count"],
      layout: { "text-field": ["get", "point_count_abbreviated"], "text-size": 13, "text-font": ["Noto Sans Bold"] },
      paint: { "text-color": "#ffffff" },
    });
    m.addLayer({
      id: "punti",
      type: "circle",
      source: SORGENTE,
      filter: ["!", ["has", "point_count"]],
      paint: {
        "circle-color": ["get", "colore"],
        "circle-radius": ["interpolate", ["linear"], ["get", "sostegni"], 0, 7, 20, 13],
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 2,
      },
    });

    let controllore: AbortController | null = null;
    async function carica() {
      controllore?.abort();
      controllore = new AbortController();
      const b = m.getBounds();
      try {
        const r = await fetch(`/api/mappa?bbox=${[b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].map((n) => n.toFixed(5)).join(",")}`, {
          signal: controllore.signal,
        });
        if (r.ok) (m.getSource(SORGENTE) as GeoJSONSource).setData(await r.json());
      } catch {
        // richiesta annullata da uno spostamento successivo
      }
    }
    carica();
    m.on("moveend", carica);

    m.on("click", "gruppi", async (e: MapLayerMouseEvent) => {
      const f = e.features?.[0];
      if (!f || f.geometry.type !== "Point") return;
      const zoom = await (m.getSource(SORGENTE) as GeoJSONSource).getClusterExpansionZoom(f.properties.cluster_id);
      m.easeTo({ center: f.geometry.coordinates as [number, number], zoom });
    });
    m.on("click", "punti", (e: MapLayerMouseEvent) => {
      const f = e.features?.[0];
      if (!f || f.geometry.type !== "Point") return;
      const p = f.properties as { codice: string; titolo: string; sostegni: number; stato: string };
      new Popup({ offset: 12, maxWidth: "260px" })
        .setLngLat(f.geometry.coordinates as [number, number])
        .setHTML(
          `<a href="/segnalazioni/${escape(p.codice)}" style="display:grid;gap:2px;text-decoration:none;color:inherit">
             <strong style="font-size:14px">${escape(p.titolo)}</strong>
             <span style="font-size:12px;color:#555">${escape(p.stato)} · ${p.sostegni} sostegni</span>
             <span style="font-size:12px;color:#1f6f5c;font-weight:600">Apri la segnalazione →</span>
           </a>`,
        )
        .addTo(m);
    });
    for (const livello of ["gruppi", "punti"]) {
      m.on("mouseenter", livello, () => (m.getCanvas().style.cursor = "pointer"));
      m.on("mouseleave", livello, () => (m.getCanvas().style.cursor = ""));
    }
  }

  return <MappaBase etichetta="Mappa delle segnalazioni di Milano" className="h-[70vh] min-h-96" onPronta={configura} />;
}
