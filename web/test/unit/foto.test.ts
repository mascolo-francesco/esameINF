import { describe, expect, it } from "vitest";
import sharp from "sharp";
import exifr from "exifr";
import { elaboraFoto, tipoDaMagicNumber } from "@/lib/server/foto";
import { ErroreApp } from "@/lib/server/errori";

const immagine = (formato: "jpeg" | "png" | "webp" | "gif", lato = 2000) =>
  sharp({ create: { width: lato, height: Math.round(lato * 0.75), channels: 3, background: "#2563eb" } })
    .toFormat(formato)
    .toBuffer();

describe("tipoDaMagicNumber (RF-22)", () => {
  it("riconosce JPEG, PNG e WebP dai primi byte", async () => {
    expect(tipoDaMagicNumber(await immagine("jpeg", 50))).toBe("image/jpeg");
    expect(tipoDaMagicNumber(await immagine("png", 50))).toBe("image/png");
    expect(tipoDaMagicNumber(await immagine("webp", 50))).toBe("image/webp");
  });

  it("rifiuta altri formati anche se si spacciano per immagini", async () => {
    expect(tipoDaMagicNumber(await immagine("gif", 50))).toBeNull();
    expect(tipoDaMagicNumber(Buffer.from("<?php echo 'ciao'; ?>"))).toBeNull();
    expect(tipoDaMagicNumber(Buffer.alloc(0))).toBeNull();
  });
});

describe("elaboraFoto", () => {
  it("crea copia pubblica e miniatura ridimensionate e senza EXIF (RF-23, RF-24)", async () => {
    // JPEG con coordinate GPS e data nei metadati
    const conExif = await sharp(await immagine("jpeg"))
      .withExif({ IFD0: { Make: "Telefono", Model: "Prova" }, IFD2: { DateTimeOriginal: "2026:10:01 10:30:00" } })
      .jpeg()
      .toBuffer();
    const f = await elaboraFoto(conExif);

    expect(f.mime).toBe("image/jpeg");
    expect(f.larghezza).toBe(2000);
    expect(f.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(f.hashPercettivo).toMatch(/^[0-9a-f]{16}$/);
    expect(f.exif.dispositivo).toBe("Telefono Prova");
    expect(f.exif.dataScatto?.getUTCFullYear()).toBe(2026);

    const pubblica = await sharp(f.pubblica).metadata();
    expect(pubblica.format).toBe("webp");
    expect(Math.max(pubblica.width!, pubblica.height!)).toBe(1600);
    expect(await exifr.parse(f.pubblica).catch(() => undefined)).toBeUndefined();

    const miniatura = await sharp(f.miniatura).metadata();
    expect(miniatura.width).toBe(400);
  });

  it("non ingrandisce le foto piccole", async () => {
    const f = await elaboraFoto(await immagine("png", 800));
    const pubblica = await sharp(f.pubblica).metadata();
    expect(pubblica.width).toBe(800);
  });

  it("rifiuta file non validi con un messaggio per l'utente", async () => {
    await expect(elaboraFoto(await immagine("gif", 50))).rejects.toBeInstanceOf(ErroreApp);
    await expect(elaboraFoto(Buffer.alloc(0))).rejects.toThrow("vuoto");
    await expect(elaboraFoto(Buffer.alloc(11 * 1024 * 1024, 0xff))).rejects.toThrow("10 MB");
  });

  it("due foto quasi uguali hanno lo stesso hash percettivo (RIA-15)", async () => {
    const a = await immagine("jpeg", 600);
    const b = await sharp(a).jpeg({ quality: 40 }).toBuffer();
    const [fa, fb] = await Promise.all([elaboraFoto(a), elaboraFoto(b)]);
    expect(fa.sha256).not.toBe(fb.sha256);
    expect(fa.hashPercettivo).toBe(fb.hashPercettivo);
  });
});
