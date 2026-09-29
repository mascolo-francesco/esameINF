-- =============================================================================
-- La Nostra Città, Il Nostro Futuro — schema relazionale (MySQL 8.4, Aiven)
-- Tracciabilità: i codici RF / RIA / RD / RNF rimandano al documento
-- "Analisi_Requisiti_La_Nostra_Citta.pdf".
--
-- Note sul server Aiven:
--   * sql_mode contiene ANSI_QUOTES: le stringhe vanno tra apici singoli.
--   * sql_require_primary_key = ON: ogni tabella ha una chiave primaria.
--   * Coordinate in WGS84 (SRID 4326). Con SRID 4326 MySQL usa POINT(lon, lat).
-- =============================================================================

SET NAMES utf8mb4;

-- -----------------------------------------------------------------------------
-- Ruoli e territorio
-- -----------------------------------------------------------------------------

CREATE TABLE ruolo (
  id           TINYINT UNSIGNED NOT NULL,
  codice       VARCHAR(20)      NOT NULL,
  nome         VARCHAR(40)      NOT NULL,
  descrizione  VARCHAR(255)     NULL,
  livello      TINYINT UNSIGNED NOT NULL,  -- ruoli cumulativi verso l'alto (2.3)
  PRIMARY KEY (id),
  UNIQUE KEY uq_ruolo_codice (codice),
  UNIQUE KEY uq_ruolo_livello (livello)
) ENGINE=InnoDB;

CREATE TABLE municipio (
  id       TINYINT UNSIGNED NOT NULL,
  nome     VARCHAR(50)      NOT NULL,
  confine  GEOMETRY         NULL SRID 4326,
  PRIMARY KEY (id),
  UNIQUE KEY uq_municipio_nome (nome),
  CONSTRAINT ck_municipio_id CHECK (id BETWEEN 1 AND 9)
) ENGINE=InnoDB;

