-- Permessi dell'utente con cui si collega la web app.
-- L'utente si crea con la CLI di Aiven, che genera la password:
--   avn service user-create esameinf-mysql --project esameinf --username lnc_app
-- Aiven gli assegna permessi quasi da amministratore, quindi qui li tolgo tutti e lascio solo
-- lettura, scrittura dei dati ed esecuzione di funzioni e procedure su defaultdb.
-- Niente DDL: lo schema si cambia solo con avnadmin, tramite i file di questa cartella.

REVOKE ALL PRIVILEGES, GRANT OPTION FROM 'lnc_app'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE, EXECUTE ON defaultdb.* TO 'lnc_app'@'%';
