-- =============================================================================
-- Test dei vincoli e del ciclo di vita. Tutto avviene in una transazione che
-- termina con ROLLBACK: il database resta invariato.
-- Eseguire con:  db/test/esegui_test.sh
-- Le righe "OK" / "ATTESO ERRORE" guidano la lettura dell'output.
-- =============================================================================
SET NAMES utf8mb4;
SET @lnc_id_utente = NULL, @lnc_ip = '127.0.0.1';
START TRANSACTION;

SET @q1 = (SELECT id FROM quartiere WHERE nome = 'DUOMO');     -- Municipio 1
SET @q1b = (SELECT id FROM quartiere WHERE nome = 'BRERA');    -- Municipio 1
SET @q9 = (SELECT id FROM quartiere WHERE nome = 'BICOCCA');   -- Municipio 9

-- ---------------------------------------------------------------- utenti
INSERT INTO utente (nome, cognome, email, password_hash, data_nascita, nome_visualizzato,
                    stato_account, email_verificata_il, consenso_privacy_il, id_quartiere) VALUES
  ('Anna',  'Rossi',   'anna@test.it',  'h', '2000-01-01', 'anna',  'attivo', NOW(), NOW(), @q1),
  ('Bruno', 'Bianchi', 'bruno@test.it', 'h', '1990-05-05', 'bruno', 'attivo', NOW(), NOW(), @q1b),
  ('Carla', 'Verdi',   'carla@test.it', 'h', '1985-03-03', 'carla', 'attivo', NOW(), NOW(), @q9),
  ('Dario', 'Neri',    'dario@test.it', 'h', '2004-07-07', 'dario', 'attivo', NOW(), NOW(), @q9);
SET @A = (SELECT id FROM utente WHERE email = 'anna@test.it');
SET @B = (SELECT id FROM utente WHERE email = 'bruno@test.it');
SET @C = (SELECT id FROM utente WHERE email = 'carla@test.it');
SET @D = (SELECT id FROM utente WHERE email = 'dario@test.it');
INSERT INTO utente (nome, cognome, email, password_hash, data_nascita, nome_visualizzato, stato_account,
                    email_verificata_il, consenso_privacy_il, id_quartiere, id_ruolo, totp_attivo, totp_segreto) VALUES
  ('Marta', 'Moderatrice', 'mod@test.it',   'h', '1980-01-01', 'mod',   'attivo', NOW(), NOW(), @q1, 2, TRUE, x'01'),
  ('Ugo',   'Admin',       'admin@test.it', 'h', '1975-01-01', 'admin', 'attivo', NOW(), NOW(), @q1, 3, TRUE, x'01');
SET @M = (SELECT id FROM utente WHERE email = 'mod@test.it');
SET @X = (SELECT id FROM utente WHERE email = 'admin@test.it');
SELECT 'OK utenti creati' AS test;

SELECT 'ATTESO ERRORE RD-01 email duplicata (maiuscole)' AS test;
INSERT INTO utente (nome, cognome, email, data_nascita, nome_visualizzato, consenso_privacy_il, id_quartiere)
VALUES ('X', 'Y', 'ANNA@test.it', '2000-01-01', 'x', NOW(), @q1);
SELECT 'ATTESO ERRORE RD-02 meno di 14 anni' AS test;
INSERT INTO utente (nome, cognome, email, data_nascita, nome_visualizzato, consenso_privacy_il, id_quartiere)
VALUES ('X', 'Y', 'bimbo@test.it', CURDATE() - INTERVAL 10 YEAR, 'x', NOW(), @q1);
SELECT 'ATTESO ERRORE RF-10 moderatore senza 2FA' AS test;
UPDATE utente SET id_ruolo = 2 WHERE id = @A;

