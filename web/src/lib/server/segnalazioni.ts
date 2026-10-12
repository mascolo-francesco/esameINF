import { inTransazione, type Attore, type Db } from "./db";
import { salvaAllegato, type FotoElaborata } from "./foto";

export interface NuovaSegnalazione {
  titolo: string;
  descrizione: string;
  tipo: "problema" | "proposta";
  latitudine: number;
  longitudine: number;
  indirizzo: string | null;
  fonte: "exif" | "gps" | "manuale";
  categorie: number[];
  foto: FotoElaborata[];
}

export const MOTIVO_SENZA_IA = "Moderazione manuale (IA non attiva)";

/** Cambio di stato: sempre e solo tramite la procedura (RD-09). */
export async function cambiaStato(
  tx: Db,
  id: number,
  statoA: string,
  attore: "autore" | "sistema" | "moderatore" | "amministratore",
  idUtente: number | null,
  motivazione: string | null = null,
  idPrincipale: number | null = null,
) {
  await tx.esegui("CALL sp_cambia_stato(?, ?, ?, ?, ?, ?)", [id, statoA, attore, idUtente, motivazione, idPrincipale]);
}

/**
 * UC-01 in una sola transazione: bozza, foto, categorie, invio (Ricevuta).
 * Senza i moduli IA la segnalazione va subito in revisione e la approva un moderatore.
 * Limiti e vincoli (5 al giorno, fuori Milano, 1-5 foto...) li controlla il database.
 */
export async function inviaSegnalazione(attore: Attore & { idUtente: number }, d: NuovaSegnalazione) {
  return inTransazione(attore, async (tx) => {
    const { insertId: id } = await tx.esegui(
      `INSERT INTO segnalazione (titolo, descrizione, tipo, latitudine, longitudine, indirizzo, fonte_posizione, id_autore)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [d.titolo, d.descrizione, d.tipo, d.latitudine, d.longitudine, d.indirizzo, d.fonte, attore.idUtente],
    );
    for (const [i, f] of d.foto.entries()) await salvaAllegato(tx, id, i + 1, f);
    for (const k of d.categorie) {
      await tx.esegui(
        "INSERT INTO classificazione (id_segnalazione, id_categoria, origine, confermata) VALUES (?, ?, 'utente', TRUE)",
        [id, k],
      );
    }
    await cambiaStato(tx, id, "RICEVUTA", "autore", attore.idUtente);
    await cambiaStato(tx, id, "IN_REVISIONE", "sistema", null, MOTIVO_SENZA_IA);
    const r = await tx.riga<{ codice_pubblico: string }>("SELECT codice_pubblico FROM segnalazione WHERE id = ?", [id]);
    return { id, codice: r!.codice_pubblico };
  });
}
