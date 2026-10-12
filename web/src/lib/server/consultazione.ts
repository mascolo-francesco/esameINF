import "server-only";
import { cache } from "react";
import { db } from "./db";
import { nomeQuartiere } from "../formato";

export interface Dettaglio {
  id: number;
  codice: string;
  titolo: string;
  descrizione: string;
  tipo: "problema" | "proposta";
  lat: number;
  lon: number;
  indirizzo: string | null;
  statoCodice: string;
  stato: string;
  pubblico: boolean;
  votabile: boolean;
  finale: boolean;
  dataInvio: Date | null;
  dataPubblicazione: Date | null;
  dataStato: Date;
  sostegni: number;
  commentatori: number;
  punteggio: number;
  quartiere: string;
  municipio: string;
  idAutore: number;
  autore: string;
  codicePrincipale: string | null;
  categorie: { id: number; nome: string; colore: string }[];
  foto: { id: number; larghezza: number | null; altezza: number | null; pubblica: string; miniatura: string }[];
}

/**
 * Dettaglio di una segnalazione (RF-41). Restituisce anche quelle non pubbliche: chi chiama
 * decide se mostrarle (all'autore e allo staff sì, agli altri no).
 */
export const dettaglioSegnalazione = cache(async (codice: string): Promise<Dettaglio | null> => {
  const s = await db.riga<{
    id: number;
    codice_pubblico: string;
    titolo: string;
    descrizione: string;
    tipo: "problema" | "proposta";
    latitudine: number;
    longitudine: number;
    indirizzo: string | null;
    stato_corrente: string;
    stato: string;
    pubblico: number;
    votabile: number;
    finale: number;
    data_invio: Date | null;
    data_pubblicazione: Date | null;
    data_stato_corrente: Date;
    num_sostegni: number;
    num_commentatori: number;
    punteggio_priorita: number;
    quartiere: string;
    municipio: string;
    id_autore: number;
    autore: string;
    codice_principale: string | null;
  }>(
    `SELECT s.id, s.codice_pubblico, s.titolo, s.descrizione, s.tipo, s.latitudine, s.longitudine, s.indirizzo,
            s.stato_corrente, st.nome AS stato, st.pubblico, st.votabile, st.finale,
            s.data_invio, s.data_pubblicazione, s.data_stato_corrente,
            s.num_sostegni, s.num_commentatori, s.punteggio_priorita,
            q.nome AS quartiere, m.nome AS municipio, s.id_autore, up.nome_pubblico AS autore,
            sp.codice_pubblico AS codice_principale
       FROM segnalazione s
       JOIN stato st ON st.codice = s.stato_corrente
       JOIN quartiere q ON q.id = s.id_quartiere
       JOIN municipio m ON m.id = q.id_municipio
       JOIN v_utente_pubblico up ON up.id = s.id_autore
       LEFT JOIN segnalazione sp ON sp.id = s.id_segnalazione_principale
      WHERE s.codice_pubblico = ? AND s.stato_corrente <> 'BOZZA'`,
    [codice],
  );
  if (!s) return null;
  const [categorie, foto] = await Promise.all([
    db.righe<{ id: number; nome: string; colore_mappa: string }>(
      `SELECT k.id, k.nome, k.colore_mappa FROM classificazione c JOIN categoria k ON k.id = c.id_categoria
        WHERE c.id_segnalazione = ? AND c.confermata ORDER BY k.ordine`,
      [s.id],
    ),
    db.righe<{ id: number; larghezza: number | null; altezza: number | null; percorso_pubblico: string; percorso_miniatura: string }>(
      `SELECT id, larghezza, altezza, percorso_pubblico, percorso_miniatura FROM allegato
        WHERE id_segnalazione = ? AND stato_elaborazione = 'pronto' ORDER BY ordine`,
      [s.id],
    ),
  ]);
  return {
    id: s.id,
    codice: s.codice_pubblico,
    titolo: s.titolo,
    descrizione: s.descrizione,
    tipo: s.tipo,
    lat: s.latitudine,
    lon: s.longitudine,
    indirizzo: s.indirizzo,
    statoCodice: s.stato_corrente,
    stato: s.stato,
    pubblico: Boolean(s.pubblico),
    votabile: Boolean(s.votabile),
    finale: Boolean(s.finale),
    dataInvio: s.data_invio,
    dataPubblicazione: s.data_pubblicazione,
    dataStato: s.data_stato_corrente,
    sostegni: s.num_sostegni,
    commentatori: s.num_commentatori,
    punteggio: s.punteggio_priorita,
    quartiere: nomeQuartiere(s.quartiere),
    municipio: s.municipio,
    idAutore: s.id_autore,
    autore: s.autore,
    codicePrincipale: s.codice_principale,
    categorie: categorie.map((k) => ({ id: k.id, nome: k.nome, colore: k.colore_mappa })),
    foto: foto.map((f) => ({ id: f.id, larghezza: f.larghezza, altezza: f.altezza, pubblica: f.percorso_pubblico, miniatura: f.percorso_miniatura })),
  };
});

export interface PassoCronologia {
  id: number;
  data: Date;
  da: string;
  a: string;
  attore: string;
  motivazione: string | null;
}

/** RF-28: cronologia degli stati. Per chi non è staff non dice quale moderatore ha agito. */
export const cronologia = (idSegnalazione: number) =>
  db.righe<PassoCronologia>(
    `SELECT h.id, h.data_ora AS data, sd.nome AS da, sa.nome AS a, h.attore, h.motivazione
       FROM storico_stato h
       JOIN stato sd ON sd.codice = h.stato_da
       JOIN stato sa ON sa.codice = h.stato_a
      WHERE h.id_segnalazione = ?
      ORDER BY h.id`,
    [idSegnalazione],
  );

export const commenti = (idSegnalazione: number) =>
  db.righe<{ id: number; testo: string; data: Date; id_autore: number; autore: string }>(
    "SELECT id, testo, data, id_autore, autore FROM v_commento_pubblico WHERE id_segnalazione = ? ORDER BY data",
    [idSegnalazione],
  );

export const aggiornamenti = (idSegnalazione: number) =>
  db.righe<{ id: number; testo: string; data: Date }>(
    "SELECT id, testo, data FROM v_aggiornamento_pubblico WHERE id_segnalazione = ? ORDER BY data",
    [idSegnalazione],
  );

export async function relazioneUtente(idUtente: number, idSegnalazione: number) {
  const r = await db.riga<{ sostiene: number; segue: number }>(
    `SELECT EXISTS (SELECT 1 FROM sostegno WHERE id_utente = ? AND id_segnalazione = ?) AS sostiene,
            EXISTS (SELECT 1 FROM segue    WHERE id_utente = ? AND id_segnalazione = ?) AS segue`,
    [idUtente, idSegnalazione, idUtente, idSegnalazione],
  );
  return { sostiene: Boolean(r?.sostiene), segue: Boolean(r?.segue) };
}
