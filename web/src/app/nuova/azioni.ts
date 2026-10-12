"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { ErroreApp } from "@/lib/server/errori";
import { datiForm, eseguiAzione, type Esito } from "@/lib/server/azione";
import { contestoRichiesta, richiediUtente } from "@/lib/server/auth/sessione";
import { elaboraFoto, type FotoElaborata } from "@/lib/server/foto";
import { inviaSegnalazione } from "@/lib/server/segnalazioni";
import { nomeQuartiere } from "@/lib/formato";
import { schemaSegnalazione } from "@/lib/validazione";

const coordinate = z.object({ lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180) });

export interface InfoPosizione {
  quartiere: string;
  municipio: string;
}

/** RF-14: quartiere e Municipio del punto, da mostrare prima dell'invio. null = fuori Milano. */
export async function infoPosizione(lat: number, lon: number): Promise<InfoPosizione | null> {
  await richiediUtente();
  const p = coordinate.parse({ lat, lon });
  const r = await db.riga<{ quartiere: string; municipio: string }>(
    `SELECT q.nome AS quartiere, m.nome AS municipio
       FROM quartiere q JOIN municipio m ON m.id = q.id_municipio
      WHERE q.id = fn_quartiere_da_coordinate(?, ?)`,
    [p.lat, p.lon],
  );
  return r ? { quartiere: nomeQuartiere(r.quartiere), municipio: r.municipio } : null;
}

export interface Simile {
  codice: string;
  titolo: string;
  sostegni: number;
  miniatura: string | null;
  distanza: number;
}

/** RF-16: segnalazioni pubblicate entro il raggio configurato e con una delle categorie scelte. */
export async function cercaSimili(lat: number, lon: number, categorie: number[]): Promise<Simile[]> {
  await richiediUtente();
  const p = coordinate.parse({ lat, lon });
  const k = z.array(z.number().int().positive()).min(1).max(10).parse(categorie);
  const righe = await db.righe<{ codice_pubblico: string; titolo: string; num_sostegni: number; miniatura: string | null; distanza_m: number }>(
    `SELECT v.codice_pubblico, v.titolo, v.num_sostegni, v.miniatura,
            ROUND(ST_Distance_Sphere(s.posizione, ST_SRID(POINT(?, ?), 4326))) AS distanza_m
       FROM segnalazione s
       JOIN v_segnalazione_pubblica v ON v.id = s.id
      WHERE v.votabile
        AND ST_Distance_Sphere(s.posizione, ST_SRID(POINT(?, ?), 4326)) <= fn_param('segnalazione.raggio_duplicati_m')
        AND EXISTS (SELECT 1 FROM classificazione c
                     WHERE c.id_segnalazione = s.id AND c.confermata AND c.id_categoria IN (${k.map(() => "?").join(", ")}))
      ORDER BY distanza_m
      LIMIT 5`,
    [p.lon, p.lat, p.lon, p.lat, ...k],
  );
  return righe.map((r) => ({
    codice: r.codice_pubblico,
    titolo: r.titolo,
    sostegni: r.num_sostegni,
    miniatura: r.miniatura,
    distanza: r.distanza_m,
  }));
}

// EXIF letto nel browser: serve quando la foto è stata ridimensionata prima dell'invio
// (il canvas perde i metadati). Lo uso solo se il server non trova l'EXIF nel file.
const schemaExifClient = z
  .array(
    z
      .object({
        lat: z.number().min(-90).max(90).nullish(),
        lon: z.number().min(-180).max(180).nullish(),
        data: z.iso.datetime({ offset: true }).nullish(),
      })
      .nullable(),
  )
  .catch([]);

export async function inviaNuovaSegnalazione(fd: FormData): Promise<Esito> {
  let codice = "";
  const esito = await eseguiAzione(async () => {
    const u = await richiediUtente();
    if (!u.puoScrivere) throw new ErroreApp("Il tuo account al momento non può pubblicare segnalazioni.");
    const d = schemaSegnalazione.parse({ ...datiForm(fd), categorie: fd.getAll("categorie") });

    const file = fd.getAll("foto").filter((f): f is File => f instanceof File && f.size > 0);
    if (file.length < 1) throw new ErroreApp("Aggiungi almeno una foto.");
    if (file.length > 5) throw new ErroreApp("Puoi allegare al massimo 5 foto.");
    const exifClient = schemaExifClient.parse(JSON.parse(String(fd.get("exif") ?? "[]")));

    const foto: FotoElaborata[] = [];
    for (const [i, f] of file.entries()) {
      const el = await elaboraFoto(Buffer.from(await f.arrayBuffer()));
      const c = exifClient[i];
      if (el.exif.latitudine === null && c?.lat != null && c?.lon != null) {
        el.exif.latitudine = Number(c.lat.toFixed(6));
        el.exif.longitudine = Number(c.lon.toFixed(6));
      }
      if (el.exif.dataScatto === null && c?.data) el.exif.dataScatto = new Date(c.data);
      foto.push(el);
    }

    const { ip } = await contestoRichiesta();
    const r = await inviaSegnalazione({ idUtente: u.id, ip }, { ...d, foto });
    codice = r.codice;
  });
  if (esito.ok) redirect(`/segnalazioni/${codice}?inviata=1`);
  return esito;
}
