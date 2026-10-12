import { db } from "@/lib/server/db";
import { utenteCorrente } from "@/lib/server/auth/sessione";

// RF-09: copia dei propri dati in JSON (query esporta_dati_utente)
export async function GET() {
  const u = await utenteCorrente();
  if (!u) return new Response("Accesso richiesto", { status: 401 });
  const r = await db.riga<{ dati: unknown }>(
    `SELECT JSON_OBJECT(
       'profilo', JSON_OBJECT('nome', u.nome, 'cognome', u.cognome, 'email', u.email,
                              'data_nascita', u.data_nascita, 'telefono', u.telefono,
                              'nome_visualizzato', u.nome_visualizzato, 'quartiere', q.nome,
                              'data_registrazione', u.data_registrazione),
       'segnalazioni', (SELECT JSON_ARRAYAGG(JSON_OBJECT('codice', s.codice_pubblico, 'titolo', s.titolo,
                               'descrizione', s.descrizione, 'stato', s.stato_corrente, 'data_invio', s.data_invio))
                          FROM segnalazione s WHERE s.id_autore = u.id),
       'sostegni', (SELECT JSON_ARRAYAGG(JSON_OBJECT('codice', s.codice_pubblico, 'data', so.data))
                      FROM sostegno so JOIN segnalazione s ON s.id = so.id_segnalazione WHERE so.id_utente = u.id),
       'commenti', (SELECT JSON_ARRAYAGG(JSON_OBJECT('segnalazione', s.codice_pubblico, 'testo', c.testo, 'data', c.data))
                      FROM commento c JOIN segnalazione s ON s.id = c.id_segnalazione WHERE c.id_autore = u.id)
     ) AS dati
       FROM utente u LEFT JOIN quartiere q ON q.id = u.id_quartiere
      WHERE u.id = ?`,
    [u.id],
  );
  return new Response(JSON.stringify(r?.dati ?? {}, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="i-miei-dati.json"',
      "Cache-Control": "no-store",
    },
  });
}
