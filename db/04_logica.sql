-- =============================================================================
-- Logica nel database: funzioni, procedure e trigger.
-- Implementa i vincoli RD che un CHECK non può esprimere e il ciclo di vita (sez. 4).
--
-- Variabili di sessione impostate dall'applicazione a inizio transazione:
--   @lnc_id_utente  id dell'utente che agisce (per audit_log)
--   @lnc_ip         indirizzo IP della richiesta (per audit_log)
-- Variabile interna (non usarla dall'app):
--   @lnc_sistema    1 durante le operazioni di sistema (trasferimento sostegni)
--
-- Il file si può rieseguire: elimina e ricrea solo oggetti di logica, mai dati.
-- =============================================================================

SET NAMES utf8mb4;

DELIMITER $$

-- -----------------------------------------------------------------------------
-- Funzioni
-- -----------------------------------------------------------------------------

DROP FUNCTION IF EXISTS fn_param $$
CREATE FUNCTION fn_param(p_chiave VARCHAR(60)) RETURNS DECIMAL(12,4)
  READS SQL DATA
BEGIN
  DECLARE v DECIMAL(12,4) DEFAULT NULL;
  DECLARE v_msg VARCHAR(128);
  SELECT valore INTO v FROM parametro_sistema WHERE chiave = p_chiave;
  IF v IS NULL THEN
    SET v_msg = CONCAT('Parametro mancante: ', p_chiave);
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = v_msg;
  END IF;
  RETURN v;
END $$

-- RF-14 / RD-04: NIL che contiene il punto, NULL se fuori dal Comune di Milano
DROP FUNCTION IF EXISTS fn_quartiere_da_coordinate $$
CREATE FUNCTION fn_quartiere_da_coordinate(p_lat DECIMAL(9,6), p_lon DECIMAL(9,6)) RETURNS SMALLINT UNSIGNED
  READS SQL DATA
BEGIN
  DECLARE v SMALLINT UNSIGNED DEFAULT NULL;
  DECLARE p GEOMETRY;
  IF p_lat IS NULL OR p_lon IS NULL THEN
    RETURN NULL;
  END IF;
  SET p = ST_SRID(POINT(p_lon, p_lat), 4326);
  SELECT id INTO v FROM quartiere
   WHERE attivo AND MBRIntersects(confine, p) AND ST_Intersects(confine, p)
   ORDER BY id LIMIT 1;
  RETURN v;
END $$

DROP FUNCTION IF EXISTS fn_livello_ruolo $$
CREATE FUNCTION fn_livello_ruolo(p_id_utente INT UNSIGNED) RETURNS TINYINT UNSIGNED
  READS SQL DATA
BEGIN
  DECLARE v TINYINT UNSIGNED DEFAULT 0;
  SELECT r.livello INTO v FROM utente u JOIN ruolo r ON r.id = u.id_ruolo WHERE u.id = p_id_utente;
  RETURN COALESCE(v, 0);
END $$

DROP FUNCTION IF EXISTS fn_provvedimento_attivo $$
CREATE FUNCTION fn_provvedimento_attivo(p_id_utente INT UNSIGNED) RETURNS BOOLEAN
  READS SQL DATA
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM provvedimento
     WHERE id_destinatario = p_id_utente
       AND revocato_il IS NULL
       AND data_inizio <= NOW()
       AND (data_fine IS NULL OR data_fine > NOW()));
END $$

-- RD-14 / RD-22: verificato, non bannato né cancellato, senza provvedimenti attivi.
-- Uno stato 'sospeso' con sospensione già scaduta non blocca (il job notturno lo riporta ad 'attivo').
DROP FUNCTION IF EXISTS fn_utente_puo_scrivere $$
CREATE FUNCTION fn_utente_puo_scrivere(p_id_utente INT UNSIGNED) RETURNS BOOLEAN
  READS SQL DATA
BEGIN
  DECLARE v_ok BOOLEAN DEFAULT FALSE;
  SELECT stato_account IN ('attivo','sospeso') AND email_verificata_il IS NOT NULL
    INTO v_ok FROM utente WHERE id = p_id_utente;
  RETURN COALESCE(v_ok, FALSE) AND NOT fn_provvedimento_attivo(p_id_utente);
END $$

-- 7.3: w_i = peso maggiore se il sostenitore risiede nel Municipio della segnalazione
DROP FUNCTION IF EXISTS fn_peso_sostegno $$
CREATE FUNCTION fn_peso_sostegno(p_id_utente INT UNSIGNED, p_id_segnalazione INT UNSIGNED) RETURNS DECIMAL(4,2)
  READS SQL DATA
BEGIN
  DECLARE v_stesso BOOLEAN DEFAULT FALSE;
  SELECT qu.id_municipio = qs.id_municipio INTO v_stesso
    FROM utente u
    JOIN quartiere qu ON qu.id = u.id_quartiere
    JOIN segnalazione s ON s.id = p_id_segnalazione
    JOIN quartiere qs ON qs.id = s.id_quartiere
   WHERE u.id = p_id_utente;
  RETURN IF(COALESCE(v_stesso, FALSE),
            fn_param('priorita.peso_stesso_municipio'),
            fn_param('priorita.peso_altro'));
END $$

-- -----------------------------------------------------------------------------
-- Procedure
-- -----------------------------------------------------------------------------

-- RF-46: scrive una riga di audit con l'utente e l'IP della sessione
DROP PROCEDURE IF EXISTS sp_audit $$
CREATE PROCEDURE sp_audit(IN p_azione VARCHAR(60), IN p_tipo VARCHAR(40), IN p_id VARCHAR(40),
                          IN p_prima JSON, IN p_dopo JSON)
  MODIFIES SQL DATA
BEGIN
  INSERT INTO audit_log (azione, tipo_oggetto, id_oggetto, valori_prima, valori_dopo, indirizzo_ip, id_utente)
  VALUES (p_azione, p_tipo, p_id, p_prima, p_dopo, @lnc_ip, @lnc_id_utente);
END $$

-- 7.3: P = somma(w_i) + coeff * C_u ; aggiorna anche num_sostegni e num_commentatori
DROP PROCEDURE IF EXISTS sp_ricalcola_punteggio $$
CREATE PROCEDURE sp_ricalcola_punteggio(IN p_id INT UNSIGNED)
  MODIFIES SQL DATA
BEGIN
  DECLARE v_autore INT UNSIGNED;
  DECLARE v_n INT UNSIGNED DEFAULT 0;
  DECLARE v_pesi DECIMAL(10,2) DEFAULT 0;
  DECLARE v_cu INT UNSIGNED DEFAULT 0;

  SELECT id_autore INTO v_autore FROM segnalazione WHERE id = p_id;
  SELECT COUNT(*), COALESCE(SUM(peso), 0) INTO v_n, v_pesi FROM sostegno WHERE id_segnalazione = p_id;
  SELECT COUNT(DISTINCT id_autore) INTO v_cu
    FROM commento
   WHERE id_segnalazione = p_id AND stato = 'visibile' AND id_autore <> v_autore;

  UPDATE segnalazione
     SET num_sostegni = v_n,
         num_commentatori = v_cu,
         punteggio_priorita = v_pesi + fn_param('priorita.coeff_commentatori') * v_cu
   WHERE id = p_id;
END $$

-- Da usare dopo aver cambiato i pesi della formula (RF-45)
DROP PROCEDURE IF EXISTS sp_ricalcola_tutti_punteggi $$
CREATE PROCEDURE sp_ricalcola_tutti_punteggi()
  MODIFIES SQL DATA
