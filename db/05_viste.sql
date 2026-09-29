-- =============================================================================
-- Viste per la web app. Nessuna vista espone dati personali o coordinate EXIF (RNF-14).
-- =============================================================================

SET NAMES utf8mb4;

-- Nome mostrato in pubblico (RF-07, RF-08)
CREATE OR REPLACE VIEW v_utente_pubblico AS
SELECT u.id,
       CASE WHEN u.stato_account = 'cancellato' THEN 'Utente rimosso'
            WHEN u.mostra_nome_reale THEN CONCAT(u.nome, ' ', u.cognome)
            ELSE u.nome_visualizzato END AS nome_pubblico,
       u.foto_profilo
  FROM utente u;

-- Segnalazioni visibili al pubblico (4.1), con dati per mappa, lista e dettaglio
CREATE OR REPLACE VIEW v_segnalazione_pubblica AS
SELECT s.id, s.codice_pubblico, s.titolo, s.descrizione, s.tipo,
       s.latitudine, s.longitudine, s.indirizzo,
       s.stato_corrente, st.nome AS stato, st.votabile, st.in_classifica,
       s.data_invio, s.data_pubblicazione, s.data_stato_corrente,
       s.num_sostegni, s.num_commentatori, s.punteggio_priorita, s.foto_datata,
       s.id_quartiere, q.nome AS quartiere, q.id_municipio, m.nome AS municipio,
       s.id_autore, up.nome_pubblico AS autore,
       s.id_segnalazione_principale, sp.codice_pubblico AS codice_principale,
       (SELECT GROUP_CONCAT(k.nome ORDER BY k.ordine SEPARATOR ', ')
          FROM classificazione c JOIN categoria k ON k.id = c.id_categoria
         WHERE c.id_segnalazione = s.id AND c.confermata) AS categorie,
       (SELECT k.colore_mappa
          FROM classificazione c JOIN categoria k ON k.id = c.id_categoria
         WHERE c.id_segnalazione = s.id AND c.confermata
         ORDER BY c.confidenza_ia DESC, k.ordine LIMIT 1) AS colore_mappa,
       (SELECT a.percorso_miniatura FROM allegato a
         WHERE a.id_segnalazione = s.id AND a.stato_elaborazione = 'pronto'
         ORDER BY a.ordine LIMIT 1) AS miniatura
  FROM segnalazione s
  JOIN stato st ON st.codice = s.stato_corrente AND st.pubblico
  JOIN quartiere q ON q.id = s.id_quartiere
  JOIN municipio m ON m.id = q.id_municipio
  JOIN v_utente_pubblico up ON up.id = s.id_autore
  LEFT JOIN segnalazione sp ON sp.id = s.id_segnalazione_principale;

-- Allegati pubblicabili: solo versioni ripulite (RF-23, RNF-07)
CREATE OR REPLACE VIEW v_allegato_pubblico AS
SELECT a.id, a.id_segnalazione, a.tipo, a.mime_type, a.durata_sec, a.larghezza, a.altezza,
       a.percorso_pubblico, a.percorso_miniatura, a.ordine
  FROM allegato a
  JOIN segnalazione s ON s.id = a.id_segnalazione
  JOIN stato st ON st.codice = s.stato_corrente AND st.pubblico
 WHERE a.stato_elaborazione = 'pronto';

-- Classifica (RF-35, 7.3): "Più sostenute" = punteggio_priorita, "Di tendenza" = punteggio_tendenza
CREATE OR REPLACE VIEW v_classifica AS
SELECT v.*,
       ROUND(v.punteggio_priorita
             / (1 + TIMESTAMPDIFF(SECOND, v.data_pubblicazione, NOW()) / 86400
                    / fn_param('priorita.tendenza_giorni')), 4) AS punteggio_tendenza,
       RANK() OVER (ORDER BY v.punteggio_priorita DESC) AS posizione
  FROM v_segnalazione_pubblica v
 WHERE v.in_classifica;

-- Cronologia pubblica degli stati (RF-28)
CREATE OR REPLACE VIEW v_timeline_pubblica AS
SELECT h.id, h.id_segnalazione, h.data_ora,
       h.stato_da, sd.nome AS stato_da_nome, h.stato_a, sa.nome AS stato_a_nome,
       h.attore, h.motivazione
  FROM storico_stato h
  JOIN segnalazione s ON s.id = h.id_segnalazione
  JOIN stato st ON st.codice = s.stato_corrente AND st.pubblico
  JOIN stato sd ON sd.codice = h.stato_da
  JOIN stato sa ON sa.codice = h.stato_a;

