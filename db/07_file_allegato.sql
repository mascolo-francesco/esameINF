-- =============================================================================
-- Contenuto delle foto, salvato nel database.
-- Per la demo non uso uno storage esterno: per ogni allegato tengo tre varianti.
--   originale  il file caricato, con l'EXIF; lo vede solo lo staff (RNF-07)
--   pubblica   ridimensionata (max 1600 px) e senza metadati (RF-23)
--   miniatura  400 px, per liste e mappa (RF-24)
-- Le colonne percorso_* di allegato contengono la route dell'app che serve la
-- variante, per esempio /api/allegati/123/pubblica.
-- =============================================================================

SET NAMES utf8mb4;

CREATE TABLE file_allegato (
  id_allegato  INT UNSIGNED  NOT NULL,
  variante     ENUM('originale','pubblica','miniatura') NOT NULL,
  mime_type    VARCHAR(40)   NOT NULL,
  dimensione   INT UNSIGNED  NOT NULL,
  dati         MEDIUMBLOB    NOT NULL,
  PRIMARY KEY (id_allegato, variante),
  CONSTRAINT fk_file_allegato FOREIGN KEY (id_allegato) REFERENCES allegato (id) ON DELETE CASCADE,
  CONSTRAINT ck_file_mime CHECK (mime_type IN ('image/jpeg','image/png','image/webp')),
  CONSTRAINT ck_file_dimensione CHECK (dimensione = LENGTH(dati) AND dimensione <= 10485760)
) ENGINE=InnoDB;