BEGIN
  UPDATE sostegno SET peso = fn_peso_sostegno(id_utente, id_segnalazione);
  UPDATE segnalazione s
     SET s.num_sostegni = (SELECT COUNT(*) FROM sostegno so WHERE so.id_segnalazione = s.id),
         s.num_commentatori = (SELECT COUNT(DISTINCT c.id_autore) FROM commento c
                                WHERE c.id_segnalazione = s.id AND c.stato = 'visibile' AND c.id_autore <> s.id_autore),
         s.punteggio_priorita =
             (SELECT COALESCE(SUM(so.peso), 0) FROM sostegno so WHERE so.id_segnalazione = s.id)
           + fn_param('priorita.coeff_commentatori')
             * (SELECT COUNT(DISTINCT c.id_autore) FROM commento c
                 WHERE c.id_segnalazione = s.id AND c.stato = 'visibile' AND c.id_autore <> s.id_autore)
   WHERE s.stato_corrente <> 'BOZZA';
END $$

-- RF-30: sposta i sostegni della secondaria sulla principale senza doppi conteggi.
-- Anche l'autore della secondaria diventa sostenitore della principale.
DROP PROCEDURE IF EXISTS sp_trasferisci_sostegni $$
CREATE PROCEDURE sp_trasferisci_sostegni(IN p_da INT UNSIGNED, IN p_a INT UNSIGNED)
  MODIFIES SQL DATA
BEGIN
  DECLARE v_autore_a INT UNSIGNED;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    SET @lnc_sistema = NULL;
    RESIGNAL;
  END;

  SELECT id_autore INTO v_autore_a FROM segnalazione WHERE id = p_a;
  SET @lnc_sistema = 1;

  INSERT INTO sostegno (id_utente, id_segnalazione, data, indirizzo_ip)
  SELECT so.id_utente, p_a, so.data, so.indirizzo_ip
    FROM sostegno so
   WHERE so.id_segnalazione = p_da
     AND so.id_utente <> v_autore_a
     AND NOT EXISTS (SELECT 1 FROM sostegno x WHERE x.id_segnalazione = p_a AND x.id_utente = so.id_utente);

  INSERT INTO sostegno (id_utente, id_segnalazione)
  SELECT s.id_autore, p_a
    FROM segnalazione s JOIN utente u ON u.id = s.id_autore
   WHERE s.id = p_da
     AND s.id_autore <> v_autore_a
     AND u.stato_account <> 'cancellato'
     AND NOT EXISTS (SELECT 1 FROM sostegno x WHERE x.id_segnalazione = p_a AND x.id_utente = s.id_autore);

  DELETE FROM sostegno WHERE id_segnalazione = p_da;

  INSERT INTO segue (id_utente, id_segnalazione, data)
  SELECT g.id_utente, p_a, g.data
    FROM segue g
   WHERE g.id_segnalazione = p_da
     AND NOT EXISTS (SELECT 1 FROM segue x WHERE x.id_segnalazione = p_a AND x.id_utente = g.id_utente);

  SET @lnc_sistema = NULL;
END $$

-- Unico punto d'ingresso per i cambi di stato (RF-26, RF-27, RD-09, RD-10).
-- Va chiamata dentro una transazione. p_id_utente NULL = sistema/IA.
-- p_id_principale solo per il passaggio a UNITA (RF-30).
DROP PROCEDURE IF EXISTS sp_cambia_stato $$
CREATE PROCEDURE sp_cambia_stato(
  IN p_id            INT UNSIGNED,
  IN p_stato_a       VARCHAR(20),
  IN p_attore        VARCHAR(20),
  IN p_id_utente     INT UNSIGNED,
  IN p_motivazione   VARCHAR(1000),
  IN p_id_principale INT UNSIGNED)
  MODIFIES SQL DATA
BEGIN
  DECLARE v_stato_da VARCHAR(20);
  DECLARE v_codice VARCHAR(20);
  DECLARE v_nome_stato VARCHAR(40);

  SELECT stato_corrente, codice_pubblico INTO v_stato_da, v_codice
    FROM segnalazione WHERE id = p_id FOR UPDATE;
  IF v_stato_da IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Segnalazione inesistente';
  END IF;

  IF p_stato_a = 'UNITA' THEN
    IF p_id_principale IS NULL OR p_id_principale = p_id THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RD-12: indicare una segnalazione principale diversa da questa';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM segnalazione s JOIN stato st ON st.codice = s.stato_corrente
                    WHERE s.id = p_id_principale AND st.votabile) THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RF-30: la segnalazione principale deve essere pubblicata';
    END IF;
  ELSEIF p_id_principale IS NOT NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RD-12: la principale si indica solo per lo stato Unita';
  END IF;

  -- il trigger su storico_stato valida transizione, attore, motivazione e precondizioni
  INSERT INTO storico_stato (id_segnalazione, stato_da, stato_a, attore, id_utente, motivazione)
  VALUES (p_id, v_stato_da, p_stato_a, p_attore, p_id_utente, NULLIF(TRIM(p_motivazione), ''));

  UPDATE segnalazione
     SET stato_corrente = p_stato_a,
         data_stato_corrente = NOW(),
         data_invio = IF(p_stato_a = 'RICEVUTA' AND data_invio IS NULL, NOW(), data_invio),
         data_pubblicazione = IF(p_stato_a = 'PUBBLICATA' AND data_pubblicazione IS NULL, NOW(), data_pubblicazione),
         id_segnalazione_principale = p_id_principale
   WHERE id = p_id;

  -- RF-29: notifica ad autore, sostenitori e follower (escluso chi ha agito)
  SELECT nome INTO v_nome_stato FROM stato WHERE codice = p_stato_a;
  INSERT INTO notifica (id_utente, tipo, testo, id_segnalazione)
  SELECT u.id, 'cambio_stato',
         CONCAT('La segnalazione ', v_codice, ' è passata allo stato «', v_nome_stato, '»'), p_id
    FROM utente u
   WHERE u.stato_account <> 'cancellato'
     AND (p_id_utente IS NULL OR u.id <> p_id_utente)
     AND u.id IN (SELECT id_autore FROM segnalazione WHERE id = p_id
                  UNION SELECT id_utente FROM sostegno WHERE id_segnalazione = p_id
                  UNION SELECT id_utente FROM segue WHERE id_segnalazione = p_id);

  IF p_stato_a = 'UNITA' THEN
    CALL sp_trasferisci_sostegni(p_id, p_id_principale);
    CALL sp_ricalcola_punteggio(p_id);
    CALL sp_ricalcola_punteggio(p_id_principale);
  END IF;
END $$

-- RF-48: invio del documento a TUTTI i candidati attivi (neutralità, 2.5) e
-- passaggio delle segnalazioni incluse a INVIATA_CANDIDATI. Va chiamata in transazione.
DROP PROCEDURE IF EXISTS sp_invia_documento $$
CREATE PROCEDURE sp_invia_documento(IN p_id_documento INT UNSIGNED, IN p_id_amministratore INT UNSIGNED)
  MODIFIES SQL DATA