-- Commenti e aggiornamenti visibili
CREATE OR REPLACE VIEW v_commento_pubblico AS
SELECT c.id, c.id_segnalazione, c.testo, c.data, c.id_autore, up.nome_pubblico AS autore
  FROM commento c JOIN v_utente_pubblico up ON up.id = c.id_autore
 WHERE c.stato = 'visibile';

CREATE OR REPLACE VIEW v_aggiornamento_pubblico AS
SELECT a.id, a.id_segnalazione, a.testo, a.data
  FROM aggiornamento a
 WHERE a.stato = 'visibile';

-- Coda di revisione del moderatore (RF-42): contenuti marcati dall'IA o dagli utenti.
-- gravita = max tra punteggio IA e rapporto abusi/soglia. Ordinare per gravita DESC, data_ingresso.
CREATE OR REPLACE VIEW v_coda_moderazione AS
SELECT 'segnalazione' AS tipo_contenuto, s.id AS id_contenuto, s.id AS id_segnalazione,
       s.codice_pubblico, s.titolo AS anteprima, s.stato_corrente AS stato,
       s.data_stato_corrente AS data_ingresso,
       ia.punteggio_max AS punteggio_ia, ia.moduli AS moduli_ia, ab.n AS abusi_aperti,
       (SELECT h.motivazione FROM storico_stato h WHERE h.id_segnalazione = s.id ORDER BY h.id DESC LIMIT 1) AS motivo,
       GREATEST(COALESCE(ia.punteggio_max, 0), LEAST(ab.n / fn_param('abuso.soglia_revisione'), 1)) AS gravita
  FROM segnalazione s
  LEFT JOIN LATERAL (
       SELECT MAX(a.punteggio) AS punteggio_max, GROUP_CONCAT(DISTINCT a.modulo) AS moduli
         FROM analisi_ia a LEFT JOIN allegato al ON al.id = a.id_allegato
        WHERE (a.id_segnalazione = s.id OR al.id_segnalazione = s.id) AND a.esito <> 'ok') ia ON TRUE
  LEFT JOIN LATERAL (
       SELECT COUNT(*) AS n FROM segnalazione_abuso x
        WHERE x.id_segnalazione = s.id AND x.esito = 'aperta') ab ON TRUE
 WHERE s.stato_corrente = 'IN_REVISIONE'
    OR (s.stato_corrente IN ('PUBBLICATA','PRESA_IN_CARICO') AND ab.n > 0)
UNION ALL
SELECT 'commento', c.id, c.id_segnalazione, s.codice_pubblico, LEFT(c.testo, 200), c.stato, c.data,
       ia.punteggio_max, ia.moduli, ab.n, NULL,
       GREATEST(COALESCE(ia.punteggio_max, 0), LEAST(ab.n / fn_param('abuso.soglia_revisione'), 1))
  FROM commento c
  JOIN segnalazione s ON s.id = c.id_segnalazione
  LEFT JOIN LATERAL (
       SELECT MAX(a.punteggio) AS punteggio_max, GROUP_CONCAT(DISTINCT a.modulo) AS moduli
         FROM analisi_ia a WHERE a.id_commento = c.id AND a.esito <> 'ok') ia ON TRUE
  LEFT JOIN LATERAL (
       SELECT COUNT(*) AS n FROM segnalazione_abuso x
        WHERE x.id_commento = c.id AND x.esito = 'aperta') ab ON TRUE
 WHERE c.stato = 'in_revisione' OR (c.stato = 'visibile' AND ab.n > 0)
UNION ALL
SELECT 'aggiornamento', g.id, g.id_segnalazione, s.codice_pubblico, LEFT(g.testo, 200), g.stato, g.data,
       ia.punteggio_max, ia.moduli, ab.n, NULL,
       GREATEST(COALESCE(ia.punteggio_max, 0), LEAST(ab.n / fn_param('abuso.soglia_revisione'), 1))
  FROM aggiornamento g
  JOIN segnalazione s ON s.id = g.id_segnalazione
  LEFT JOIN LATERAL (
       SELECT MAX(a.punteggio) AS punteggio_max, GROUP_CONCAT(DISTINCT a.modulo) AS moduli
         FROM analisi_ia a WHERE a.id_aggiornamento = g.id AND a.esito <> 'ok') ia ON TRUE
  LEFT JOIN LATERAL (
       SELECT COUNT(*) AS n FROM segnalazione_abuso x
        WHERE x.id_aggiornamento = g.id AND x.esito = 'aperta') ab ON TRUE
 WHERE g.stato = 'in_revisione' OR (g.stato = 'visibile' AND ab.n > 0);

