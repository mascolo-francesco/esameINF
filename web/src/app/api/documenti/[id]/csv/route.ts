import { db } from "@/lib/server/db";
import { utenteCorrente, LIVELLO } from "@/lib/server/auth/sessione";
import { cellaCsv } from "@/lib/server/csv";

// RF-48: query esporta_documento_csv. Separatore ";" e BOM, così Excel in italiano lo apre bene.
export async function GET(_: Request, ctx: RouteContext<"/api/documenti/[id]/csv">) {
  const u = await utenteCorrente();
  if (!u || u.livello < LIVELLO.amministratore) return new Response(null, { status: 404 });
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id <= 0) return new Response(null, { status: 404 });
  const doc = await db.riga<{ titolo: string; versione: number }>("SELECT titolo, versione FROM documento_programmatico WHERE id = ?", [id]);
  if (!doc) return new Response(null, { status: 404 });

  const righe = await db.righe<Record<string, unknown>>(
    `SELECT ds.posizione, s.codice_pubblico, s.titolo, s.descrizione, s.tipo, v.categorie,
            v.quartiere, v.municipio, s.latitudine, s.longitudine, s.num_sostegni, s.punteggio_priorita,
            ds.nota_comitato
       FROM documento_segnalazione ds
       JOIN segnalazione s ON s.id = ds.id_segnalazione
       JOIN v_segnalazione_pubblica v ON v.id = s.id
      WHERE ds.id_documento = ?
      ORDER BY ds.posizione`,
    [id],
  );
  const intestazione = [
    "posizione", "codice", "titolo", "descrizione", "tipo", "categorie", "quartiere", "municipio",
    "latitudine", "longitudine", "sostegni", "punteggio", "nota_comitato",
  ];
  const csv = [intestazione.join(";"), ...righe.map((r) => Object.values(r).map(cellaCsv).join(";"))].join("\r\n");
  const nome = `${doc.titolo.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-v${doc.versione}.csv`;
  return new Response("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nome}"`,
      "Cache-Control": "no-store",
    },
  });
}