BEGIN
  DECLARE v_stato VARCHAR(20);
  DECLARE v_id INT UNSIGNED DEFAULT 0;

  IF fn_livello_ruolo(p_id_amministratore) < 3 OR NOT fn_utente_puo_scrivere(p_id_amministratore) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RF-48: solo un amministratore attivo può inviare il documento';
  END IF;
  SELECT stato INTO v_stato FROM documento_programmatico WHERE id = p_id_documento FOR UPDATE;
  IF v_stato IS NULL OR v_stato <> 'definitivo' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RF-48: si può inviare solo un documento in stato definitivo';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM documento_segnalazione WHERE id_documento = p_id_documento) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RF-48: il documento non contiene segnalazioni';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM candidato WHERE attivo) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RF-48: nessun candidato attivo a cui inviare il documento';
  END IF;

  INSERT INTO invio_documento (id_documento, id_candidato, email_inviata)
  SELECT p_id_documento, id, email_contatto FROM candidato WHERE attivo;

  UPDATE documento_programmatico SET stato = 'inviato', data_invio = NOW() WHERE id = p_id_documento;

  ciclo: LOOP
    SET v_id = (SELECT MIN(ds.id_segnalazione)
                  FROM documento_segnalazione ds JOIN segnalazione s ON s.id = ds.id_segnalazione
                 WHERE ds.id_documento = p_id_documento AND s.stato_corrente = 'PRESA_IN_CARICO'
                   AND ds.id_segnalazione > v_id);
    IF v_id IS NULL THEN LEAVE ciclo; END IF;
    CALL sp_cambia_stato(v_id, 'INVIATA_CANDIDATI', 'amministratore', p_id_amministratore, NULL, NULL);
  END LOOP;

  CALL sp_audit('invio_documento', 'documento_programmatico', p_id_documento, NULL,
                JSON_OBJECT('candidati', (SELECT COUNT(*) FROM invio_documento WHERE id_documento = p_id_documento)));
END $$

-- RF-08 / RD-18: rimuove i dati personali, mantiene valide le FK
DROP PROCEDURE IF EXISTS sp_anonimizza_utente $$
CREATE PROCEDURE sp_anonimizza_utente(IN p_id INT UNSIGNED)
  MODIFIES SQL DATA
BEGIN
  DELETE FROM segnalazione WHERE id_autore = p_id AND stato_corrente = 'BOZZA';
  UPDATE utente
     SET nome = NULL, cognome = NULL, email = NULL, password_hash = NULL,
         data_nascita = NULL, telefono = NULL, telefono_verificato_il = NULL,
         nome_visualizzato = 'Utente rimosso', mostra_nome_reale = FALSE, foto_profilo = NULL,
         consenso_notifiche = FALSE, consenso_addestramento_ia = FALSE,
         notifiche_email = FALSE, notifiche_inapp = FALSE,
         totp_attivo = FALSE, totp_segreto = NULL, id_ruolo = 1, id_quartiere = NULL,
         stato_account = 'cancellato',
         cancellazione_richiesta_il = COALESCE(cancellazione_richiesta_il, NOW()),
         anonimizzato_il = NOW()
   WHERE id = p_id;
  DELETE FROM token_utente WHERE id_utente = p_id;
  DELETE FROM notifica WHERE id_utente = p_id;
  DELETE FROM segue WHERE id_utente = p_id;
  UPDATE accesso_log SET id_utente = NULL, email_tentata = NULL WHERE id_utente = p_id;
  UPDATE sostegno SET indirizzo_ip = NULL WHERE id_utente = p_id;
  CALL sp_audit('anonimizzazione', 'utente', p_id, NULL, NULL);
END $$

-- Job notturno: archiviazione (120 gg), ritiro Da integrare (14 gg), pulizia bozze (30 gg),
-- fine sospensioni, token scaduti, log accessi (RNF-12), anonimizzazione account (RF-08).
-- Ogni segnalazione è una transazione a sé: un errore non blocca le altre.
DROP PROCEDURE IF EXISTS sp_job_notturno $$
CREATE PROCEDURE sp_job_notturno()
  MODIFIES SQL DATA
BEGIN
  DECLARE v_id INT UNSIGNED;
  DECLARE v_limite DATETIME;
  SET @lnc_id_utente = NULL, @lnc_ip = NULL;

  -- Pubblicata -> Archiviata
  SET v_id = 0;
  SET v_limite = NOW() - INTERVAL fn_param('segnalazione.giorni_archiviazione') DAY;
  archivia: LOOP
    SET v_id = (SELECT MIN(s.id) FROM segnalazione s
                 WHERE s.stato_corrente = 'PUBBLICATA' AND s.id > v_id
                   AND s.data_stato_corrente < v_limite
                   AND NOT EXISTS (SELECT 1 FROM sostegno so WHERE so.id_segnalazione = s.id AND so.data >= v_limite)
                   AND NOT EXISTS (SELECT 1 FROM commento c WHERE c.id_segnalazione = s.id AND c.data >= v_limite));
    IF v_id IS NULL THEN LEAVE archivia; END IF;
    BEGIN
      DECLARE EXIT HANDLER FOR SQLEXCEPTION ROLLBACK;
      START TRANSACTION;
      CALL sp_cambia_stato(v_id, 'ARCHIVIATA', 'sistema', NULL, 'Nessuna attività negli ultimi giorni previsti', NULL);
      COMMIT;
    END;
  END LOOP;

  -- Da integrare -> Ritirata
  SET v_id = 0;
  SET v_limite = NOW() - INTERVAL fn_param('segnalazione.giorni_da_integrare') DAY;
  ritira: LOOP
    SET v_id = (SELECT MIN(id) FROM segnalazione
                 WHERE stato_corrente = 'DA_INTEGRARE' AND id > v_id AND data_stato_corrente < v_limite);
    IF v_id IS NULL THEN LEAVE ritira; END IF;
    BEGIN
      DECLARE EXIT HANDLER FOR SQLEXCEPTION ROLLBACK;
      START TRANSACTION;
      CALL sp_cambia_stato(v_id, 'RITIRATA', 'sistema', NULL, 'Integrazione non ricevuta entro il termine', NULL);
      COMMIT;
    END;
  END LOOP;

  -- Bozze scadute (RF-17)
  DELETE FROM segnalazione
   WHERE stato_corrente = 'BOZZA'
     AND data_modifica < NOW() - INTERVAL fn_param('segnalazione.giorni_bozza') DAY;

  -- Sospensioni scadute
  UPDATE utente SET stato_account = 'attivo'
   WHERE stato_account = 'sospeso' AND email_verificata_il IS NOT NULL AND NOT fn_provvedimento_attivo(id);

  -- Token e log
  DELETE FROM token_utente WHERE scade_il < NOW() - INTERVAL 7 DAY;
  DELETE FROM accesso_log WHERE data_ora < NOW() - INTERVAL fn_param('log.giorni_accessi') DAY;

  -- Anonimizzazione account cancellati
  SET v_id = 0;
  SET v_limite = NOW() - INTERVAL fn_param('account.giorni_anonimizzazione') DAY;
  anonimizza: LOOP
    SET v_id = (SELECT MIN(id) FROM utente
                 WHERE stato_account = 'cancellato' AND anonimizzato_il IS NULL
                   AND cancellazione_richiesta_il <= v_limite AND id > v_id);
    IF v_id IS NULL THEN LEAVE anonimizza; END IF;
    BEGIN
      DECLARE EXIT HANDLER FOR SQLEXCEPTION ROLLBACK;
      START TRANSACTION;
      CALL sp_anonimizza_utente(v_id);
      COMMIT;
    END;
  END LOOP;
END $$

-- -----------------------------------------------------------------------------
-- Trigger: utente e configurazione
-- -----------------------------------------------------------------------------

-- RF-10: moderatori e amministratori devono avere il 2FA attivo
DROP TRIGGER IF EXISTS trg_utente_bi $$
CREATE TRIGGER trg_utente_bi BEFORE INSERT ON utente FOR EACH ROW
BEGIN
  IF (SELECT livello FROM ruolo WHERE id = NEW.id_ruolo) >= 2 AND NOT NEW.totp_attivo THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RF-10: moderatori e amministratori devono attivare il 2FA';
  END IF;
END $$

