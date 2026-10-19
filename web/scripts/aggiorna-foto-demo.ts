/**
 * Mette le foto di scripts/foto-demo nelle segnalazioni di prova già presenti nel database,
 * al posto dei segnaposto disegnati dalle versioni precedenti del seed. Non cancella niente.
 *
 *   npm run foto-demo
 *
 * Il trigger trg_allegato_bu vieta di cambiare hash_sha256, quindi l'hash resta quello del
 * segnaposto: va bene solo per i dati di prova. Sostituisce i file delle tre varianti e aggiunge
 * ?v=<hash nuovo> ai percorsi, perché la rotta delle foto le mette in cache come immutabili.
 * Si può rilanciare: le segnalazioni già aggiornate vengono saltate.
 */
import { readFileSync } from "node:fs";
import { db, inTransazione, pool } from "../src/lib/server/db";
import { elaboraFoto, percorsoVariante } from "../src/lib/server/foto";
import { SEGNALAZIONI, fotoDemo } from "./dati-demo";

async function main() {
  const admin = await db.riga<{ id: number }>("SELECT id FROM utente WHERE email = 'admin@example.com'");
  if (!admin) throw new Error("Manca l'amministratore della demo: il database non viene da npm run seed.");
  const attore = { idUtente: admin.id, ip: "127.0.0.1" };

  let aggiornate = 0;
  for (const s of SEGNALAZIONI) {
    // solo le segnalazioni del seed: stesso titolo e autore con email @example.com
    const righe = await db.righe<{ id: number; percorso_pubblico: string }>(
      `SELECT a.id, a.percorso_pubblico
         FROM allegato a
         JOIN segnalazione s ON s.id = a.id_segnalazione
         JOIN utente u ON u.id = s.id_autore
        WHERE s.titolo = ? AND u.email LIKE '%@example.com' AND a.ordine = 1`,
      [s.titolo],
    );
    if (righe.length !== 1) {
      console.log(`  saltata (${righe.length} allegati trovati): ${s.titolo}`);
      continue;
    }
    const [a] = righe;
    const f = await elaboraFoto(readFileSync(fotoDemo(s.chiave)));
    const versione = `?v=${f.sha256.slice(0, 12)}`;
    if (a.percorso_pubblico.endsWith(versione)) {
      console.log(`  già aggiornata: ${s.titolo}`);
      continue;
    }

    await inTransazione(attore, async (tx) => {
      for (const [variante, mime, dati] of [
        ["originale", f.mime, f.originale],
        ["pubblica", "image/webp", f.pubblica],
        ["miniatura", "image/webp", f.miniatura],
      ] as const) {
        await tx.esegui("UPDATE file_allegato SET mime_type = ?, dimensione = ?, dati = ? WHERE id_allegato = ? AND variante = ?", [
          mime,
          dati.length,
          dati,
          a.id,
          variante,
        ]);
      }
      await tx.esegui(
        `UPDATE allegato SET mime_type = ?, dimensione_byte = ?, larghezza = ?, altezza = ?,
                percorso_originale = ?, percorso_pubblico = ?, percorso_miniatura = ?
          WHERE id = ?`,
        [
          f.mime,
          f.dimensione,
          f.larghezza,
          f.altezza,
          percorsoVariante(a.id, "originale") + versione,
          percorsoVariante(a.id, "pubblica") + versione,
          percorsoVariante(a.id, "miniatura") + versione,
          a.id,
        ],
      );
    });
    aggiornate++;
    console.log(`  aggiornata: ${s.titolo}`);
  }
  console.log(`Foto sostituite: ${aggiornate} su ${SEGNALAZIONI.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => pool().end());