-- ---------------------------------------------------------------- segnalazione S1
SELECT 'ATTESO ERRORE RD-04 punto fuori Milano (Sesto San Giovanni)' AS test;
INSERT INTO segnalazione (titolo, descrizione, latitudine, longitudine, fonte_posizione, id_autore)
VALUES ('Buca enorme in strada', 'Descrizione sufficientemente lunga del problema', 45.5350, 9.2350, 'gps', @A);
SELECT 'ATTESO ERRORE RD-04 fuori dal riquadro (Roma)' AS test;
INSERT INTO segnalazione (titolo, descrizione, latitudine, longitudine, fonte_posizione, id_autore)
VALUES ('Buca enorme in strada', 'Descrizione sufficientemente lunga del problema', 41.9, 12.5, 'gps', @A);

INSERT INTO segnalazione (titolo, descrizione, tipo, latitudine, longitudine, indirizzo, fonte_posizione, id_autore)
VALUES ('Graffiti sulla facciata del Duomo', 'Scritte con vernice spray sul lato nord, ben visibili dalla piazza',
        'problema', 45.464200, 9.191900, 'Piazza del Duomo', 'exif', @A);
SET @S1 = LAST_INSERT_ID();
SELECT 'OK S1 in bozza, codice e quartiere calcolati' AS test, codice_pubblico, stato_corrente, q.nome AS quartiere
  FROM segnalazione s JOIN quartiere q ON q.id = s.id_quartiere WHERE s.id = @S1;

SELECT 'ATTESO ERRORE RD-03 invio senza allegati' AS test;
CALL sp_cambia_stato(@S1, 'RICEVUTA', 'autore', @A, NULL, NULL);

INSERT INTO allegato (id_segnalazione, tipo, mime_type, dimensione_byte, percorso_originale, hash_sha256, ordine,
                      exif_latitudine, exif_longitudine, exif_data_scatto)
VALUES (@S1, 'foto', 'image/jpeg', 2000000, 'privato/s1/1.jpg', SHA2('foto1', 256), 1, 45.4641, 9.1918, NOW() - INTERVAL 1 DAY);
SET @AL1 = LAST_INSERT_ID();
INSERT INTO file_allegato (id_allegato, variante, mime_type, dimensione, dati)
VALUES (@AL1, 'originale', 'image/jpeg', 4, x'FFD8FFE0'), (@AL1, 'miniatura', 'image/webp', 4, x'52494646');
SELECT 'OK file_allegato: due varianti salvate' AS test, COUNT(*) AS varianti FROM file_allegato WHERE id_allegato = @AL1;
SELECT 'ATTESO ERRORE file_allegato variante duplicata' AS test;
INSERT INTO file_allegato (id_allegato, variante, mime_type, dimensione, dati) VALUES (@AL1, 'originale', 'image/jpeg', 1, x'00');
SELECT 'ATTESO ERRORE file_allegato formato non ammesso' AS test;
INSERT INTO file_allegato (id_allegato, variante, mime_type, dimensione, dati) VALUES (@AL1, 'pubblica', 'image/gif', 1, x'00');
SELECT 'ATTESO ERRORE file_allegato dimensione diversa dai dati' AS test;
INSERT INTO file_allegato (id_allegato, variante, mime_type, dimensione, dati) VALUES (@AL1, 'pubblica', 'image/jpeg', 99, x'00');
SELECT 'ATTESO ERRORE RF-21 video oltre 60 secondi' AS test;
INSERT INTO allegato (id_segnalazione, tipo, mime_type, dimensione_byte, durata_sec, percorso_originale, hash_sha256, ordine)
VALUES (@S1, 'video', 'video/mp4', 1000000, 75, 'privato/s1/2.mp4', SHA2('video', 256), 2);

SET @k_decoro = (SELECT id FROM categoria WHERE nome = 'Decoro urbano');
SET @k_verde  = (SELECT id FROM categoria WHERE nome = 'Ambiente e verde');
INSERT INTO classificazione (id_segnalazione, id_categoria, origine, confidenza_ia, confermata)
VALUES (@S1, @k_decoro, 'ia', 0.87, TRUE), (@S1, @k_verde, 'ia', 0.21, FALSE);