DROP TRIGGER IF EXISTS trg_utente_bu $$
CREATE TRIGGER trg_utente_bu BEFORE UPDATE ON utente FOR EACH ROW
BEGIN
  IF (SELECT livello FROM ruolo WHERE id = NEW.id_ruolo) >= 2 AND NOT NEW.totp_attivo THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RF-10: moderatori e amministratori devono attivare il 2FA';
  END IF;
  -- RF-06: l'email cambia solo insieme a una nuova verifica
  IF NOT (NEW.email <=> OLD.email) AND NEW.anonimizzato_il IS NULL
     AND NEW.email_verificata_il <=> OLD.email_verificata_il THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RF-06: la nuova email va verificata prima di essere salvata';
  END IF;
  IF OLD.anonimizzato_il IS NOT NULL AND NEW.anonimizzato_il IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RD-18: un account anonimizzato non si può ripristinare';
  END IF;
END $$

DROP TRIGGER IF EXISTS trg_utente_au $$
CREATE TRIGGER trg_utente_au AFTER UPDATE ON utente FOR EACH ROW
BEGIN
  IF NEW.id_ruolo <> OLD.id_ruolo OR NEW.stato_account <> OLD.stato_account THEN
    CALL sp_audit('modifica_utente', 'utente', NEW.id,
                  JSON_OBJECT('id_ruolo', OLD.id_ruolo, 'stato_account', OLD.stato_account),
                  JSON_OBJECT('id_ruolo', NEW.id_ruolo, 'stato_account', NEW.stato_account));
  END IF;
END $$

DROP TRIGGER IF EXISTS trg_parametro_bu $$
CREATE TRIGGER trg_parametro_bu BEFORE UPDATE ON parametro_sistema FOR EACH ROW
BEGIN
  IF NEW.chiave <> OLD.chiave THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La chiave di un parametro non si modifica';
  END IF;
  IF @lnc_id_utente IS NOT NULL THEN
    SET NEW.id_utente_modifica = @lnc_id_utente;
  END IF;
  IF NEW.chiave = 'ia.moderazione.soglia_revisione'
     AND NEW.valore >= (SELECT valore FROM parametro_sistema WHERE chiave = 'ia.moderazione.soglia_blocco') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RIA-06: la soglia di revisione deve essere minore di quella di blocco';
  END IF;
  IF NEW.chiave = 'ia.moderazione.soglia_blocco'
     AND NEW.valore <= (SELECT valore FROM parametro_sistema WHERE chiave = 'ia.moderazione.soglia_revisione') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RIA-06: la soglia di blocco deve essere maggiore di quella di revisione';
  END IF;
END $$

DROP TRIGGER IF EXISTS trg_parametro_au $$
CREATE TRIGGER trg_parametro_au AFTER UPDATE ON parametro_sistema FOR EACH ROW
BEGIN
  IF NEW.valore <> OLD.valore THEN
    CALL sp_audit('modifica_parametro', 'parametro_sistema', NEW.chiave,
                  JSON_OBJECT('valore', OLD.valore), JSON_OBJECT('valore', NEW.valore));
  END IF;
END $$

DROP TRIGGER IF EXISTS trg_categoria_ai $$
CREATE TRIGGER trg_categoria_ai AFTER INSERT ON categoria FOR EACH ROW
BEGIN
  CALL sp_audit('crea_categoria', 'categoria', NEW.id, NULL,
                JSON_OBJECT('nome', NEW.nome, 'colore_mappa', NEW.colore_mappa, 'attiva', NEW.attiva));
END $$

DROP TRIGGER IF EXISTS trg_categoria_au $$
CREATE TRIGGER trg_categoria_au AFTER UPDATE ON categoria FOR EACH ROW
BEGIN
  CALL sp_audit('modifica_categoria', 'categoria', NEW.id,
                JSON_OBJECT('nome', OLD.nome, 'colore_mappa', OLD.colore_mappa, 'attiva', OLD.attiva),
                JSON_OBJECT('nome', NEW.nome, 'colore_mappa', NEW.colore_mappa, 'attiva', NEW.attiva));
END $$

DROP TRIGGER IF EXISTS trg_quartiere_au $$
CREATE TRIGGER trg_quartiere_au AFTER UPDATE ON quartiere FOR EACH ROW
BEGIN
  CALL sp_audit('modifica_quartiere', 'quartiere', NEW.id,
                JSON_OBJECT('nome', OLD.nome, 'id_municipio', OLD.id_municipio, 'attivo', OLD.attivo),
                JSON_OBJECT('nome', NEW.nome, 'id_municipio', NEW.id_municipio, 'attivo', NEW.attivo));
END $$

-- -----------------------------------------------------------------------------
-- Trigger: segnalazione
-- -----------------------------------------------------------------------------

DROP TRIGGER IF EXISTS trg_segnalazione_bi $$
CREATE TRIGGER trg_segnalazione_bi BEFORE INSERT ON segnalazione FOR EACH ROW
BEGIN
  DECLARE v_anno SMALLINT UNSIGNED;
  DECLARE v_num INT UNSIGNED;

  IF NEW.stato_corrente <> 'BOZZA' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Una segnalazione nasce in Bozza; lo stato cambia con sp_cambia_stato';
  END IF;
  IF NOT fn_utente_puo_scrivere(NEW.id_autore) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RD-14: solo un utente verificato e senza provvedimenti può inserire segnalazioni';
  END IF;
  IF NEW.id_segnalazione_principale IS NOT NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RD-12: la principale si indica solo per lo stato Unita';
  END IF;

  -- RF-14 / RD-04
  SET NEW.id_quartiere = fn_quartiere_da_coordinate(NEW.latitudine, NEW.longitudine);
  IF NEW.id_quartiere IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RD-04: il punto indicato è fuori dal Comune di Milano';
  END IF;

  -- codice pubblico MI-AAAA-NNNNNN, numerato per anno
  SET v_anno = YEAR(COALESCE(NEW.data_creazione, NOW()));
  INSERT INTO sequenza_codice (anno, ultimo) VALUES (v_anno, 1)
    ON DUPLICATE KEY UPDATE ultimo = ultimo + 1;
  SELECT ultimo INTO v_num FROM sequenza_codice WHERE anno = v_anno;
  SET NEW.codice_pubblico = CONCAT('MI-', v_anno, '-', LPAD(v_num, 6, '0'));

  SET NEW.num_sostegni = 0, NEW.num_commentatori = 0, NEW.punteggio_priorita = 0,
      NEW.data_invio = NULL, NEW.data_pubblicazione = NULL;
END $$

DROP TRIGGER IF EXISTS trg_segnalazione_bu $$
CREATE TRIGGER trg_segnalazione_bu BEFORE UPDATE ON segnalazione FOR EACH ROW
BEGIN
  DECLARE v_da VARCHAR(20);
  DECLARE v_a VARCHAR(20);

  IF NEW.id_autore <> OLD.id_autore OR NEW.codice_pubblico <> OLD.codice_pubblico THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Autore e codice pubblico non si modificano';
  END IF;

  -- RD-09: lo stato cambia solo se l'ultimo record di storico lo giustifica
  IF NEW.stato_corrente <> OLD.stato_corrente THEN
    SELECT stato_da, stato_a INTO v_da, v_a
      FROM storico_stato WHERE id_segnalazione = NEW.id ORDER BY id DESC LIMIT 1;
    IF NOT (v_da <=> OLD.stato_corrente AND v_a <=> NEW.stato_corrente) THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RD-09: cambio di stato senza storico; usare sp_cambia_stato';
    END IF;
  END IF;

  -- RD-12
  IF NEW.id_segnalazione_principale IS NOT NULL
     AND NOT (NEW.id_segnalazione_principale <=> OLD.id_segnalazione_principale) THEN
    IF NEW.id_segnalazione_principale = NEW.id THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RD-12: una segnalazione non può essere unita a sé stessa';
    END IF;
    IF (SELECT stato_corrente FROM segnalazione WHERE id = NEW.id_segnalazione_principale) = 'UNITA' THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RD-12: la principale non può essere a sua volta unita';
    END IF;
  END IF;

  -- RF-19: testo modificabile solo in Bozza, Ricevuta, Da integrare
  IF (NOT (NEW.titolo <=> OLD.titolo) OR NOT (NEW.descrizione <=> OLD.descrizione) OR NEW.tipo <> OLD.tipo)
     AND OLD.stato_corrente NOT IN ('BOZZA','RICEVUTA','DA_INTEGRARE') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RF-19: dopo la pubblicazione si possono solo aggiungere aggiornamenti';
  END IF;

  -- RF-14 / RD-04 / RF-43: nuova posizione -> nuovo quartiere
  IF NEW.latitudine <> OLD.latitudine OR NEW.longitudine <> OLD.longitudine THEN
    IF (SELECT finale FROM stato WHERE codice = OLD.stato_corrente) THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La posizione di una segnalazione in stato finale non si modifica';
    END IF;
    SET NEW.id_quartiere = fn_quartiere_da_coordinate(NEW.latitudine, NEW.longitudine);
    IF NEW.id_quartiere IS NULL THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RD-04: il punto indicato è fuori dal Comune di Milano';
    END IF;
  ELSEIF NEW.id_quartiere <> OLD.id_quartiere THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RF-14: il quartiere si ricava dalle coordinate';
  END IF;
