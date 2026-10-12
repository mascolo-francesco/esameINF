import { createHash } from "node:crypto";
import exifr from "exifr";
import sharp, { type Metadata } from "sharp";
import { ErroreApp } from "./errori";
import type { Db } from "./db";

export const MAX_BYTE_FOTO = 10 * 1024 * 1024; // RF-21
const LATO_PUBBLICA = 1600;
const LATO_MINIATURA = 400;

export type MimeFoto = "image/jpeg" | "image/png" | "image/webp";

/** RF-22: il tipo si ricava dai primi byte del file, non dall'estensione né dal Content-Type. */
export function tipoDaMagicNumber(b: Buffer): MimeFoto | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return "image/png";
  if (b.length >= 12 && b.toString("latin1", 0, 4) === "RIFF" && b.toString("latin1", 8, 12) === "WEBP")
    return "image/webp";
  return null;
}

export interface ExifFoto {
  latitudine: number | null;
  longitudine: number | null;
  altitudine: number | null;
  dataScatto: Date | null;
  dispositivo: string | null;
}

export interface FotoElaborata {
  mime: MimeFoto;
  dimensione: number;
  larghezza: number | null;
  altezza: number | null;
  sha256: string;
  hashPercettivo: string;
  exif: ExifFoto;
  originale: Buffer;
  pubblica: Buffer;
  miniatura: Buffer;
}

const arrotonda = (n: unknown, cifre: number) =>
  typeof n === "number" && Number.isFinite(n) ? Number(n.toFixed(cifre)) : null;

export async function leggiExif(b: Buffer): Promise<ExifFoto> {
  const vuoto: ExifFoto = { latitudine: null, longitudine: null, altitudine: null, dataScatto: null, dispositivo: null };
  try {
    const t = await exifr.parse(b, { gps: true, tiff: true, exif: true, xmp: false, icc: false, iptc: false });
    if (!t) return vuoto;
    const lat = arrotonda(t.latitude, 6);
    const lon = arrotonda(t.longitude, 6);
    const alt = arrotonda(t.GPSAltitude, 2);
    const data = t.DateTimeOriginal ?? t.CreateDate;
    const dispositivo = [t.Make, t.Model].filter(Boolean).join(" ").trim();
    return {
      latitudine: lat !== null && lon !== null ? lat : null,
      longitudine: lat !== null && lon !== null ? lon : null,
      altitudine: alt !== null && Math.abs(alt) < 99999 ? alt : null,
      dataScatto: data instanceof Date && !Number.isNaN(data.getTime()) ? data : null,
      dispositivo: dispositivo ? dispositivo.slice(0, 100) : null,
    };
  } catch {
    return vuoto;
  }
}

/** dHash a 64 bit: due foto quasi uguali hanno lo stesso valore (RIA-15). */
async function dHash(b: Buffer): Promise<string> {
  const px = await sharp(b).rotate().grayscale().resize(9, 8, { fit: "fill" }).raw().toBuffer();
  let bits = "";
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) bits += px[y * 9 + x] > px[y * 9 + x + 1] ? "1" : "0";
  return BigInt("0b" + bits).toString(16).padStart(16, "0");
}

/**
 * Controlla e prepara una foto: tipo reale, EXIF (coordinate e data dello scatto), copia
 * pubblica ridimensionata senza metadati (RF-23) e miniatura (RF-24). sharp non copia i
 * metadati nell'output, quindi le varianti escono già ripulite.
 */
export async function elaboraFoto(b: Buffer): Promise<FotoElaborata> {
  if (b.length === 0) throw new ErroreApp("Il file è vuoto.");
  if (b.length > MAX_BYTE_FOTO) throw new ErroreApp("Ogni foto può pesare al massimo 10 MB.");
  const mime = tipoDaMagicNumber(b);
  if (!mime) throw new ErroreApp("Formato non supportato: carica foto JPEG, PNG o WebP.");

  let meta: Metadata;
  try {
    meta = await sharp(b).metadata();
  } catch {
    throw new ErroreApp("Il file non è un'immagine leggibile.");
  }
  const ruotata = (meta.orientation ?? 1) >= 5; // orientamenti EXIF 5-8 scambiano i lati
  const [pubblica, miniatura, exif, hashPercettivo] = await Promise.all([
    sharp(b).rotate().resize(LATO_PUBBLICA, LATO_PUBBLICA, { fit: "inside", withoutEnlargement: true }).webp({ quality: 80 }).toBuffer(),
    sharp(b).rotate().resize(LATO_MINIATURA, LATO_MINIATURA, { fit: "cover" }).webp({ quality: 70 }).toBuffer(),
    leggiExif(b),
    dHash(b),
  ]);
  return {
    mime,
    dimensione: b.length,
    larghezza: (ruotata ? meta.height : meta.width) ?? null,
    altezza: (ruotata ? meta.width : meta.height) ?? null,
    sha256: createHash("sha256").update(b).digest("hex"),
    hashPercettivo,
    exif,
    originale: b,
    pubblica,
    miniatura,
  };
}

export const percorsoVariante = (idAllegato: number, variante: "originale" | "pubblica" | "miniatura") =>
  `/api/allegati/${idAllegato}/${variante}`;

/** Salva l'allegato e le sue tre varianti. Va chiamata dentro una transazione. */
export async function salvaAllegato(tx: Db, idSegnalazione: number, ordine: number, f: FotoElaborata): Promise<number> {
  const { insertId } = await tx.esegui(
    `INSERT INTO allegato (id_segnalazione, tipo, mime_type, dimensione_byte, larghezza, altezza,
                           percorso_originale, hash_sha256, hash_percettivo, exif_latitudine, exif_longitudine,
                           exif_altitudine, exif_data_scatto, exif_dispositivo, ordine, stato_elaborazione)
     VALUES (?, 'foto', ?, ?, ?, ?, '', ?, ?, ?, ?, ?, ?, ?, ?, 'in_elaborazione')`,
    [
      idSegnalazione,
      f.mime,
      f.dimensione,
      f.larghezza,
      f.altezza,
      f.sha256,
      f.hashPercettivo,
      f.exif.latitudine,
      f.exif.longitudine,
      f.exif.altitudine,
      f.exif.dataScatto,
      f.exif.dispositivo,
      ordine,
    ],
  );
  for (const [variante, mime, dati] of [
    ["originale", f.mime, f.originale],
    ["pubblica", "image/webp", f.pubblica],
    ["miniatura", "image/webp", f.miniatura],
  ] as const) {
    await tx.esegui(
      "INSERT INTO file_allegato (id_allegato, variante, mime_type, dimensione, dati) VALUES (?, ?, ?, ?, ?)",
      [insertId, variante, mime, dati.length, dati],
    );
  }
  await tx.esegui(
    `UPDATE allegato SET percorso_originale = ?, percorso_pubblico = ?, percorso_miniatura = ?, stato_elaborazione = 'pronto'
      WHERE id = ?`,
    [percorsoVariante(insertId, "originale"), percorsoVariante(insertId, "pubblica"), percorsoVariante(insertId, "miniatura"), insertId],
  );
  return insertId;
}