-- NIL (Nuclei di Identità Locale). id = ID_NIL ufficiale del Comune di Milano.
CREATE TABLE quartiere (
  id            SMALLINT UNSIGNED NOT NULL,
  nome          VARCHAR(100)      NOT NULL,
  id_municipio  TINYINT UNSIGNED  NOT NULL,
  confine       GEOMETRY          NOT NULL SRID 4326,
  attivo        BOOLEAN           NOT NULL DEFAULT TRUE,
  PRIMARY KEY (id),
  UNIQUE KEY uq_quartiere_nome (nome),
  KEY idx_quartiere_municipio (id_municipio),
  SPATIAL KEY sidx_quartiere_confine (confine),
  CONSTRAINT fk_quartiere_municipio FOREIGN KEY (id_municipio) REFERENCES municipio (id)
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- Utenti, autenticazione, accessi
-- -----------------------------------------------------------------------------

CREATE TABLE utente (
  id                         INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  -- dati personali: NULL solo dopo l'anonimizzazione (RF-08, RD-18)
  nome                       VARCHAR(50)      NULL,
  cognome                    VARCHAR(50)      NULL,
  email                      VARCHAR(254)     NULL,
  password_hash              VARCHAR(255)     NULL,  -- Argon2id/bcrypt (RNF-02); NULL se solo SPID/OAuth (RF-04)
  data_nascita               DATE             NULL,
  telefono                   VARCHAR(20)      NULL,
  telefono_verificato_il     DATETIME         NULL,
  nome_visualizzato          VARCHAR(40)      NOT NULL,
  mostra_nome_reale          BOOLEAN          NOT NULL DEFAULT FALSE,   -- RF-07
  foto_profilo               VARCHAR(500)     NULL,                     -- RF-06
  stato_account              ENUM('non_verificato','attivo','sospeso','bannato','cancellato')
                                              NOT NULL DEFAULT 'non_verificato',
  email_verificata_il        DATETIME         NULL,
  consenso_privacy_il        DATETIME         NULL,
  consenso_notifiche         BOOLEAN          NOT NULL DEFAULT FALSE,   -- RNF-09
  consenso_addestramento_ia  BOOLEAN          NOT NULL DEFAULT FALSE,   -- RNF-09
  notifiche_email            BOOLEAN          NOT NULL DEFAULT TRUE,    -- preferenze RF-06
  notifiche_inapp            BOOLEAN          NOT NULL DEFAULT TRUE,
  totp_attivo                BOOLEAN          NOT NULL DEFAULT FALSE,   -- RF-10
  totp_segreto               VARBINARY(255)   NULL,                     -- cifrato dall'applicazione
  tentativi_falliti          TINYINT UNSIGNED NOT NULL DEFAULT 0,       -- RF-03
  bloccato_fino_a            DATETIME         NULL,                     -- RF-03
  data_registrazione         DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ultimo_accesso             DATETIME         NULL,
  cancellazione_richiesta_il DATETIME         NULL,                     -- RF-08
  anonimizzato_il            DATETIME         NULL,                     -- RF-08, RD-18
  id_ruolo                   TINYINT UNSIGNED NOT NULL DEFAULT 1,
  id_quartiere               SMALLINT UNSIGNED NULL,                    -- obbligatorio in registrazione (RF-01); NULL dopo anonimizzazione
  PRIMARY KEY (id),
  UNIQUE KEY uq_utente_email ((LOWER(email))),                          -- RD-01
  KEY idx_utente_ruolo (id_ruolo),
  KEY idx_utente_quartiere (id_quartiere),
  KEY idx_utente_stato (stato_account),
  CONSTRAINT fk_utente_ruolo     FOREIGN KEY (id_ruolo)     REFERENCES ruolo (id),
  CONSTRAINT fk_utente_quartiere FOREIGN KEY (id_quartiere) REFERENCES quartiere (id),
  -- dati obbligatori finché l'account non è anonimizzato (RF-01)
  CONSTRAINT ck_utente_dati_obbligatori CHECK (
    anonimizzato_il IS NOT NULL
    OR (nome IS NOT NULL AND cognome IS NOT NULL AND email IS NOT NULL
        AND data_nascita IS NOT NULL AND consenso_privacy_il IS NOT NULL)),
  CONSTRAINT ck_utente_email CHECK (email IS NULL OR email LIKE '%_@_%._%'),
  -- RD-02: almeno 14 anni alla registrazione
  CONSTRAINT ck_utente_eta_minima CHECK (
    data_nascita IS NULL OR data_nascita <= DATE(data_registrazione) - INTERVAL 14 YEAR),
  -- RF-02: nessun account attivo senza email verificata
  CONSTRAINT ck_utente_verifica CHECK (stato_account <> 'attivo' OR email_verificata_il IS NOT NULL),
  CONSTRAINT ck_utente_anonimizzato CHECK (
    anonimizzato_il IS NULL OR stato_account = 'cancellato'),
  CONSTRAINT ck_utente_totp CHECK (totp_attivo = FALSE OR totp_segreto IS NOT NULL)
) ENGINE=InnoDB;

-- Token monouso e di sessione (RF-02 verifica email, RF-05 reset password,
-- RNF-03 refresh token revocabile). Si salva solo l'hash del token.
CREATE TABLE token_utente (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_utente    INT UNSIGNED    NOT NULL,
  tipo         ENUM('verifica_email','verifica_telefono','reset_password','refresh') NOT NULL,
  token_hash   CHAR(64)        NOT NULL,   -- SHA-256 esadecimale
  creato_il    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  scade_il     DATETIME        NOT NULL,
  usato_il     DATETIME        NULL,
  revocato_il  DATETIME        NULL,
  indirizzo_ip VARCHAR(45)     NULL,
  user_agent   VARCHAR(255)    NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_token_hash (token_hash),
  KEY idx_token_utente (id_utente, tipo),
  KEY idx_token_scadenza (scade_il),
  CONSTRAINT fk_token_utente FOREIGN KEY (id_utente) REFERENCES utente (id) ON DELETE CASCADE,
  CONSTRAINT ck_token_scadenza CHECK (scade_il > creato_il)
) ENGINE=InnoDB;

-- Registro dei tentativi di accesso: blocco dopo 5 errori in 15 minuti (RF-03),
-- rate limiting (RNF-06), conservazione 6 mesi (RNF-12).
CREATE TABLE accesso_log (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_utente     INT UNSIGNED    NULL,
  email_tentata VARCHAR(254)    NULL,
  indirizzo_ip  VARCHAR(45)     NOT NULL,
  esito         ENUM('successo','password_errata','totp_errato','utente_inesistente','account_bloccato','account_non_attivo') NOT NULL,
  data_ora      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_accesso_email (email_tentata, data_ora),
  KEY idx_accesso_ip (indirizzo_ip, data_ora),
  KEY idx_accesso_utente (id_utente, data_ora),
  KEY idx_accesso_data (data_ora),
  CONSTRAINT fk_accesso_utente FOREIGN KEY (id_utente) REFERENCES utente (id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- Configurazione: parametri, stati, transizioni, categorie
-- -----------------------------------------------------------------------------

-- Soglie IA, pesi della formula di priorità, limiti anti-spam (RF-45, RIA-06, 7.3)
CREATE TABLE parametro_sistema (
  chiave          VARCHAR(60)    NOT NULL,
  valore          DECIMAL(12,4)  NOT NULL,
  valore_min      DECIMAL(12,4)  NOT NULL,
  valore_max      DECIMAL(12,4)  NOT NULL,
  unita           VARCHAR(20)    NULL,
  descrizione     VARCHAR(255)   NOT NULL,
  data_modifica   DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  id_utente_modifica INT UNSIGNED NULL,
  PRIMARY KEY (chiave),
  CONSTRAINT fk_parametro_utente FOREIGN KEY (id_utente_modifica) REFERENCES utente (id),
  CONSTRAINT ck_parametro_intervallo CHECK (valore BETWEEN valore_min AND valore_max)
) ENGINE=InnoDB;

CREATE TABLE stato (
  codice        VARCHAR(20)      NOT NULL,
  nome          VARCHAR(40)      NOT NULL,
  descrizione   VARCHAR(255)     NOT NULL,
  finale        BOOLEAN          NOT NULL,
  pubblico      BOOLEAN          NOT NULL,
  votabile      BOOLEAN          NOT NULL,
  in_classifica BOOLEAN          NOT NULL,
  ordine        TINYINT UNSIGNED NOT NULL,
  PRIMARY KEY (codice),
  UNIQUE KEY uq_stato_nome (nome),
  CONSTRAINT ck_stato_votabile CHECK (votabile = FALSE OR pubblico = TRUE),
  CONSTRAINT ck_stato_classifica CHECK (in_classifica = FALSE OR pubblico = TRUE)
) ENGINE=InnoDB;

-- Transizioni ammesse (tabella 4.2, RD-10). "attore" sostituisce ruolo_minimo:
-- autore e sistema non sono ruoli. 'moderatore' ammette anche l'amministratore.
CREATE TABLE transizione_ammessa (
  stato_da                  VARCHAR(20)  NOT NULL,
  stato_a                   VARCHAR(20)  NOT NULL,
  attore                    ENUM('autore','sistema','moderatore','amministratore') NOT NULL,
  motivazione_obbligatoria  BOOLEAN      NOT NULL DEFAULT FALSE,
  condizione                VARCHAR(255) NOT NULL,
  PRIMARY KEY (stato_da, stato_a, attore),
  KEY idx_transizione_a (stato_a),
  CONSTRAINT fk_transizione_da FOREIGN KEY (stato_da) REFERENCES stato (codice),
  CONSTRAINT fk_transizione_a  FOREIGN KEY (stato_a)  REFERENCES stato (codice),
  CONSTRAINT ck_transizione_diversa CHECK (stato_da <> stato_a)
) ENGINE=InnoDB;

CREATE TABLE categoria (
  id            SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nome          VARCHAR(50)       NOT NULL,
  descrizione   VARCHAR(255)      NOT NULL,
  colore_mappa  CHAR(7)           NOT NULL,
  attiva        BOOLEAN           NOT NULL DEFAULT TRUE,
  ordine        TINYINT UNSIGNED  NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uq_categoria_nome (nome),
  CONSTRAINT ck_categoria_colore CHECK (REGEXP_LIKE(colore_mappa, '^#[0-9A-Fa-f]{6}$', 'c'))
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- Segnalazioni
-- -----------------------------------------------------------------------------

-- Contatore annuale per codice_pubblico MI-AAAA-NNNNNN
CREATE TABLE sequenza_codice (
  anno    SMALLINT UNSIGNED NOT NULL,
  ultimo  INT UNSIGNED      NOT NULL,
  PRIMARY KEY (anno)
) ENGINE=InnoDB;

CREATE TABLE segnalazione (
  id                          INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  codice_pubblico             VARCHAR(20)       NOT NULL,          -- generato dal trigger
  titolo                      VARCHAR(100)      NULL,              -- NULL ammesso solo in Bozza
  descrizione                 VARCHAR(2000)     NULL,
  tipo                        ENUM('problema','proposta') NOT NULL DEFAULT 'problema',  -- RF-12
  latitudine                  DECIMAL(9,6)      NOT NULL,
  longitudine                 DECIMAL(9,6)      NOT NULL,
  posizione                   POINT GENERATED ALWAYS AS (ST_SRID(POINT(longitudine, latitudine), 4326)) STORED NOT NULL SRID 4326,
  indirizzo                   VARCHAR(255)      NULL,
  fonte_posizione             ENUM('exif','gps','manuale') NOT NULL,   -- RF-13
  stato_corrente              VARCHAR(20)       NOT NULL DEFAULT 'BOZZA',
  data_stato_corrente         DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data_creazione              DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data_invio                  DATETIME          NULL,
  data_pubblicazione          DATETIME          NULL,              -- per la vista "Di tendenza" (7.3)
  data_modifica               DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  num_sostegni                INT UNSIGNED      NOT NULL DEFAULT 0,        -- derivato (7.3)
  num_commentatori            INT UNSIGNED      NOT NULL DEFAULT 0,        -- derivato: C_u
  punteggio_priorita          DECIMAL(10,2)     NOT NULL DEFAULT 0,        -- derivato: P
  foto_datata                 BOOLEAN           NOT NULL DEFAULT FALSE,    -- RIA-13
  id_autore                   INT UNSIGNED      NOT NULL,
  id_quartiere                SMALLINT UNSIGNED NOT NULL,                  -- ricavato dalle coordinate (RF-14)
  id_segnalazione_principale  INT UNSIGNED      NULL,                      -- solo se Unita (RF-30)
  PRIMARY KEY (id),
  UNIQUE KEY uq_segnalazione_codice (codice_pubblico),
  KEY idx_segnalazione_classifica (stato_corrente, punteggio_priorita),
  KEY idx_segnalazione_stato_data (stato_corrente, data_stato_corrente),
  KEY idx_segnalazione_autore (id_autore, data_invio),
  KEY idx_segnalazione_quartiere (id_quartiere),
  KEY idx_segnalazione_pubblicazione (data_pubblicazione),
  KEY idx_segnalazione_principale (id_segnalazione_principale),
  SPATIAL KEY sidx_segnalazione_posizione (posizione),                   -- RNF-18
  FULLTEXT KEY ftx_segnalazione_testo (titolo, descrizione),              -- RF-40
  CONSTRAINT fk_segnalazione_stato      FOREIGN KEY (stato_corrente) REFERENCES stato (codice),
  CONSTRAINT fk_segnalazione_autore     FOREIGN KEY (id_autore)      REFERENCES utente (id),
  CONSTRAINT fk_segnalazione_quartiere  FOREIGN KEY (id_quartiere)   REFERENCES quartiere (id),
  CONSTRAINT fk_segnalazione_principale FOREIGN KEY (id_segnalazione_principale) REFERENCES segnalazione (id),
  -- RD-16
  CONSTRAINT ck_segnalazione_titolo CHECK (titolo IS NULL OR CHAR_LENGTH(titolo) BETWEEN 10 AND 100),
  CONSTRAINT ck_segnalazione_descrizione CHECK (descrizione IS NULL OR CHAR_LENGTH(descrizione) BETWEEN 30 AND 2000),
  CONSTRAINT ck_segnalazione_completa CHECK (
    stato_corrente = 'BOZZA' OR (titolo IS NOT NULL AND descrizione IS NOT NULL)),
  -- RD-04: riquadro di controllo; il point-in-polygon lo fa il trigger
  CONSTRAINT ck_segnalazione_bbox CHECK (
    latitudine BETWEEN 45.38 AND 45.54 AND longitudine BETWEEN 9.04 AND 9.28),
  -- RD-12 (il "non punta a sé stessa" è nel trigger: CHECK non può usare colonne AUTO_INCREMENT)
  CONSTRAINT ck_segnalazione_unita CHECK (
    (stato_corrente = 'UNITA') = (id_segnalazione_principale IS NOT NULL)),
  CONSTRAINT ck_segnalazione_date CHECK (
    (data_invio IS NULL OR data_invio >= data_creazione)
    AND (data_pubblicazione IS NULL OR data_invio IS NOT NULL))
) ENGINE=InnoDB;

CREATE TABLE allegato (
  id                  INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  id_segnalazione     INT UNSIGNED      NOT NULL,
  tipo                ENUM('foto','video') NOT NULL,
  mime_type           VARCHAR(40)       NOT NULL,
  dimensione_byte     INT UNSIGNED      NOT NULL,
  durata_sec          DECIMAL(5,1)      NULL,
  larghezza           SMALLINT UNSIGNED NULL,
  altezza             SMALLINT UNSIGNED NULL,
  percorso_originale  VARCHAR(500)      NOT NULL,   -- storage privato (RNF-07)
  percorso_pubblico   VARCHAR(500)      NULL,       -- senza EXIF, sfocato (RF-23, RF-25)
  percorso_miniatura  VARCHAR(500)      NULL,       -- RF-24
  stato_elaborazione  ENUM('caricato','in_elaborazione','pronto','errore') NOT NULL DEFAULT 'caricato',
  hash_sha256         CHAR(64)          NOT NULL,
  hash_percettivo     CHAR(16)          NULL,       -- pHash 64 bit (RIA-15)
  exif_latitudine     DECIMAL(9,6)      NULL,       -- mai pubblicate (RNF-14)
  exif_longitudine    DECIMAL(9,6)      NULL,
  exif_altitudine     DECIMAL(7,2)      NULL,
  exif_data_scatto    DATETIME          NULL,
  exif_dispositivo    VARCHAR(100)      NULL,
  ordine              TINYINT UNSIGNED  NOT NULL,
  data_caricamento    DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_allegato_ordine (id_segnalazione, ordine),
  KEY idx_allegato_sha (hash_sha256),
  KEY idx_allegato_phash (hash_percettivo),
  CONSTRAINT fk_allegato_segnalazione FOREIGN KEY (id_segnalazione) REFERENCES segnalazione (id) ON DELETE CASCADE,  -- RD-17
  -- RF-21
  CONSTRAINT ck_allegato_ordine CHECK (ordine BETWEEN 1 AND 5),
  CONSTRAINT ck_allegato_foto CHECK (
    tipo <> 'foto' OR (mime_type IN ('image/jpeg','image/png','image/heic','image/webp')
                       AND dimensione_byte <= 10485760 AND durata_sec IS NULL)),
  CONSTRAINT ck_allegato_video CHECK (
    tipo <> 'video' OR (mime_type IN ('video/mp4','video/quicktime')
                        AND dimensione_byte <= 52428800 AND durata_sec IS NOT NULL AND durata_sec <= 60)),
  CONSTRAINT ck_allegato_pubblico CHECK (stato_elaborazione <> 'pronto' OR percorso_pubblico IS NOT NULL),
  CONSTRAINT ck_allegato_exif CHECK (
    (exif_latitudine IS NULL) = (exif_longitudine IS NULL)
    AND (exif_latitudine IS NULL OR exif_latitudine BETWEEN -90 AND 90)
    AND (exif_longitudine IS NULL OR exif_longitudine BETWEEN -180 AND 180)),
  CONSTRAINT ck_allegato_sha CHECK (REGEXP_LIKE(hash_sha256, '^[0-9a-f]{64}$', 'c'))
) ENGINE=InnoDB;

-- Associazione N:M "Classificata" (RF-15, RIA-09, RIA-10)
CREATE TABLE classificazione (
  id_segnalazione  INT UNSIGNED      NOT NULL,
  id_categoria     SMALLINT UNSIGNED NOT NULL,
  origine          ENUM('ia','utente','moderatore') NOT NULL,
  confidenza_ia    DECIMAL(4,3)      NULL,
  confermata       BOOLEAN           NOT NULL DEFAULT FALSE,
  data             DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data_modifica    DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_segnalazione, id_categoria),
  KEY idx_classificazione_categoria (id_categoria, confermata),
  CONSTRAINT fk_classificazione_segnalazione FOREIGN KEY (id_segnalazione) REFERENCES segnalazione (id) ON DELETE CASCADE,
  CONSTRAINT fk_classificazione_categoria    FOREIGN KEY (id_categoria)    REFERENCES categoria (id),
  CONSTRAINT ck_classificazione_confidenza CHECK (confidenza_ia IS NULL OR confidenza_ia BETWEEN 0 AND 1),  -- RD-13
  CONSTRAINT ck_classificazione_ia CHECK (origine <> 'ia' OR confidenza_ia IS NOT NULL)
) ENGINE=InnoDB;

-- Storico dei cambi di stato: sola aggiunta (RF-27, RD-09, RD-11, RD-19)
CREATE TABLE storico_stato (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_segnalazione  INT UNSIGNED    NOT NULL,
  stato_da         VARCHAR(20)     NOT NULL,
  stato_a          VARCHAR(20)     NOT NULL,
  data_ora         DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  attore           ENUM('autore','sistema','moderatore','amministratore') NOT NULL,
  id_utente        INT UNSIGNED    NULL,     -- NULL = sistema / IA
  motivazione      VARCHAR(1000)   NULL,
  PRIMARY KEY (id),
  KEY idx_storico_segnalazione (id_segnalazione, id),
  KEY idx_storico_stato_a (stato_a, data_ora),
  KEY idx_storico_utente (id_utente),
  CONSTRAINT fk_storico_segnalazione FOREIGN KEY (id_segnalazione) REFERENCES segnalazione (id),
  CONSTRAINT fk_storico_da      FOREIGN KEY (stato_da)  REFERENCES stato (codice),
  CONSTRAINT fk_storico_a       FOREIGN KEY (stato_a)   REFERENCES stato (codice),
  CONSTRAINT fk_storico_utente  FOREIGN KEY (id_utente) REFERENCES utente (id),
  CONSTRAINT ck_storico_motivazione CHECK (                       -- RD-11
    stato_a NOT IN ('RIFIUTATA','DA_INTEGRARE')
    OR (motivazione IS NOT NULL AND CHAR_LENGTH(TRIM(motivazione)) > 0)),
  CONSTRAINT ck_storico_sistema CHECK ((attore = 'sistema') = (id_utente IS NULL))
) ENGINE=InnoDB;

-- Associazione N:M "Sostiene" (RF-31, RD-05). peso = w_i al momento del voto (7.3).
CREATE TABLE sostegno (
  id_utente        INT UNSIGNED  NOT NULL,
  id_segnalazione  INT UNSIGNED  NOT NULL,
  data             DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  peso             DECIMAL(4,2)  NOT NULL DEFAULT 1,
  indirizzo_ip     VARCHAR(45)   NULL,        -- analisi di voti sospetti (rischio 9.3)
  PRIMARY KEY (id_utente, id_segnalazione),
  KEY idx_sostegno_segnalazione (id_segnalazione),
  CONSTRAINT fk_sostegno_utente       FOREIGN KEY (id_utente)       REFERENCES utente (id),
  CONSTRAINT fk_sostegno_segnalazione FOREIGN KEY (id_segnalazione) REFERENCES segnalazione (id),
  CONSTRAINT ck_sostegno_peso CHECK (peso > 0)
) ENGINE=InnoDB;

-- RF-37
CREATE TABLE segue (
  id_utente        INT UNSIGNED NOT NULL,
  id_segnalazione  INT UNSIGNED NOT NULL,
  data             DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_utente, id_segnalazione),
  KEY idx_segue_segnalazione (id_segnalazione),
  CONSTRAINT fk_segue_utente       FOREIGN KEY (id_utente)       REFERENCES utente (id) ON DELETE CASCADE,
  CONSTRAINT fk_segue_segnalazione FOREIGN KEY (id_segnalazione) REFERENCES segnalazione (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- RF-33. Nasce 'in_revisione' e diventa 'visibile' dopo il filtro IA (RIA-04, fail-safe).
CREATE TABLE commento (
  id               INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  id_segnalazione  INT UNSIGNED  NOT NULL,
  id_autore        INT UNSIGNED  NOT NULL,
  testo            VARCHAR(1000) NOT NULL,
  stato            ENUM('visibile','in_revisione','nascosto') NOT NULL DEFAULT 'in_revisione',
  data             DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data_modifica    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_commento_segnalazione (id_segnalazione, stato, data),
  KEY idx_commento_autore (id_autore),
  KEY idx_commento_stato (stato, data),
  CONSTRAINT fk_commento_segnalazione FOREIGN KEY (id_segnalazione) REFERENCES segnalazione (id),
  CONSTRAINT fk_commento_autore       FOREIGN KEY (id_autore)       REFERENCES utente (id),
  CONSTRAINT ck_commento_testo CHECK (CHAR_LENGTH(TRIM(testo)) BETWEEN 1 AND 1000)   -- RD-16
) ENGINE=InnoDB;

-- RF-19: dopo la pubblicazione l'autore può solo aggiungere aggiornamenti.
CREATE TABLE aggiornamento (
  id               INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  id_segnalazione  INT UNSIGNED  NOT NULL,
  id_autore        INT UNSIGNED  NOT NULL,
  testo            VARCHAR(1000) NOT NULL,
  stato            ENUM('visibile','in_revisione','nascosto') NOT NULL DEFAULT 'in_revisione',
  data             DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_aggiornamento_segnalazione (id_segnalazione, stato, data),
  KEY idx_aggiornamento_stato (stato, data),
  CONSTRAINT fk_aggiornamento_segnalazione FOREIGN KEY (id_segnalazione) REFERENCES segnalazione (id),
  CONSTRAINT fk_aggiornamento_autore       FOREIGN KEY (id_autore)       REFERENCES utente (id),
  CONSTRAINT ck_aggiornamento_testo CHECK (CHAR_LENGTH(TRIM(testo)) BETWEEN 1 AND 1000)
) ENGINE=InnoDB;

-- RF-34. Esattamente un oggetto di riferimento (RD-15).
CREATE TABLE segnalazione_abuso (
  id                 INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  id_segnalante      INT UNSIGNED  NOT NULL,
  id_segnalazione    INT UNSIGNED  NULL,
  id_commento        INT UNSIGNED  NULL,
  id_aggiornamento   INT UNSIGNED  NULL,
  motivo             ENUM('offensivo','odio_discriminazione','spam','falso','fuori_tema','dati_personali','altro') NOT NULL,
  nota               VARCHAR(500)  NULL,
  data               DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  esito              ENUM('aperta','accolta','respinta') NOT NULL DEFAULT 'aperta',
  data_esito         DATETIME      NULL,
  id_moderatore      INT UNSIGNED  NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_abuso_segnalazione (id_segnalante, id_segnalazione),     -- "segnalazioni distinte"
  UNIQUE KEY uq_abuso_commento (id_segnalante, id_commento),
  UNIQUE KEY uq_abuso_aggiornamento (id_segnalante, id_aggiornamento),
  KEY idx_abuso_esito (esito, data),
  KEY idx_abuso_segnalazione (id_segnalazione, esito),
  KEY idx_abuso_commento (id_commento, esito),
  KEY idx_abuso_aggiornamento (id_aggiornamento, esito),
  CONSTRAINT fk_abuso_segnalante    FOREIGN KEY (id_segnalante)    REFERENCES utente (id),
  CONSTRAINT fk_abuso_segnalazione  FOREIGN KEY (id_segnalazione)  REFERENCES segnalazione (id),
  CONSTRAINT fk_abuso_commento      FOREIGN KEY (id_commento)      REFERENCES commento (id),
  CONSTRAINT fk_abuso_aggiornamento FOREIGN KEY (id_aggiornamento) REFERENCES aggiornamento (id),
  CONSTRAINT fk_abuso_moderatore    FOREIGN KEY (id_moderatore)    REFERENCES utente (id),
  CONSTRAINT ck_abuso_oggetto CHECK (
    (id_segnalazione IS NOT NULL) + (id_commento IS NOT NULL) + (id_aggiornamento IS NOT NULL) = 1),
  CONSTRAINT ck_abuso_esito CHECK (
    (esito = 'aperta') = (data_esito IS NULL) AND (esito = 'aperta') = (id_moderatore IS NULL))
) ENGINE=InnoDB;

-- Esecuzioni dei moduli IA (RIA-02). Esattamente un oggetto analizzato (RD-15).
CREATE TABLE analisi_ia (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  modulo            ENUM('moderazione','classificazione','exif','coerenza_visiva',
                         'immagini_inappropriate','duplicati','volti_targhe') NOT NULL,
  versione_modello  VARCHAR(100)    NOT NULL,
  esito             ENUM('ok','da_revisionare','bloccato','errore','timeout') NOT NULL,
  punteggio         DECIMAL(4,3)    NULL,
  dettagli          JSON            NULL,     -- es. punteggi per classe (RIA-05), categorie proposte
  durata_ms         INT UNSIGNED    NULL,
  data              DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  id_segnalazione   INT UNSIGNED    NULL,
  id_allegato       INT UNSIGNED    NULL,
  id_commento       INT UNSIGNED    NULL,
  id_aggiornamento  INT UNSIGNED    NULL,
  PRIMARY KEY (id),
  KEY idx_analisi_segnalazione (id_segnalazione, modulo),
  KEY idx_analisi_allegato (id_allegato, modulo),
  KEY idx_analisi_commento (id_commento),
  KEY idx_analisi_aggiornamento (id_aggiornamento),
  KEY idx_analisi_modulo_data (modulo, data),
  CONSTRAINT fk_analisi_segnalazione  FOREIGN KEY (id_segnalazione)  REFERENCES segnalazione (id),
  CONSTRAINT fk_analisi_allegato      FOREIGN KEY (id_allegato)      REFERENCES allegato (id),
  CONSTRAINT fk_analisi_commento      FOREIGN KEY (id_commento)      REFERENCES commento (id),
  CONSTRAINT fk_analisi_aggiornamento FOREIGN KEY (id_aggiornamento) REFERENCES aggiornamento (id),
  CONSTRAINT ck_analisi_punteggio CHECK (punteggio IS NULL OR punteggio BETWEEN 0 AND 1),  -- RD-13
  CONSTRAINT ck_analisi_oggetto CHECK (
    (id_segnalazione IS NOT NULL) + (id_allegato IS NOT NULL)
    + (id_commento IS NOT NULL) + (id_aggiornamento IS NOT NULL) = 1)
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- Moderazione utenti e documento programmatico
-- -----------------------------------------------------------------------------

-- RF-44. Destinatario e moderatore sono due ruoli distinti di UTENTE.
CREATE TABLE provvedimento (
  id                INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  tipo              ENUM('sospensione','ban') NOT NULL,
  motivazione       VARCHAR(1000) NOT NULL,
  data_inizio       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data_fine         DATETIME      NULL,          -- NULL = permanente
  revocato_il       DATETIME      NULL,
  motivazione_revoca VARCHAR(1000) NULL,
  id_destinatario   INT UNSIGNED  NOT NULL,
  id_moderatore     INT UNSIGNED  NOT NULL,
  id_revocato_da    INT UNSIGNED  NULL,
  PRIMARY KEY (id),
  KEY idx_provvedimento_destinatario (id_destinatario, revocato_il, data_fine),
  KEY idx_provvedimento_moderatore (id_moderatore),
  CONSTRAINT fk_provvedimento_destinatario FOREIGN KEY (id_destinatario) REFERENCES utente (id),
  CONSTRAINT fk_provvedimento_moderatore   FOREIGN KEY (id_moderatore)   REFERENCES utente (id),
  CONSTRAINT fk_provvedimento_revocato_da  FOREIGN KEY (id_revocato_da)  REFERENCES utente (id),
  CONSTRAINT ck_provvedimento_date CHECK (data_fine IS NULL OR data_fine > data_inizio),       -- RD-20
  CONSTRAINT ck_provvedimento_tipo CHECK ((tipo = 'ban') = (data_fine IS NULL)),
  CONSTRAINT ck_provvedimento_revoca CHECK (
    (revocato_il IS NULL) = (id_revocato_da IS NULL)
    AND (revocato_il IS NULL OR revocato_il >= data_inizio)),
  CONSTRAINT ck_provvedimento_se_stesso CHECK (id_destinatario <> id_moderatore)
) ENGINE=InnoDB;

CREATE TABLE candidato (
  id                INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nome              VARCHAR(50)  NOT NULL,
  cognome           VARCHAR(50)  NOT NULL,
  lista_coalizione  VARCHAR(150) NOT NULL,
  email_contatto    VARCHAR(254) NOT NULL,
  attivo            BOOLEAN      NOT NULL DEFAULT TRUE,
  PRIMARY KEY (id),
  UNIQUE KEY uq_candidato_email ((LOWER(email_contatto))),
  CONSTRAINT ck_candidato_email CHECK (email_contatto LIKE '%_@_%._%')
) ENGINE=InnoDB;

CREATE TABLE documento_programmatico (
  id                 INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  titolo             VARCHAR(200)      NOT NULL,
  versione           SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  stato              ENUM('bozza','definitivo','inviato') NOT NULL DEFAULT 'bozza',
  introduzione       TEXT              NULL,
  percorso_pdf       VARCHAR(500)      NULL,
  percorso_csv       VARCHAR(500)      NULL,
  data_creazione     DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data_modifica      DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  data_invio         DATETIME          NULL,
  id_amministratore  INT UNSIGNED      NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_documento_versione (titolo, versione),
  CONSTRAINT fk_documento_amministratore FOREIGN KEY (id_amministratore) REFERENCES utente (id),
  CONSTRAINT ck_documento_invio CHECK ((stato = 'inviato') = (data_invio IS NOT NULL))
) ENGINE=InnoDB;

-- Associazione N:M "Include" (RF-48, RD-21)
CREATE TABLE documento_segnalazione (
  id_documento     INT UNSIGNED      NOT NULL,
  id_segnalazione  INT UNSIGNED      NOT NULL,
  posizione        SMALLINT UNSIGNED NOT NULL,
  nota_comitato    VARCHAR(1000)     NULL,
  PRIMARY KEY (id_documento, id_segnalazione),
  UNIQUE KEY uq_documento_posizione (id_documento, posizione),
  KEY idx_docseg_segnalazione (id_segnalazione),
  CONSTRAINT fk_docseg_documento     FOREIGN KEY (id_documento)    REFERENCES documento_programmatico (id),
  CONSTRAINT fk_docseg_segnalazione  FOREIGN KEY (id_segnalazione) REFERENCES segnalazione (id),
  CONSTRAINT ck_docseg_posizione CHECK (posizione >= 1)
) ENGINE=InnoDB;

-- Associazione N:M "Inviato a" (RF-48)
CREATE TABLE invio_documento (
  id_documento   INT UNSIGNED NOT NULL,
  id_candidato   INT UNSIGNED NOT NULL,
  data_invio     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  email_inviata  VARCHAR(254) NOT NULL,   -- indirizzo effettivo al momento dell'invio
  PRIMARY KEY (id_documento, id_candidato),
  KEY idx_invio_candidato (id_candidato),
  CONSTRAINT fk_invio_documento  FOREIGN KEY (id_documento) REFERENCES documento_programmatico (id),
  CONSTRAINT fk_invio_candidato  FOREIGN KEY (id_candidato) REFERENCES candidato (id)
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- Notifiche e audit
-- -----------------------------------------------------------------------------

CREATE TABLE notifica (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_utente         INT UNSIGNED    NOT NULL,
  tipo              ENUM('cambio_stato','commento','moderazione','sistema') NOT NULL,
  testo             VARCHAR(500)    NOT NULL,
  id_segnalazione   INT UNSIGNED    NULL,
  letta             BOOLEAN         NOT NULL DEFAULT FALSE,
  data              DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  email_inviata_il  DATETIME        NULL,
  PRIMARY KEY (id),
  KEY idx_notifica_utente (id_utente, letta, data),
  KEY idx_notifica_email (email_inviata_il),
  CONSTRAINT fk_notifica_utente       FOREIGN KEY (id_utente)       REFERENCES utente (id) ON DELETE CASCADE,
  CONSTRAINT fk_notifica_segnalazione FOREIGN KEY (id_segnalazione) REFERENCES segnalazione (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- RF-46: registro in sola aggiunta (RD-19)
CREATE TABLE audit_log (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  azione        VARCHAR(60)     NOT NULL,
  tipo_oggetto  VARCHAR(40)     NOT NULL,
  id_oggetto    VARCHAR(40)     NOT NULL,
  valori_prima  JSON            NULL,
  valori_dopo   JSON            NULL,
  indirizzo_ip  VARCHAR(45)     NULL,
  data_ora      DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  id_utente     INT UNSIGNED    NULL,      -- NULL = sistema
  PRIMARY KEY (id),
  KEY idx_audit_oggetto (tipo_oggetto, id_oggetto),
  KEY idx_audit_utente (id_utente, data_ora),
  KEY idx_audit_data (data_ora),
  CONSTRAINT fk_audit_utente FOREIGN KEY (id_utente) REFERENCES utente (id)
) ENGINE=InnoDB;