END $$

DROP TRIGGER IF EXISTS trg_segnalazione_au $$
CREATE TRIGGER trg_segnalazione_au AFTER UPDATE ON segnalazione FOR EACH ROW
BEGIN
  IF (NEW.latitudine <> OLD.latitudine OR NEW.longitudine <> OLD.longitudine) AND OLD.stato_corrente <> 'BOZZA' THEN
    CALL sp_audit('correzione_posizione', 'segnalazione', NEW.id,
                  JSON_OBJECT('lat', OLD.latitudine, 'lon', OLD.longitudine, 'id_quartiere', OLD.id_quartiere),
                  JSON_OBJECT('lat', NEW.latitudine, 'lon', NEW.longitudine, 'id_quartiere', NEW.id_quartiere));
  END IF;
END $$

-- RD-17: si cancellano fisicamente solo le bozze (RF-17)
DROP TRIGGER IF EXISTS trg_segnalazione_bd $$
CREATE TRIGGER trg_segnalazione_bd BEFORE DELETE ON segnalazione FOR EACH ROW
BEGIN
  IF OLD.stato_corrente <> 'BOZZA' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RD-17: le segnalazioni inviate non si cancellano; usare il ritiro';
  END IF;
  DELETE a FROM analisi_ia a JOIN allegato al ON al.id = a.id_allegato WHERE al.id_segnalazione = OLD.id;
  DELETE FROM analisi_ia WHERE id_segnalazione = OLD.id;
END $$

-- -----------------------------------------------------------------------------
-- Trigger: allegati e categorie
-- -----------------------------------------------------------------------------

DROP TRIGGER IF EXISTS trg_allegato_bi $$
CREATE TRIGGER trg_allegato_bi BEFORE INSERT ON allegato FOR EACH ROW
BEGIN
  IF (SELECT stato_corrente FROM segnalazione WHERE id = NEW.id_segnalazione) NOT IN ('BOZZA','RICEVUTA','DA_INTEGRARE') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RF-19: gli allegati si modificano solo in Bozza, Ricevuta o Da integrare';
  END IF;
  IF (SELECT COUNT(*) FROM allegato WHERE id_segnalazione = NEW.id_segnalazione) >= fn_param('segnalazione.max_allegati') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RD-03: massimo 5 allegati per segnalazione';
  END IF;
END $$

DROP TRIGGER IF EXISTS trg_allegato_bu $$
CREATE TRIGGER trg_allegato_bu BEFORE UPDATE ON allegato FOR EACH ROW
BEGIN
  IF NEW.id_segnalazione <> OLD.id_segnalazione OR NEW.hash_sha256 <> OLD.hash_sha256 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Un allegato non cambia segnalazione né contenuto';
  END IF;
END $$

DROP TRIGGER IF EXISTS trg_allegato_bd $$
CREATE TRIGGER trg_allegato_bd BEFORE DELETE ON allegato FOR EACH ROW
BEGIN
  DECLARE v_stato VARCHAR(20);
  SELECT stato_corrente INTO v_stato FROM segnalazione WHERE id = OLD.id_segnalazione;
  IF v_stato NOT IN ('BOZZA','RICEVUTA','DA_INTEGRARE') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RF-19: gli allegati si modificano solo in Bozza, Ricevuta o Da integrare';
  END IF;
  IF v_stato <> 'BOZZA' AND (SELECT COUNT(*) FROM allegato WHERE id_segnalazione = OLD.id_segnalazione) <= 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RD-03: una segnalazione inviata deve avere almeno un allegato';
  END IF;
  DELETE FROM analisi_ia WHERE id_allegato = OLD.id;
END $$

DROP TRIGGER IF EXISTS trg_classificazione_bi $$
CREATE TRIGGER trg_classificazione_bi BEFORE INSERT ON classificazione FOR EACH ROW
BEGIN
  IF NOT (SELECT attiva FROM categoria WHERE id = NEW.id_categoria) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RIA-11: la categoria non è attiva';
  END IF;
END $$

-- RD-08: una segnalazione visibile mantiene almeno una categoria confermata
DROP TRIGGER IF EXISTS trg_classificazione_bu $$
CREATE TRIGGER trg_classificazione_bu BEFORE UPDATE ON classificazione FOR EACH ROW
BEGIN
  IF NEW.id_segnalazione <> OLD.id_segnalazione OR NEW.id_categoria <> OLD.id_categoria THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Correggere la categoria inserendo una nuova classificazione';
  END IF;
  IF OLD.confermata AND NOT NEW.confermata
     AND (SELECT st.pubblico FROM segnalazione s JOIN stato st ON st.codice = s.stato_corrente WHERE s.id = OLD.id_segnalazione)
     AND NOT EXISTS (SELECT 1 FROM classificazione c
                      WHERE c.id_segnalazione = OLD.id_segnalazione AND c.confermata AND c.id_categoria <> OLD.id_categoria) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RD-08: una segnalazione pubblicata deve avere almeno una categoria confermata';
  END IF;
END $$

DROP TRIGGER IF EXISTS trg_classificazione_bd $$
CREATE TRIGGER trg_classificazione_bd BEFORE DELETE ON classificazione FOR EACH ROW
BEGIN
  IF OLD.confermata
     AND (SELECT st.pubblico FROM segnalazione s JOIN stato st ON st.codice = s.stato_corrente WHERE s.id = OLD.id_segnalazione)
     AND NOT EXISTS (SELECT 1 FROM classificazione c
                      WHERE c.id_segnalazione = OLD.id_segnalazione AND c.confermata AND c.id_categoria <> OLD.id_categoria) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RD-08: una segnalazione pubblicata deve avere almeno una categoria confermata';
  END IF;
END $$

DROP TRIGGER IF EXISTS trg_classificazione_ai $$
CREATE TRIGGER trg_classificazione_ai AFTER INSERT ON classificazione FOR EACH ROW
BEGIN
  IF NEW.origine = 'moderatore' THEN
    CALL sp_audit('correzione_categoria', 'segnalazione', NEW.id_segnalazione, NULL,
                  JSON_OBJECT('id_categoria', NEW.id_categoria, 'confermata', NEW.confermata));
  END IF;
END $$

-- -----------------------------------------------------------------------------
-- Trigger: storico stati (validazione del ciclo di vita)
-- -----------------------------------------------------------------------------

