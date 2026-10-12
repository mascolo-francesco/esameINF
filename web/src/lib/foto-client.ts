"use client";

import exifr from "exifr";

export interface ExifClient {
  lat: number | null;
  lon: number | null;
  data: string | null;
}

export interface FotoPronta {
  id: string;
  blob: Blob;
  nome: string;
  anteprima: string;
  exif: ExifClient;
}

// Su Vercel una richiesta non può superare 4,5 MB: sopra questa soglia ridimensiono nel browser.
const SOGLIA_BYTE = 1.5 * 1024 * 1024;
const LATO_MAX = 2048;
const TIPI_OK = ["image/jpeg", "image/png", "image/webp"];

function isHeic(f: File) {
  return /image\/hei[cf]/.test(f.type) || /\.hei[cf]$/i.test(f.name);
}

async function leggiExif(f: Blob): Promise<ExifClient> {
  try {
    const t = await exifr.parse(f, { gps: true, pick: ["latitude", "longitude", "DateTimeOriginal", "CreateDate"] });
    const data = t?.DateTimeOriginal ?? t?.CreateDate;
    return {
      lat: typeof t?.latitude === "number" ? t.latitude : null,
      lon: typeof t?.longitude === "number" ? t.longitude : null,
      data: data instanceof Date && !Number.isNaN(data.getTime()) ? data.toISOString() : null,
    };
  } catch {
    return { lat: null, lon: null, data: null };
  }
}

async function ridimensiona(b: Blob): Promise<Blob> {
  const img = await createImageBitmap(b, { imageOrientation: "from-image" });
  const scala = Math.min(1, LATO_MAX / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scala);
  canvas.height = Math.round(img.height * scala);
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  img.close();
  return new Promise((ok, ko) => canvas.toBlob((r) => (r ? ok(r) : ko(new Error("conversione"))), "image/jpeg", 0.85));
}

/**
 * Prepara una foto per l'invio: legge l'EXIF (posizione e data), converte le HEIC dell'iPhone
 * in JPEG e ridimensiona le foto grandi. L'EXIF letto qui viaggia a parte, perché il canvas lo perde.
 */
export async function preparaFoto(f: File): Promise<FotoPronta> {
  const exif = await leggiExif(f);
  let blob: Blob = f;
  if (isHeic(f)) {
    const heic2any = (await import("heic2any")).default;
    const r = await heic2any({ blob: f, toType: "image/jpeg", quality: 0.85 });
    blob = Array.isArray(r) ? r[0] : r;
  } else if (!f.type.startsWith("image/")) {
    throw new Error(`"${f.name}" non è un'immagine.`);
  }
  if (blob.size > SOGLIA_BYTE || !TIPI_OK.includes(blob.type)) {
    try {
      blob = await ridimensiona(blob);
    } catch {
      throw new Error(`Non riesco a leggere "${f.name}". Prova con una foto JPEG o PNG.`);
    }
  }
  const nome = f.name.replace(/\.[^.]+$/, "") + (blob.type === "image/png" ? ".png" : blob.type === "image/webp" ? ".webp" : ".jpg");
  return { id: crypto.randomUUID(), blob, nome, anteprima: URL.createObjectURL(blob), exif };
}