CREATE OR REPLACE VIEW v_provvedimento_attivo AS
SELECT p.*, u.nome_visualizzato AS destinatario
  FROM provvedimento p JOIN utente u ON u.id = p.id_destinatario
 WHERE p.revocato_il IS NULL AND p.data_inizio <= NOW() AND (p.data_fine IS NULL OR p.data_fine > NOW());

-- -----------------------------------------------------------------------------
-- Dashboard del comitato (RF-47)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE VIEW v_dash_per_stato AS
SELECT st.codice, st.nome, st.ordine, COUNT(s.id) AS segnalazioni
  FROM stato st LEFT JOIN segnalazione s ON s.stato_corrente = st.codice
 GROUP BY st.codice, st.nome, st.ordine;

CREATE OR REPLACE VIEW v_dash_per_categoria AS
SELECT k.id, k.nome, k.colore_mappa, COUNT(s.id) AS segnalazioni, COALESCE(SUM(s.num_sostegni), 0) AS sostegni
  FROM categoria k
  LEFT JOIN classificazione c ON c.id_categoria = k.id AND c.confermata
  LEFT JOIN segnalazione s ON s.id = c.id_segnalazione AND s.stato_corrente <> 'BOZZA'
 GROUP BY k.id, k.nome, k.colore_mappa;

CREATE OR REPLACE VIEW v_dash_per_municipio AS
SELECT m.id, m.nome,
       COUNT(s.id) AS segnalazioni,
       COALESCE(SUM(s.stato_corrente IN ('PUBBLICATA','PRESA_IN_CARICO','INVIATA_CANDIDATI')), 0) AS in_classifica,
       COALESCE(SUM(s.num_sostegni), 0) AS sostegni,
       (SELECT COUNT(*) FROM utente u JOIN quartiere q2 ON q2.id = u.id_quartiere
         WHERE q2.id_municipio = m.id AND u.stato_account = 'attivo') AS residenti_iscritti
  FROM municipio m
  LEFT JOIN quartiere q ON q.id_municipio = m.id
  LEFT JOIN segnalazione s ON s.id_quartiere = q.id AND s.stato_corrente <> 'BOZZA'
 GROUP BY m.id, m.nome;

CREATE OR REPLACE VIEW v_dash_utenti AS
SELECT COUNT(*) AS registrati,
       COALESCE(SUM(stato_account = 'attivo'), 0) AS attivi,
       COALESCE(SUM(stato_account = 'non_verificato'), 0) AS non_verificati,
       COALESCE(SUM(stato_account IN ('sospeso','bannato')), 0) AS sanzionati,
       COALESCE(SUM(ultimo_accesso >= NOW() - INTERVAL 30 DAY), 0) AS attivi_ultimi_30_giorni
  FROM utente
 WHERE stato_account <> 'cancellato';

-- Tempi di moderazione: dall'ingresso in revisione alla decisione del moderatore
CREATE OR REPLACE VIEW v_dash_moderazione AS
SELECT COUNT(*) AS revisioni_concluse,
       ROUND(AVG(TIMESTAMPDIFF(MINUTE, t.data_ora, t.data_decisione)) / 60, 1) AS ore_medie,
       ROUND(MAX(TIMESTAMPDIFF(MINUTE, t.data_ora, t.data_decisione)) / 60, 1) AS ore_massime,
       (SELECT COUNT(*) FROM segnalazione WHERE stato_corrente = 'IN_REVISIONE') AS in_attesa
  FROM (SELECT h.data_ora, h.stato_a,
               LEAD(h.data_ora) OVER w AS data_decisione,
               LEAD(h.attore) OVER w AS attore_decisione
          FROM storico_stato h
        WINDOW w AS (PARTITION BY h.id_segnalazione ORDER BY h.id)) t
 WHERE t.stato_a = 'IN_REVISIONE' AND t.attore_decisione IN ('moderatore','amministratore');

-- Esiti automatici dei moduli IA sulle segnalazioni ricevute (tasso di blocco)
CREATE OR REPLACE VIEW v_dash_esiti_ia AS
SELECT h.stato_a AS esito, COUNT(*) AS segnalazioni,
       ROUND(100 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) AS percentuale
  FROM storico_stato h
 WHERE h.stato_da = 'RICEVUTA' AND h.attore = 'sistema'
 GROUP BY h.stato_a;

CREATE OR REPLACE VIEW v_dash_moduli_ia AS
SELECT modulo, esito, COUNT(*) AS esecuzioni, ROUND(AVG(durata_ms)) AS durata_media_ms,
       ROUND(AVG(punteggio), 3) AS punteggio_medio
  FROM analisi_ia
 GROUP BY modulo, esito;