DROP TRIGGER IF EXISTS trg_storico_bi $$
CREATE TRIGGER trg_storico_bi BEFORE INSERT ON storico_stato FOR EACH ROW
BEGIN
  DECLARE v_stato VARCHAR(20);
  DECLARE v_autore INT UNSIGNED;
  DECLARE v_titolo VARCHAR(100);
  DECLARE v_descrizione VARCHAR(2000);
  DECLARE v_motiv_obbl BOOLEAN;
  DECLARE v_allegati INT;

  SELECT stato_corrente, id_autore, titolo, descrizione
    INTO v_stato, v_autore, v_titolo, v_descrizione
    FROM segnalazione WHERE id = NEW.id_segnalazione;

  IF NOT (NEW.stato_da <=> v_stato) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RD-09: lo stato di partenza non coincide con lo stato corrente';
  END IF;

  -- RD-10: transizione ammessa per l'attore (l'amministratore può ciò che può il moderatore)
  SELECT MAX(motivazione_obbligatoria) INTO v_motiv_obbl
    FROM transizione_ammessa
   WHERE stato_da = NEW.stato_da AND stato_a = NEW.stato_a
     AND (attore = NEW.attore OR (attore = 'moderatore' AND NEW.attore = 'amministratore'));
  IF v_motiv_obbl IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RD-10: transizione di stato non ammessa per questo attore';
  END IF;
  IF v_motiv_obbl AND (NEW.motivazione IS NULL OR CHAR_LENGTH(TRIM(NEW.motivazione)) = 0) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RD-11: per questo passaggio la motivazione è obbligatoria';
  END IF;

  -- chi agisce deve averne titolo
  IF NEW.attore = 'autore' AND NOT (NEW.id_utente <=> v_autore) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Solo l''autore può eseguire questo passaggio';
  END IF;
  IF NEW.attore = 'moderatore' AND fn_livello_ruolo(NEW.id_utente) < 2 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Passaggio riservato ai moderatori';
  END IF;
  IF NEW.attore = 'amministratore' AND fn_livello_ruolo(NEW.id_utente) < 3 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Passaggio riservato agli amministratori';
  END IF;
  IF NEW.attore <> 'sistema' AND NOT fn_utente_puo_scrivere(NEW.id_utente) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RD-22: utente non attivo o con provvedimento in corso';
  END IF;

  -- precondizioni per l'invio (RF-11, RD-03, RF-18)
  IF NEW.stato_a = 'RICEVUTA' THEN
    IF v_titolo IS NULL OR v_descrizione IS NULL THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RF-11: titolo e descrizione sono obbligatori';
    END IF;
    SELECT COUNT(*) INTO v_allegati FROM allegato WHERE id_segnalazione = NEW.id_segnalazione;
    IF v_allegati < 1 OR v_allegati > fn_param('segnalazione.max_allegati') THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RD-03: servono da 1 a 5 allegati';
    END IF;
    IF NEW.stato_da = 'BOZZA'
       AND (SELECT COUNT(*) FROM segnalazione
             WHERE id_autore = v_autore AND data_invio >= NOW() - INTERVAL 1 DAY) >= fn_param('segnalazione.max_giornaliere') THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RF-18: raggiunto il limite di 5 segnalazioni nelle ultime 24 ore';
    END IF;
  END IF;

  -- RD-08
  IF NEW.stato_a = 'PUBBLICATA' AND NOT EXISTS (
       SELECT 1 FROM classificazione c JOIN categoria k ON k.id = c.id_categoria
        WHERE c.id_segnalazione = NEW.id_segnalazione AND c.confermata AND k.attiva) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RD-08: serve almeno una categoria confermata per pubblicare';
  END IF;
END $$

DROP TRIGGER IF EXISTS trg_storico_ai $$
CREATE TRIGGER trg_storico_ai AFTER INSERT ON storico_stato FOR EACH ROW
BEGIN
  IF NEW.attore IN ('moderatore','amministratore') THEN
    CALL sp_audit('cambio_stato', 'segnalazione', NEW.id_segnalazione,
                  JSON_OBJECT('stato', NEW.stato_da),
                  JSON_OBJECT('stato', NEW.stato_a, 'motivazione', NEW.motivazione));
  END IF;
END $$

-- RD-19: sola aggiunta
DROP TRIGGER IF EXISTS trg_storico_bu $$
CREATE TRIGGER trg_storico_bu BEFORE UPDATE ON storico_stato FOR EACH ROW
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RD-19: lo storico stati non si modifica' $$

DROP TRIGGER IF EXISTS trg_storico_bd $$
CREATE TRIGGER trg_storico_bd BEFORE DELETE ON storico_stato FOR EACH ROW
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RD-19: lo storico stati non si cancella' $$

DROP TRIGGER IF EXISTS trg_audit_bu $$
CREATE TRIGGER trg_audit_bu BEFORE UPDATE ON audit_log FOR EACH ROW
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RD-19: il registro di audit non si modifica' $$

DROP TRIGGER IF EXISTS trg_audit_bd $$
CREATE TRIGGER trg_audit_bd BEFORE DELETE ON audit_log FOR EACH ROW
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RD-19: il registro di audit non si cancella' $$

-- -----------------------------------------------------------------------------
-- Trigger: sostegni, commenti, aggiornamenti
-- -----------------------------------------------------------------------------

DROP TRIGGER IF EXISTS trg_sostegno_bi $$
CREATE TRIGGER trg_sostegno_bi BEFORE INSERT ON sostegno FOR EACH ROW
BEGIN
  IF COALESCE(@lnc_sistema, 0) = 0 AND NOT fn_utente_puo_scrivere(NEW.id_utente) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RD-14: solo un utente verificato e senza provvedimenti può sostenere';
  END IF;
  IF (SELECT id_autore FROM segnalazione WHERE id = NEW.id_segnalazione) = NEW.id_utente THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RD-06: l''autore non può sostenere la propria segnalazione';
  END IF;
  IF NOT (SELECT st.votabile FROM segnalazione s JOIN stato st ON st.codice = s.stato_corrente
           WHERE s.id = NEW.id_segnalazione) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RD-07: la segnalazione non è in uno stato votabile';
  END IF;
  SET NEW.peso = fn_peso_sostegno(NEW.id_utente, NEW.id_segnalazione);
END $$

DROP TRIGGER IF EXISTS trg_sostegno_ai $$
CREATE TRIGGER trg_sostegno_ai AFTER INSERT ON sostegno FOR EACH ROW
  CALL sp_ricalcola_punteggio(NEW.id_segnalazione) $$

-- RF-31: il sostegno si ritira finché la segnalazione è votabile (classifica finale congelata)
DROP TRIGGER IF EXISTS trg_sostegno_bd $$
CREATE TRIGGER trg_sostegno_bd BEFORE DELETE ON sostegno FOR EACH ROW
BEGIN
  IF COALESCE(@lnc_sistema, 0) = 0
     AND NOT (SELECT st.votabile FROM segnalazione s JOIN stato st ON st.codice = s.stato_corrente
               WHERE s.id = OLD.id_segnalazione) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RF-31: la segnalazione non è più votabile, il sostegno resta registrato';
  END IF;
END $$

DROP TRIGGER IF EXISTS trg_sostegno_ad $$
CREATE TRIGGER trg_sostegno_ad AFTER DELETE ON sostegno FOR EACH ROW
  CALL sp_ricalcola_punteggio(OLD.id_segnalazione) $$

DROP TRIGGER IF EXISTS trg_commento_bi $$
CREATE TRIGGER trg_commento_bi BEFORE INSERT ON commento FOR EACH ROW
BEGIN
  IF NOT fn_utente_puo_scrivere(NEW.id_autore) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RD-14: solo un utente verificato e senza provvedimenti può commentare';
  END IF;
  IF NOT (SELECT st.votabile FROM segnalazione s JOIN stato st ON st.codice = s.stato_corrente
           WHERE s.id = NEW.id_segnalazione) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RF-33: si commentano solo le segnalazioni pubblicate';
  END IF;
