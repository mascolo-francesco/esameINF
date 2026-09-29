-- =============================================================================
-- Query principali della web app (parametri "?" -> query preparate, RNF-05).
-- Ogni query è preceduta da "-- name:" per poterla caricare da codice.
-- Operazioni di scrittura multiple: sempre in transazione, dopo
--   SET @lnc_id_utente = ?, @lnc_ip = ?;   (per l'audit)
-- =============================================================================


-- ============================================================ AUTENTICAZIONE

-- name: registra_utente  (RF-01)  -> poi crea_token tipo 'verifica_email'
INSERT INTO utente (nome, cognome, email, password_hash, data_nascita, telefono, nome_visualizzato,
                    consenso_privacy_il, consenso_notifiche, consenso_addestramento_ia, id_quartiere)
VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?);

-- name: crea_token  (RF-02, RF-05, RNF-03)  token_hash = SHA-256 del token inviato
INSERT INTO token_utente (id_utente, tipo, token_hash, scade_il, indirizzo_ip, user_agent)
VALUES (?, ?, ?, NOW() + INTERVAL ? MINUTE, ?, ?);

-- name: consuma_token  -> 1 riga aggiornata = token valido
UPDATE token_utente SET usato_il = NOW()
 WHERE token_hash = ? AND tipo = ? AND usato_il IS NULL AND revocato_il IS NULL AND scade_il > NOW();

-- name: utente_da_token
SELECT id_utente FROM token_utente WHERE token_hash = ? AND tipo = ?;

-- name: conferma_email  (RF-02)
UPDATE utente SET stato_account = 'attivo', email_verificata_il = NOW()
 WHERE id = ? AND stato_account = 'non_verificato';

-- name: utente_per_login  (RF-03)
SELECT u.id, u.password_hash, u.stato_account, u.totp_attivo, u.bloccato_fino_a, r.codice AS ruolo
  FROM utente u JOIN ruolo r ON r.id = u.id_ruolo
 WHERE LOWER(u.email) = LOWER(?);

-- name: registra_accesso  (RF-03, RNF-06, RNF-12)
INSERT INTO accesso_log (id_utente, email_tentata, indirizzo_ip, esito) VALUES (?, ?, ?, ?);

-- name: tentativi_falliti_recenti  (RF-03: se >= auth.max_tentativi -> blocca)
SELECT COUNT(*) AS n
  FROM accesso_log
 WHERE email_tentata = ? AND esito IN ('password_errata','totp_errato')
   AND data_ora >= NOW() - INTERVAL fn_param('auth.finestra_minuti') MINUTE;

-- name: blocca_account_temporaneamente
UPDATE utente SET bloccato_fino_a = NOW() + INTERVAL fn_param('auth.blocco_minuti') MINUTE WHERE id = ?;

-- name: login_riuscito
UPDATE utente SET ultimo_accesso = NOW(), tentativi_falliti = 0, bloccato_fino_a = NULL WHERE id = ?;

-- name: revoca_refresh_token  (logout, RNF-03)
UPDATE token_utente SET revocato_il = NOW() WHERE id_utente = ? AND tipo = 'refresh' AND revocato_il IS NULL;

-- name: puo_scrivere  (RD-14, RD-22: da verificare a ogni azione di scrittura)
SELECT fn_utente_puo_scrivere(?) AS puo_scrivere;

-- name: richiedi_cancellazione_account  (RF-08: anonimizzazione dal job notturno)
UPDATE utente SET stato_account = 'cancellato', cancellazione_richiesta_il = NOW() WHERE id = ?;