CALL sp_cambia_stato(@S1, 'RICEVUTA', 'autore', @A, NULL, NULL);
INSERT INTO analisi_ia (modulo, versione_modello, esito, punteggio, dettagli, durata_ms, id_segnalazione)
VALUES ('moderazione', 'test-1', 'ok', 0.05, JSON_OBJECT('insulto', 0.05), 120, @S1);

SELECT 'ATTESO ERRORE RD-09 cambio di stato senza storico' AS test;
UPDATE segnalazione SET stato_corrente = 'PUBBLICATA' WHERE id = @S1;
SELECT 'ATTESO ERRORE RD-11 rifiuto senza motivazione' AS test;
CALL sp_cambia_stato(@S1, 'RIFIUTATA', 'sistema', NULL, '  ', NULL);
SELECT 'ATTESO ERRORE RD-10 il cittadino non può pubblicare' AS test;
CALL sp_cambia_stato(@S1, 'PUBBLICATA', 'moderatore', @B, NULL, NULL);

CALL sp_cambia_stato(@S1, 'PUBBLICATA', 'sistema', NULL, NULL, NULL);
SELECT 'OK S1 pubblicata' AS test, stato_corrente, data_invio IS NOT NULL AS inviata, data_pubblicazione IS NOT NULL AS pubblicata
  FROM segnalazione WHERE id = @S1;

SELECT 'ATTESO ERRORE RF-19 titolo modificato dopo la pubblicazione' AS test;
UPDATE segnalazione SET titolo = 'Titolo cambiato dopo' WHERE id = @S1;
SELECT 'ATTESO ERRORE RD-08 tolta l''unica categoria confermata' AS test;
UPDATE classificazione SET confermata = FALSE WHERE id_segnalazione = @S1 AND id_categoria = @k_decoro;
SELECT 'ATTESO ERRORE RD-17 cancellazione di una segnalazione inviata' AS test;
DELETE FROM segnalazione WHERE id = @S1;

-- ---------------------------------------------------------------- sostegni e punteggio
SELECT 'ATTESO ERRORE RD-06 l''autore sostiene la propria' AS test;
INSERT INTO sostegno (id_utente, id_segnalazione) VALUES (@A, @S1);
INSERT INTO sostegno (id_utente, id_segnalazione) VALUES (@B, @S1), (@C, @S1);
SELECT 'ATTESO ERRORE RD-05 doppio sostegno' AS test;
INSERT INTO sostegno (id_utente, id_segnalazione) VALUES (@B, @S1);
INSERT INTO commento (id_segnalazione, id_autore, testo) VALUES (@S1, @B, 'Confermo, passo di lì ogni giorno');
UPDATE commento SET stato = 'visibile' WHERE id = LAST_INSERT_ID();
SELECT 'OK punteggio: atteso 2 sostegni, P = 1,5 + 1 + 0,3 = 2,80' AS test,
       num_sostegni, num_commentatori, punteggio_priorita FROM segnalazione WHERE id = @S1;

-- ---------------------------------------------------------------- abusi (soglia 3)
INSERT INTO segnalazione_abuso (id_segnalante, id_segnalazione, motivo) VALUES (@B, @S1, 'falso'), (@C, @S1, 'falso');
SELECT 'OK 2 abusi: ancora pubblicata' AS test, stato_corrente FROM segnalazione WHERE id = @S1;
INSERT INTO segnalazione_abuso (id_segnalante, id_segnalazione, motivo) VALUES (@D, @S1, 'falso');
SELECT 'OK 3 abusi: in revisione automatica' AS test, stato_corrente FROM segnalazione WHERE id = @S1;
SELECT 'OK coda moderazione' AS test, tipo_contenuto, codice_pubblico, stato, abusi_aperti, gravita, motivo FROM v_coda_moderazione;
SET @lnc_id_utente = @M;
UPDATE segnalazione_abuso SET esito = 'respinta', id_moderatore = @M WHERE id_segnalazione = @S1;
CALL sp_cambia_stato(@S1, 'PUBBLICATA', 'moderatore', @M, NULL, NULL);
SET @lnc_id_utente = NULL;
SELECT 'OK moderatore ripubblica' AS test, stato_corrente, num_sostegni FROM segnalazione WHERE id = @S1;