END $$

DROP TRIGGER IF EXISTS trg_commento_bu $$
CREATE TRIGGER trg_commento_bu BEFORE UPDATE ON commento FOR EACH ROW
BEGIN
  IF NEW.id_segnalazione <> OLD.id_segnalazione OR NEW.id_autore <> OLD.id_autore THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Segnalazione e autore di un commento non si modificano';
  END IF;
END $$

DROP TRIGGER IF EXISTS trg_commento_ai $$
CREATE TRIGGER trg_commento_ai AFTER INSERT ON commento FOR EACH ROW
BEGIN
  IF NEW.stato = 'visibile' THEN
    CALL sp_ricalcola_punteggio(NEW.id_segnalazione);
  END IF;
END $$

DROP TRIGGER IF EXISTS trg_commento_au $$
CREATE TRIGGER trg_commento_au AFTER UPDATE ON commento FOR EACH ROW
BEGIN
  IF NEW.stato <> OLD.stato THEN
    CALL sp_ricalcola_punteggio(NEW.id_segnalazione);
    IF @lnc_id_utente IS NOT NULL THEN
      CALL sp_audit('moderazione_commento', 'commento', NEW.id,
                    JSON_OBJECT('stato', OLD.stato), JSON_OBJECT('stato', NEW.stato));
    END IF;
  END IF;
END $$

DROP TRIGGER IF EXISTS trg_commento_ad $$
CREATE TRIGGER trg_commento_ad AFTER DELETE ON commento FOR EACH ROW
  CALL sp_ricalcola_punteggio(OLD.id_segnalazione) $$

DROP TRIGGER IF EXISTS trg_aggiornamento_bi $$
CREATE TRIGGER trg_aggiornamento_bi BEFORE INSERT ON aggiornamento FOR EACH ROW
BEGIN
  IF NOT fn_utente_puo_scrivere(NEW.id_autore) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RD-14: utente non attivo o con provvedimento in corso';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM segnalazione s JOIN stato st ON st.codice = s.stato_corrente
                  WHERE s.id = NEW.id_segnalazione AND s.id_autore = NEW.id_autore AND st.pubblico) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RF-19: solo l''autore aggiorna una segnalazione pubblicata';
  END IF;
END $$

DROP TRIGGER IF EXISTS trg_aggiornamento_au $$
CREATE TRIGGER trg_aggiornamento_au AFTER UPDATE ON aggiornamento FOR EACH ROW
BEGIN
  IF NEW.stato <> OLD.stato AND @lnc_id_utente IS NOT NULL THEN
    CALL sp_audit('moderazione_aggiornamento', 'aggiornamento', NEW.id,
                  JSON_OBJECT('stato', OLD.stato), JSON_OBJECT('stato', NEW.stato));
  END IF;
END $$

-- -----------------------------------------------------------------------------
-- Trigger: segnalazioni di abuso (RF-34)
-- -----------------------------------------------------------------------------

DROP TRIGGER IF EXISTS trg_abuso_bi $$
CREATE TRIGGER trg_abuso_bi BEFORE INSERT ON segnalazione_abuso FOR EACH ROW
BEGIN
  DECLARE v_autore INT UNSIGNED;
  IF NOT fn_utente_puo_scrivere(NEW.id_segnalante) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RD-14: solo un utente verificato e senza provvedimenti può segnalare abusi';
  END IF;
  IF NEW.id_segnalazione IS NOT NULL THEN
    SELECT s.id_autore INTO v_autore FROM segnalazione s JOIN stato st ON st.codice = s.stato_corrente
     WHERE s.id = NEW.id_segnalazione AND st.pubblico;
  ELSEIF NEW.id_commento IS NOT NULL THEN
    SELECT id_autore INTO v_autore FROM commento WHERE id = NEW.id_commento AND stato <> 'nascosto';
  ELSE
    SELECT id_autore INTO v_autore FROM aggiornamento WHERE id = NEW.id_aggiornamento AND stato <> 'nascosto';
  END IF;
  IF v_autore IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RF-34: il contenuto non è visibile e non si può segnalare';
  END IF;
  IF v_autore = NEW.id_segnalante THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RF-34: non si può segnalare un proprio contenuto';
  END IF;
  SET NEW.esito = 'aperta', NEW.data_esito = NULL, NEW.id_moderatore = NULL;
END $$

-- soglia raggiunta (almeno N segnalazioni aperte e distinte) -> revisione
DROP TRIGGER IF EXISTS trg_abuso_ai $$
CREATE TRIGGER trg_abuso_ai AFTER INSERT ON segnalazione_abuso FOR EACH ROW
BEGIN
  DECLARE v_soglia INT;
  DECLARE v_n INT;
  SET v_soglia = fn_param('abuso.soglia_revisione');
  IF NEW.id_segnalazione IS NOT NULL THEN
    SELECT COUNT(*) INTO v_n FROM segnalazione_abuso WHERE id_segnalazione = NEW.id_segnalazione AND esito = 'aperta';
    IF v_n >= v_soglia AND (SELECT stato_corrente FROM segnalazione WHERE id = NEW.id_segnalazione) = 'PUBBLICATA' THEN
      CALL sp_cambia_stato(NEW.id_segnalazione, 'IN_REVISIONE', 'sistema', NULL,
                           CONCAT(v_n, ' segnalazioni di abuso da utenti distinti'), NULL);
    END IF;
  ELSEIF NEW.id_commento IS NOT NULL THEN
    SELECT COUNT(*) INTO v_n FROM segnalazione_abuso WHERE id_commento = NEW.id_commento AND esito = 'aperta';
    IF v_n >= v_soglia THEN
      UPDATE commento SET stato = 'in_revisione' WHERE id = NEW.id_commento AND stato = 'visibile';
    END IF;
  ELSE
    SELECT COUNT(*) INTO v_n FROM segnalazione_abuso WHERE id_aggiornamento = NEW.id_aggiornamento AND esito = 'aperta';
    IF v_n >= v_soglia THEN
      UPDATE aggiornamento SET stato = 'in_revisione' WHERE id = NEW.id_aggiornamento AND stato = 'visibile';
    END IF;
  END IF;
END $$

DROP TRIGGER IF EXISTS trg_abuso_bu $$
CREATE TRIGGER trg_abuso_bu BEFORE UPDATE ON segnalazione_abuso FOR EACH ROW
BEGIN
  IF NEW.id_segnalante <> OLD.id_segnalante
     OR NOT (NEW.id_segnalazione <=> OLD.id_segnalazione)
     OR NOT (NEW.id_commento <=> OLD.id_commento)
     OR NOT (NEW.id_aggiornamento <=> OLD.id_aggiornamento) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Il contenuto segnalato non si modifica';
  END IF;
  IF OLD.esito = 'aperta' AND NEW.esito <> 'aperta' THEN
    SET NEW.data_esito = COALESCE(NEW.data_esito, NOW());
    IF fn_livello_ruolo(NEW.id_moderatore) < 2 THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RF-43: l''esito lo decide un moderatore';
    END IF;
  END IF;
END $$

DROP TRIGGER IF EXISTS trg_abuso_au $$
CREATE TRIGGER trg_abuso_au AFTER UPDATE ON segnalazione_abuso FOR EACH ROW
BEGIN
  IF NEW.esito <> OLD.esito THEN
    CALL sp_audit('esito_abuso', 'segnalazione_abuso', NEW.id,
                  JSON_OBJECT('esito', OLD.esito), JSON_OBJECT('esito', NEW.esito));
  END IF;
