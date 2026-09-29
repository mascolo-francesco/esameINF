-- =============================================================================
-- Job pianificati (event_scheduler è attivo sul servizio Aiven).
-- Orari in UTC: 02:00 UTC = 03:00/04:00 ora italiana.
-- =============================================================================

DROP EVENT IF EXISTS ev_job_notturno;
CREATE EVENT ev_job_notturno
  ON SCHEDULE EVERY 1 DAY STARTS TIMESTAMP(CURRENT_DATE + INTERVAL 1 DAY, '02:00:00')
  ON COMPLETION PRESERVE ENABLE
  COMMENT 'Archiviazione, ritiro Da integrare, pulizia bozze/token/log, fine sospensioni, anonimizzazione'
  DO CALL sp_job_notturno();