-- name: esporta_dati_utente  (RF-09, portabilità GDPR)
SELECT JSON_OBJECT(
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
 WHERE u.id = ?;


-- ============================================================ INSERIMENTO SEGNALAZIONE (UC-01)
-- Flusso in transazione:
--   1. crea_bozza  2. aggiungi_allegato (1..5)  3. aggiungi_classificazione (IA + utente)
--   4. CALL sp_cambia_stato(id, 'RICEVUTA', 'autore', id_utente, NULL, NULL)
-- Poi, fuori transazione, i moduli IA scrivono in analisi_ia e chiamano
--   CALL sp_cambia_stato(id, 'PUBBLICATA' | 'IN_REVISIONE' | 'RIFIUTATA', 'sistema', NULL, motivo, NULL)

-- name: quartiere_da_coordinate  (RF-14: da mostrare prima dell'invio; NULL = fuori Milano)
SELECT q.id, q.nome AS quartiere, m.id AS id_municipio, m.nome AS municipio
  FROM quartiere q JOIN municipio m ON m.id = q.id_municipio
 WHERE q.id = fn_quartiere_da_coordinate(?, ?);

-- name: segnalazioni_simili  (RF-16: entro il raggio e con una delle categorie scelte)
-- parametri: lon, lat, lon, lat, id_categoria (ripetere IN (...) per più categorie)
SELECT v.id, v.codice_pubblico, v.titolo, v.num_sostegni, v.miniatura,
       ROUND(ST_Distance_Sphere(s.posizione, ST_SRID(POINT(?, ?), 4326))) AS distanza_m
  FROM segnalazione s
  JOIN v_segnalazione_pubblica v ON v.id = s.id
 WHERE v.votabile
   AND ST_Distance_Sphere(s.posizione, ST_SRID(POINT(?, ?), 4326)) <= fn_param('segnalazione.raggio_duplicati_m')
   AND EXISTS (SELECT 1 FROM classificazione c
                WHERE c.id_segnalazione = s.id AND c.confermata AND c.id_categoria IN (?))
 ORDER BY distanza_m
 LIMIT 5;

-- name: crea_bozza
INSERT INTO segnalazione (titolo, descrizione, tipo, latitudine, longitudine, indirizzo, fonte_posizione, id_autore)
VALUES (?, ?, ?, ?, ?, ?, ?, ?);

-- name: aggiungi_allegato
INSERT INTO allegato (id_segnalazione, tipo, mime_type, dimensione_byte, durata_sec, larghezza, altezza,
                      percorso_originale, hash_sha256, hash_percettivo, exif_latitudine, exif_longitudine,
                      exif_altitudine, exif_data_scatto, exif_dispositivo, ordine)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);

-- name: allegato_elaborato  (RF-23, RF-24, RF-25: versione pubblica pronta)
UPDATE allegato SET percorso_pubblico = ?, percorso_miniatura = ?, stato_elaborazione = 'pronto' WHERE id = ?;

-- name: immagine_gia_presente  (RIA-15: stesso file già caricato su un'altra segnalazione)
SELECT a.id_segnalazione, s.codice_pubblico
  FROM allegato a JOIN segnalazione s ON s.id = a.id_segnalazione
 WHERE (a.hash_sha256 = ? OR a.hash_percettivo = ?) AND a.id_segnalazione <> ?
 LIMIT 5;

-- name: aggiungi_classificazione  (RIA-09, RIA-10)
INSERT INTO classificazione (id_segnalazione, id_categoria, origine, confidenza_ia, confermata)
VALUES (?, ?, ?, ?, ?) AS nuova
ON DUPLICATE KEY UPDATE confermata = nuova.confermata;

-- name: registra_analisi_ia  (RIA-02) — valorizzare uno solo tra i quattro id
INSERT INTO analisi_ia (modulo, versione_modello, esito, punteggio, dettagli, durata_ms,
                        id_segnalazione, id_allegato, id_commento, id_aggiornamento)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);

-- name: segna_foto_datata  (RIA-13)
UPDATE segnalazione SET foto_datata = TRUE WHERE id = ?;

-- name: distanza_exif_dichiarata  (RIA-13: oltre ia.exif.distanza_max_m -> revisione)
SELECT a.id, ROUND(ST_Distance_Sphere(s.posizione,
             ST_SRID(POINT(a.exif_longitudine, a.exif_latitudine), 4326))) AS distanza_m,
       a.exif_data_scatto < s.data_creazione - INTERVAL fn_param('ia.exif.giorni_foto_datata') DAY AS foto_datata
  FROM allegato a JOIN segnalazione s ON s.id = a.id_segnalazione
 WHERE a.id_segnalazione = ? AND a.exif_latitudine IS NOT NULL;

-- name: modifica_testo_segnalazione  (RF-19: il trigger rifiuta se non è più modificabile)
UPDATE segnalazione SET titolo = ?, descrizione = ?, tipo = ? WHERE id = ? AND id_autore = ?;

-- name: aggiungi_aggiornamento  (RF-19)
INSERT INTO aggiornamento (id_segnalazione, id_autore, testo) VALUES (?, ?, ?);

-- name: ritira_segnalazione  (RF-20)
CALL sp_cambia_stato(?, 'RITIRATA', 'autore', ?, NULL, NULL);

-- name: mie_segnalazioni
SELECT s.id, s.codice_pubblico, s.titolo, s.stato_corrente, st.nome AS stato, s.data_creazione,
       s.data_invio, s.num_sostegni, s.punteggio_priorita
  FROM segnalazione s JOIN stato st ON st.codice = s.stato_corrente
 WHERE s.id_autore = ?
 ORDER BY s.data_creazione DESC;


-- ============================================================ CONSULTAZIONE (UC-04)

-- name: marker_mappa  (RF-38, RNF-18: solo l'area visibile, usa l'indice spaziale)
-- parametri: sud, ovest, nord, ovest, nord, est, sud, est, sud, ovest  (poligono WKT lat lon)
SELECT s.id, s.codice_pubblico, s.titolo, s.latitudine, s.longitudine, s.num_sostegni, s.stato_corrente,
       (SELECT k.colore_mappa FROM classificazione c JOIN categoria k ON k.id = c.id_categoria
         WHERE c.id_segnalazione = s.id AND c.confermata ORDER BY c.confidenza_ia DESC, k.ordine LIMIT 1) AS colore
  FROM segnalazione s
  JOIN stato st ON st.codice = s.stato_corrente AND st.pubblico AND s.stato_corrente <> 'UNITA'
 WHERE MBRContains(ST_GeomFromText(CONCAT('POLYGON((', ?, ' ', ?, ',', ?, ' ', ?, ',', ?, ' ', ?, ',',
                                          ?, ' ', ?, ',', ?, ' ', ?, '))'), 4326), s.posizione)
 LIMIT 2000;

-- name: heatmap  (RF-39: densità su griglia di ~500 m; peso = sostegni + 1)
SELECT ROUND(latitudine / 0.0045) * 0.0045 AS lat, ROUND(longitudine / 0.0064) * 0.0064 AS lon,
       COUNT(*) AS segnalazioni, SUM(num_sostegni) + COUNT(*) AS peso
  FROM segnalazione s JOIN stato st ON st.codice = s.stato_corrente AND st.in_classifica
 GROUP BY 1, 2;

-- name: classifica  (RF-35, RF-36) — filtri facoltativi: passare NULL per ignorarli
-- parametri: id_categoria, id_categoria, id_municipio, id_municipio, id_quartiere, id_quartiere,
--            tipo, tipo, stato, stato, dal, dal, al, al, ordinamento ('sostenute'|'tendenza'), limit, offset
SELECT v.id, v.codice_pubblico, v.titolo, v.tipo, v.stato, v.quartiere, v.municipio, v.categorie,
       v.colore_mappa, v.miniatura, v.num_sostegni, v.punteggio_priorita, v.punteggio_tendenza, v.data_pubblicazione
  FROM v_classifica v
 WHERE (? IS NULL OR EXISTS (SELECT 1 FROM classificazione c
                              WHERE c.id_segnalazione = v.id AND c.confermata AND c.id_categoria = ?))
   AND (? IS NULL OR v.id_municipio = ?)
   AND (? IS NULL OR v.id_quartiere = ?)
   AND (? IS NULL OR v.tipo = ?)
   AND (? IS NULL OR v.stato_corrente = ?)
   AND (? IS NULL OR v.data_pubblicazione >= ?)
   AND (? IS NULL OR v.data_pubblicazione < ?)
 ORDER BY CASE WHEN ? = 'tendenza' THEN v.punteggio_tendenza ELSE v.punteggio_priorita END DESC,
          v.num_sostegni DESC, v.data_pubblicazione DESC
 LIMIT ? OFFSET ?;

-- name: ricerca_testuale  (RF-40) — stessi filtri della classifica applicabili come sopra
SELECT v.id, v.codice_pubblico, v.titolo, v.stato, v.quartiere, v.categorie, v.num_sostegni,
       MATCH (s.titolo, s.descrizione) AGAINST (? IN NATURAL LANGUAGE MODE) AS rilevanza
  FROM segnalazione s JOIN v_segnalazione_pubblica v ON v.id = s.id
 WHERE MATCH (s.titolo, s.descrizione) AGAINST (? IN NATURAL LANGUAGE MODE)
 ORDER BY rilevanza DESC
 LIMIT 50;

-- name: dettaglio_segnalazione  (RF-41: anche per l'anteprima Open Graph)
SELECT * FROM v_segnalazione_pubblica WHERE codice_pubblico = ?;

-- name: allegati_segnalazione
SELECT id, tipo, mime_type, durata_sec, larghezza, altezza, percorso_pubblico, percorso_miniatura
  FROM v_allegato_pubblico WHERE id_segnalazione = ? ORDER BY ordine;

-- name: timeline_segnalazione  (RF-28)
SELECT data_ora, stato_da_nome, stato_a_nome, attore, motivazione
  FROM v_timeline_pubblica WHERE id_segnalazione = ? ORDER BY id;

-- name: commenti_segnalazione
SELECT id, testo, data, autore FROM v_commento_pubblico WHERE id_segnalazione = ? ORDER BY data;

-- name: aggiornamenti_segnalazione
SELECT id, testo, data FROM v_aggiornamento_pubblico WHERE id_segnalazione = ? ORDER BY data;

-- name: stato_utente_su_segnalazione  (per i pulsanti "Sostieni" / "Segui")
SELECT EXISTS (SELECT 1 FROM sostegno WHERE id_utente = ? AND id_segnalazione = ?) AS sostiene,
       EXISTS (SELECT 1 FROM segue    WHERE id_utente = ? AND id_segnalazione = ?) AS segue;


-- ============================================================ COMMUNITY (UC-03, UC-05)

-- name: sostieni  (RF-31; RD-05/06/07 garantiti dal DB)
INSERT INTO sostegno (id_utente, id_segnalazione, indirizzo_ip) VALUES (?, ?, ?);

-- name: ritira_sostegno  (RF-31)
DELETE FROM sostegno WHERE id_utente = ? AND id_segnalazione = ?;

-- name: segui / smetti_di_seguire  (RF-37)
INSERT IGNORE INTO segue (id_utente, id_segnalazione) VALUES (?, ?);
DELETE FROM segue WHERE id_utente = ? AND id_segnalazione = ?;

-- name: commenta  (RF-33) — nasce in_revisione; dopo il filtro IA:
INSERT INTO commento (id_segnalazione, id_autore, testo) VALUES (?, ?, ?);
-- name: esito_moderazione_commento  ('visibile' se sotto soglia, altrimenti resta in_revisione)
UPDATE commento SET stato = ? WHERE id = ?;

-- name: segnala_abuso  (RF-34) — valorizzare uno solo tra segnalazione, commento, aggiornamento
INSERT INTO segnalazione_abuso (id_segnalante, id_segnalazione, id_commento, id_aggiornamento, motivo, nota)
VALUES (?, ?, ?, ?, ?, ?);

-- name: notifiche_non_lette  (RF-29)
SELECT n.id, n.tipo, n.testo, n.data, s.codice_pubblico
  FROM notifica n LEFT JOIN segnalazione s ON s.id = n.id_segnalazione
 WHERE n.id_utente = ? AND NOT n.letta
 ORDER BY n.data DESC LIMIT 50;

-- name: segna_notifiche_lette
UPDATE notifica SET letta = TRUE WHERE id_utente = ? AND NOT letta;

-- name: notifiche_da_inviare_email  (worker email, RF-29)
SELECT n.id, u.email, n.testo
  FROM notifica n JOIN utente u ON u.id = n.id_utente
 WHERE n.email_inviata_il IS NULL AND u.notifiche_email AND u.consenso_notifiche
   AND u.stato_account IN ('attivo','sospeso') AND n.data >= NOW() - INTERVAL 2 DAY
 ORDER BY n.id LIMIT 200;


-- ============================================================ MODERAZIONE (UC-06..UC-09)

-- name: coda_moderazione  (RF-42)
SELECT * FROM v_coda_moderazione ORDER BY gravita DESC, data_ingresso LIMIT 100;

-- name: analisi_ia_segnalazione  (motivo e confidenza da mostrare al moderatore)
SELECT a.modulo, a.versione_modello, a.esito, a.punteggio, a.dettagli, a.data, a.id_allegato
  FROM analisi_ia a LEFT JOIN allegato al ON al.id = a.id_allegato
 WHERE a.id_segnalazione = ? OR al.id_segnalazione = ?
 ORDER BY a.data;

-- name: decisione_moderatore  (RF-43: 'PUBBLICATA' | 'DA_INTEGRARE' | 'RIFIUTATA' | 'PRESA_IN_CARICO' | 'ARCHIVIATA'->'PUBBLICATA')
CALL sp_cambia_stato(?, ?, 'moderatore', ?, ?, NULL);

-- name: unisci_duplicato  (RF-30)
CALL sp_cambia_stato(?, 'UNITA', 'moderatore', ?, NULL, ?);

-- name: correggi_posizione  (RF-43; il trigger ricalcola il quartiere e scrive l'audit)
UPDATE segnalazione SET latitudine = ?, longitudine = ?, indirizzo = ? WHERE id = ?;

-- name: correggi_categoria  (RF-43, RIA-10)
INSERT INTO classificazione (id_segnalazione, id_categoria, origine, confermata)
VALUES (?, ?, 'moderatore', TRUE)
ON DUPLICATE KEY UPDATE origine = 'moderatore', confermata = TRUE;
UPDATE classificazione SET confermata = FALSE WHERE id_segnalazione = ? AND id_categoria = ?;

-- name: chiudi_abusi  (esito 'accolta' | 'respinta')
UPDATE segnalazione_abuso SET esito = ?, id_moderatore = ?
 WHERE esito = 'aperta' AND (id_segnalazione = ? OR id_commento = ? OR id_aggiornamento = ?);

-- name: rifiuti_automatici_da_riesaminare  (RIA-06: rifiuti dell'IA degli ultimi 30 giorni)
SELECT s.id, s.codice_pubblico, s.titolo, h.data_ora, h.motivazione
  FROM segnalazione s
  JOIN storico_stato h ON h.id_segnalazione = s.id AND h.stato_a = 'RIFIUTATA' AND h.attore = 'sistema'
 WHERE s.stato_corrente = 'RIFIUTATA' AND h.data_ora >= NOW() - INTERVAL 30 DAY
 ORDER BY h.data_ora DESC;

-- name: sospendi_o_banna  (RF-44) — data_fine NULL per il ban
INSERT INTO provvedimento (tipo, motivazione, data_fine, id_destinatario, id_moderatore) VALUES (?, ?, ?, ?, ?);

-- name: revoca_provvedimento  (RF-44, solo amministratore)
UPDATE provvedimento SET revocato_il = NOW(), id_revocato_da = ?, motivazione_revoca = ? WHERE id = ?;

-- name: sostegni_sospetti  (rischio 9.3: molti account che sostengono dallo stesso IP)
SELECT so.indirizzo_ip, COUNT(DISTINCT so.id_utente) AS utenti, COUNT(*) AS sostegni,
       GROUP_CONCAT(DISTINCT s.codice_pubblico) AS segnalazioni
  FROM sostegno so JOIN segnalazione s ON s.id = so.id_segnalazione
 WHERE so.indirizzo_ip IS NOT NULL AND so.data >= NOW() - INTERVAL 7 DAY
 GROUP BY so.indirizzo_ip
HAVING COUNT(DISTINCT so.id_utente) >= 5
 ORDER BY utenti DESC;

-- name: cambia_ruolo  (RF-45; il trigger impone il 2FA per moderatori e amministratori)
UPDATE utente SET id_ruolo = ? WHERE id = ?;

-- name: modifica_parametro  (RF-45; se cambia un peso della formula: CALL sp_ricalcola_tutti_punteggi())
UPDATE parametro_sistema SET valore = ? WHERE chiave = ?;

-- name: registro_audit  (RF-46)
SELECT a.data_ora, a.azione, a.tipo_oggetto, a.id_oggetto, a.valori_prima, a.valori_dopo, a.indirizzo_ip,
       u.nome_visualizzato AS utente
  FROM audit_log a LEFT JOIN utente u ON u.id = a.id_utente
 ORDER BY a.id DESC LIMIT ? OFFSET ?;


-- ============================================================ DOCUMENTO PROGRAMMATICO (UC-10)

-- name: crea_documento
INSERT INTO documento_programmatico (titolo, versione, introduzione, id_amministratore) VALUES (?, ?, ?, ?);

-- name: includi_segnalazione  (RD-21)
INSERT INTO documento_segnalazione (id_documento, id_segnalazione, posizione, nota_comitato) VALUES (?, ?, ?, ?);

-- name: rendi_definitivo
UPDATE documento_programmatico SET stato = 'definitivo', percorso_pdf = ?, percorso_csv = ? WHERE id = ? AND stato = 'bozza';

-- name: invia_documento  (RF-48: a tutti i candidati attivi, in transazione)
CALL sp_invia_documento(?, ?);

-- name: esporta_documento_csv  (RF-48)
SELECT ds.posizione, s.codice_pubblico, s.titolo, s.descrizione, s.tipo, v.categorie,
       v.quartiere, v.municipio, s.latitudine, s.longitudine, s.num_sostegni, s.punteggio_priorita,
       ds.nota_comitato
  FROM documento_segnalazione ds
  JOIN segnalazione s ON s.id = ds.id_segnalazione
  JOIN v_segnalazione_pubblica v ON v.id = s.id
 WHERE ds.id_documento = ?
 ORDER BY ds.posizione;


-- ============================================================ DASHBOARD (RF-47)

-- name: dashboard
SELECT * FROM v_dash_per_stato ORDER BY ordine;
SELECT * FROM v_dash_per_categoria ORDER BY segnalazioni DESC;
SELECT * FROM v_dash_per_municipio ORDER BY id;
SELECT * FROM v_dash_utenti;
SELECT * FROM v_dash_moderazione;
SELECT * FROM v_dash_esiti_ia;
SELECT * FROM v_dash_moduli_ia ORDER BY modulo, esito;