-- ---------------------------------------------------------------- duplicati (RF-16, RF-30)
INSERT INTO segnalazione (titolo, descrizione, latitudine, longitudine, fonte_posizione, id_autore)
VALUES ('Scritte spray in piazza Duomo', 'Graffiti appena comparsi vicino all''ingresso laterale della cattedrale',
        45.464400, 9.191500, 'gps', @C);
SET @S2 = LAST_INSERT_ID();
INSERT INTO allegato (id_segnalazione, tipo, mime_type, dimensione_byte, percorso_originale, hash_sha256, ordine)
VALUES (@S2, 'foto', 'image/webp', 500000, 'privato/s2/1.webp', SHA2('foto2', 256), 1);
INSERT INTO classificazione (id_segnalazione, id_categoria, origine, confermata) VALUES (@S2, @k_decoro, 'utente', TRUE);
SELECT 'OK RF-16 segnalazioni simili entro 200 m, stessa categoria' AS test, s.codice_pubblico,
       ROUND(ST_Distance_Sphere(s.posizione, ST_SRID(POINT(9.191500, 45.464400), 4326))) AS metri
  FROM segnalazione s JOIN stato st ON st.codice = s.stato_corrente AND st.votabile
 WHERE ST_Distance_Sphere(s.posizione, ST_SRID(POINT(9.191500, 45.464400), 4326)) <= fn_param('segnalazione.raggio_duplicati_m')
   AND EXISTS (SELECT 1 FROM classificazione c WHERE c.id_segnalazione = s.id AND c.confermata AND c.id_categoria = @k_decoro);
CALL sp_cambia_stato(@S2, 'RICEVUTA', 'autore', @C, NULL, NULL);
CALL sp_cambia_stato(@S2, 'PUBBLICATA', 'sistema', NULL, NULL, NULL);
INSERT INTO sostegno (id_utente, id_segnalazione) VALUES (@D, @S2), (@B, @S2);
SELECT 'ATTESO ERRORE RD-12 unione con sé stessa' AS test;
CALL sp_cambia_stato(@S2, 'UNITA', 'moderatore', @M, NULL, @S2);
CALL sp_cambia_stato(@S2, 'UNITA', 'moderatore', @M, NULL, @S1);
SELECT 'OK unione: S1 guadagna solo Dario (Bruno e Carla c''erano già)' AS test,
       (SELECT num_sostegni FROM segnalazione WHERE id = @S1) AS sostegni_s1,
       (SELECT num_sostegni FROM segnalazione WHERE id = @S2) AS sostegni_s2,
       (SELECT codice_principale FROM v_segnalazione_pubblica WHERE id = @S2) AS rimando;

-- ---------------------------------------------------------------- provvedimenti (RF-44)
INSERT INTO provvedimento (tipo, motivazione, data_fine, id_destinatario, id_moderatore)
VALUES ('sospensione', 'Linguaggio offensivo reiterato', NOW() + INTERVAL 7 DAY, @D, @M);
SET @P = LAST_INSERT_ID();
SELECT 'OK Dario sospeso' AS test, stato_account, fn_utente_puo_scrivere(id) AS puo_scrivere FROM utente WHERE id = @D;
SELECT 'ATTESO ERRORE RD-22 utente sospeso commenta' AS test;
INSERT INTO commento (id_segnalazione, id_autore, testo) VALUES (@S1, @D, 'Commento durante la sospensione');
SELECT 'ATTESO ERRORE RF-44 il moderatore sanziona l''amministratore' AS test;
INSERT INTO provvedimento (tipo, motivazione, id_destinatario, id_moderatore) VALUES ('ban', 'x', @X, @M);
SELECT 'ATTESO ERRORE RF-44 revoca da parte del moderatore' AS test;
UPDATE provvedimento SET revocato_il = NOW(), id_revocato_da = @M WHERE id = @P;
UPDATE provvedimento SET revocato_il = NOW(), id_revocato_da = @X, motivazione_revoca = 'Errore di valutazione' WHERE id = @P;
SELECT 'OK revoca dell''amministratore' AS test, stato_account FROM utente WHERE id = @D;

