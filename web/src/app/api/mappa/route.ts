import { db } from "@/lib/server/db";

/**
 * RF-38, RNF-18: marker delle segnalazioni pubbliche dentro l'area visibile, in GeoJSON.
 * Il filtro MBRContains usa l'indice spaziale. Con SRID 4326 il WKT va scritto "lat lon".
 */
export async function GET(req: Request) {
  const bbox = new URL(req.url).searchParams.get("bbox")?.split(",").map(Number);
  if (!bbox || bbox.length !== 4 || bbox.some((n) => !Number.isFinite(n))) {
    return Response.json({ errore: "bbox richiesto: ovest,sud,est,nord" }, { status: 400 });
  }
  const limita = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
  const ovest = limita(bbox[0], 8.9, 9.5);
  const sud = limita(bbox[1], 45.3, 45.65);
  const est = limita(bbox[2], 8.9, 9.5);
  const nord = limita(bbox[3], 45.3, 45.65);

  const righe = await db.righe<{
    codice_pubblico: string;
    titolo: string;
    latitudine: number;
    longitudine: number;
    num_sostegni: number;
    stato: string;
    colore: string | null;
  }>(
    `SELECT s.codice_pubblico, s.titolo, s.latitudine, s.longitudine, s.num_sostegni, st.nome AS stato,
            (SELECT k.colore_mappa FROM classificazione c JOIN categoria k ON k.id = c.id_categoria
              WHERE c.id_segnalazione = s.id AND c.confermata ORDER BY c.confidenza_ia DESC, k.ordine LIMIT 1) AS colore
       FROM segnalazione s
       JOIN stato st ON st.codice = s.stato_corrente AND st.pubblico AND s.stato_corrente <> 'UNITA'
      WHERE MBRContains(ST_GeomFromText(CONCAT('POLYGON((', ?, ' ', ?, ',', ?, ' ', ?, ',', ?, ' ', ?, ',',
                                               ?, ' ', ?, ',', ?, ' ', ?, '))'), 4326), s.posizione)
      LIMIT 2000`,
    [sud, ovest, nord, ovest, nord, est, sud, est, sud, ovest].map(String),
  );

  return Response.json(
    {
      type: "FeatureCollection",
      features: righe.map((r) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [r.longitudine, r.latitudine] },
        properties: { codice: r.codice_pubblico, titolo: r.titolo, sostegni: r.num_sostegni, stato: r.stato, colore: r.colore ?? "#64748B" },
      })),
    },
    { headers: { "Cache-Control": "public, max-age=30, s-maxage=30" } },
  );
}