END $$

-- -----------------------------------------------------------------------------
-- Trigger: provvedimenti (RF-44)
-- -----------------------------------------------------------------------------

DROP TRIGGER IF EXISTS trg_provvedimento_bi $$
CREATE TRIGGER trg_provvedimento_bi BEFORE INSERT ON provvedimento FOR EACH ROW
BEGIN
  IF fn_livello_ruolo(NEW.id_moderatore) < 2 OR NOT fn_utente_puo_scrivere(NEW.id_moderatore) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RF-44: solo un moderatore attivo emette provvedimenti';
  END IF;
  IF fn_livello_ruolo(NEW.id_destinatario) >= fn_livello_ruolo(NEW.id_moderatore) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RF-44: non si può sanzionare un pari grado o un superiore';
  END IF;
  SET NEW.revocato_il = NULL, NEW.id_revocato_da = NULL, NEW.motivazione_revoca = NULL;
END $$

DROP TRIGGER IF EXISTS trg_provvedimento_ai $$
CREATE TRIGGER trg_provvedimento_ai AFTER INSERT ON provvedimento FOR EACH ROW
BEGIN
  UPDATE utente SET stato_account = IF(NEW.tipo = 'ban', 'bannato', 'sospeso')
   WHERE id = NEW.id_destinatario AND stato_account <> 'cancellato';
  UPDATE token_utente SET revocato_il = NOW()
   WHERE id_utente = NEW.id_destinatario AND tipo = 'refresh' AND revocato_il IS NULL;
  CALL sp_audit('provvedimento', 'utente', NEW.id_destinatario, NULL,
                JSON_OBJECT('id_provvedimento', NEW.id, 'tipo', NEW.tipo, 'data_fine', NEW.data_fine,
                            'motivazione', NEW.motivazione));
END $$

-- si modifica solo per la revoca, riservata all'amministratore
DROP TRIGGER IF EXISTS trg_provvedimento_bu $$
CREATE TRIGGER trg_provvedimento_bu BEFORE UPDATE ON provvedimento FOR EACH ROW
BEGIN
  IF NEW.tipo <> OLD.tipo OR NEW.motivazione <> OLD.motivazione OR NEW.data_inizio <> OLD.data_inizio
     OR NOT (NEW.data_fine <=> OLD.data_fine) OR NEW.id_destinatario <> OLD.id_destinatario
     OR NEW.id_moderatore <> OLD.id_moderatore THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RF-44: un provvedimento si può solo revocare';
  END IF;
  IF OLD.revocato_il IS NOT NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RF-44: provvedimento già revocato';
  END IF;
  IF NEW.revocato_il IS NOT NULL AND fn_livello_ruolo(NEW.id_revocato_da) < 3 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RF-44: solo l''amministratore può revocare un provvedimento';
  END IF;
END $$

DROP TRIGGER IF EXISTS trg_provvedimento_au $$
CREATE TRIGGER trg_provvedimento_au AFTER UPDATE ON provvedimento FOR EACH ROW
BEGIN
  IF NEW.revocato_il IS NOT NULL AND OLD.revocato_il IS NULL THEN
    UPDATE utente SET stato_account = 'attivo'
     WHERE id = NEW.id_destinatario AND stato_account IN ('sospeso','bannato')
       AND email_verificata_il IS NOT NULL AND NOT fn_provvedimento_attivo(NEW.id_destinatario);
    CALL sp_audit('revoca_provvedimento', 'utente', NEW.id_destinatario, NULL,
                  JSON_OBJECT('id_provvedimento', NEW.id, 'motivazione_revoca', NEW.motivazione_revoca));
  END IF;
END $$

-- -----------------------------------------------------------------------------
-- Trigger: documento programmatico (RF-48, RD-21)
-- -----------------------------------------------------------------------------

DROP TRIGGER IF EXISTS trg_documento_bi $$
CREATE TRIGGER trg_documento_bi BEFORE INSERT ON documento_programmatico FOR EACH ROW
BEGIN
  IF fn_livello_ruolo(NEW.id_amministratore) < 3 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RF-48: il documento è gestito da un amministratore';
  END IF;
  IF NEW.stato <> 'bozza' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RF-48: un documento nasce in bozza';
  END IF;
END $$

DROP TRIGGER IF EXISTS trg_documento_bu $$
CREATE TRIGGER trg_documento_bu BEFORE UPDATE ON documento_programmatico FOR EACH ROW
BEGIN
  IF OLD.stato = 'inviato' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RF-48: un documento inviato non si modifica; crearne una nuova versione';
  END IF;
  IF NEW.stato = 'inviato' AND NOT EXISTS (SELECT 1 FROM invio_documento WHERE id_documento = NEW.id) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RF-48: l''invio si esegue con sp_invia_documento';
  END IF;
END $$

DROP TRIGGER IF EXISTS trg_documento_au $$
CREATE TRIGGER trg_documento_au AFTER UPDATE ON documento_programmatico FOR EACH ROW
BEGIN
  IF NEW.stato <> OLD.stato THEN
    CALL sp_audit('stato_documento', 'documento_programmatico', NEW.id,
                  JSON_OBJECT('stato', OLD.stato), JSON_OBJECT('stato', NEW.stato));
  END IF;
END $$

DROP TRIGGER IF EXISTS trg_docseg_bi $$
CREATE TRIGGER trg_docseg_bi BEFORE INSERT ON documento_segnalazione FOR EACH ROW
BEGIN
  IF (SELECT stato FROM documento_programmatico WHERE id = NEW.id_documento) <> 'bozza' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RF-48: il contenuto si modifica solo con il documento in bozza';
  END IF;
  IF (SELECT stato_corrente FROM segnalazione WHERE id = NEW.id_segnalazione) NOT IN ('PRESA_IN_CARICO','INVIATA_CANDIDATI') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RD-21: si includono solo segnalazioni Prese in carico o già inviate';
  END IF;
END $$

DROP TRIGGER IF EXISTS trg_docseg_bu $$
CREATE TRIGGER trg_docseg_bu BEFORE UPDATE ON documento_segnalazione FOR EACH ROW
BEGIN
  IF (SELECT stato FROM documento_programmatico WHERE id = OLD.id_documento) <> 'bozza'
     OR NEW.id_documento <> OLD.id_documento OR NEW.id_segnalazione <> OLD.id_segnalazione THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RF-48: il contenuto si modifica solo con il documento in bozza';
  END IF;
END $$

DROP TRIGGER IF EXISTS trg_docseg_bd $$
CREATE TRIGGER trg_docseg_bd BEFORE DELETE ON documento_segnalazione FOR EACH ROW
BEGIN
  IF (SELECT stato FROM documento_programmatico WHERE id = OLD.id_documento) <> 'bozza' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RF-48: il contenuto si modifica solo con il documento in bozza';
  END IF;
END $$

DROP TRIGGER IF EXISTS trg_invio_bi $$
CREATE TRIGGER trg_invio_bi BEFORE INSERT ON invio_documento FOR EACH ROW
BEGIN
  IF (SELECT stato FROM documento_programmatico WHERE id = NEW.id_documento) <> 'definitivo' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RF-48: l''invio si esegue con sp_invia_documento';
  END IF;
END $$

DROP TRIGGER IF EXISTS trg_invio_bu $$
CREATE TRIGGER trg_invio_bu BEFORE UPDATE ON invio_documento FOR EACH ROW
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RF-48: il registro degli invii non si modifica' $$

DROP TRIGGER IF EXISTS trg_invio_bd $$
CREATE TRIGGER trg_invio_bd BEFORE DELETE ON invio_documento FOR EACH ROW
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RF-48: il registro degli invii non si cancella' $$

DELIMITER ;