-- ---------------------------------------------------------------- documento programmatico (RF-48, RD-21)
CALL sp_cambia_stato(@S1, 'PRESA_IN_CARICO', 'moderatore', @M, NULL, NULL);
INSERT INTO documento_programmatico (titolo, id_amministratore) VALUES ('Priorità dei quartieri 2027', @X);
SET @DOC = LAST_INSERT_ID();
INSERT INTO documento_segnalazione (id_documento, id_segnalazione, posizione, nota_comitato) VALUES (@DOC, @S1, 1, 'Priorità per il centro');
INSERT INTO candidato (nome, cognome, lista_coalizione, email_contatto) VALUES
  ('Mario', 'Uno', 'Lista A', 'a@candidati.test'), ('Lucia', 'Due', 'Lista B', 'b@candidati.test');
SELECT 'ATTESO ERRORE RF-48 invio di un documento in bozza' AS test;
CALL sp_invia_documento(@DOC, @X);
UPDATE documento_programmatico SET stato = 'definitivo' WHERE id = @DOC;
CALL sp_invia_documento(@DOC, @X);
SELECT 'OK documento inviato a tutti i candidati' AS test, d.stato, (SELECT COUNT(*) FROM invio_documento WHERE id_documento = @DOC) AS invii,
       (SELECT stato_corrente FROM segnalazione WHERE id = @S1) AS stato_s1
  FROM documento_programmatico d WHERE d.id = @DOC;
SELECT 'ATTESO ERRORE RF-31 ritiro sostegno dopo l''invio' AS test;
DELETE FROM sostegno WHERE id_utente = @B AND id_segnalazione = @S1;
SELECT 'ATTESO ERRORE RF-48 documento inviato immutabile' AS test;
UPDATE documento_programmatico SET titolo = 'Altro' WHERE id = @DOC;

-- ---------------------------------------------------------------- registri in sola aggiunta (RD-19)
SELECT 'ATTESO ERRORE RD-19 modifica dello storico' AS test;
UPDATE storico_stato SET motivazione = 'x' WHERE id_segnalazione = @S1;
SELECT 'ATTESO ERRORE RD-19 cancellazione audit' AS test;
DELETE FROM audit_log;

-- ---------------------------------------------------------------- viste
SELECT 'OK timeline S1' AS test, stato_da_nome, stato_a_nome, attore FROM v_timeline_pubblica WHERE id_segnalazione = @S1 ORDER BY id;
SELECT 'OK classifica' AS test, posizione, codice_pubblico, stato, autore, quartiere, municipio, categorie, colore_mappa,
       num_sostegni, punteggio_priorita, punteggio_tendenza FROM v_classifica;
SELECT 'OK dashboard esiti IA' AS test, esito, segnalazioni, percentuale FROM v_dash_esiti_ia;
SELECT 'OK dashboard moderazione' AS test, revisioni_concluse, in_attesa FROM v_dash_moderazione;
SELECT 'OK audit' AS test, azione, tipo_oggetto, COUNT(*) AS n FROM audit_log GROUP BY azione, tipo_oggetto;

-- ---------------------------------------------------------------- GDPR (RF-08)
CALL sp_anonimizza_utente(@C);
SELECT 'OK anonimizzazione: segnalazioni restano, autore rimosso' AS test, u.email, u.nome, v.autore
  FROM utente u JOIN v_segnalazione_pubblica v ON v.id_autore = u.id WHERE u.id = @C;

ROLLBACK;
SELECT 'FINE: rollback eseguito' AS test,
       (SELECT COUNT(*) FROM utente) AS utenti, (SELECT COUNT(*) FROM segnalazione) AS segnalazioni,
       (SELECT COUNT(*) FROM audit_log) AS audit, (SELECT COUNT(*) FROM sequenza_codice) AS sequenze;
