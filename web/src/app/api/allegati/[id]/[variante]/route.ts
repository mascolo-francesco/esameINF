import { db } from "@/lib/server/db";
import { utenteCorrente } from "@/lib/server/auth/sessione";

const VARIANTI = new Set(["originale", "pubblica", "miniatura"]);

/**
 * Restituisce una variante di una foto salvata nel database.
 * - pubblica e miniatura: a tutti se la segnalazione è pubblica, altrimenti solo ad autore e staff
 * - originale (con EXIF): solo allo staff (RNF-07, RNF-14)
 */
export async function GET(_: Request, ctx: RouteContext<"/api/allegati/[id]/[variante]">) {
  const { id, variante } = await ctx.params;
  const idAllegato = Number(id);
  if (!Number.isInteger(idAllegato) || idAllegato <= 0 || !VARIANTI.has(variante)) return new Response(null, { status: 404 });

  const f = await db.riga<{ mime_type: string; dati: Buffer; pubblico: number; id_autore: number }>(
    `SELECT f.mime_type, f.dati, st.pubblico, s.id_autore
       FROM file_allegato f
       JOIN allegato a ON a.id = f.id_allegato
       JOIN segnalazione s ON s.id = a.id_segnalazione
       JOIN stato st ON st.codice = s.stato_corrente
      WHERE f.id_allegato = ? AND f.variante = ?`,
    [idAllegato, variante],
  );
  if (!f) return new Response(null, { status: 404 });

  const pubblico = variante !== "originale" && Boolean(f.pubblico);
  if (!pubblico) {
    const u = await utenteCorrente();
    const staff = (u?.livello ?? 0) >= 2;
    const autore = u?.id === f.id_autore && variante !== "originale";
    if (!staff && !autore) return new Response(null, { status: 404 });
  }

  return new Response(new Uint8Array(f.dati), {
    headers: {
      "Content-Type": f.mime_type,
      "Content-Length": String(f.dati.length),
      // il contenuto di un allegato non cambia mai (trigger trg_allegato_bu)
      "Cache-Control": pubblico ? "public, max-age=31536000, immutable" : "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
