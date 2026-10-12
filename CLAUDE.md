# Progetto esameINF

Progetto scolastico d'esame (informatica). Consegna in `docs/progetto-desame.md`, analisi dei requisiti in `docs/Analisi_Requisiti_La_Nostra_Citta.pdf`.

## Database: Aiven MySQL (gestito via CLI)

Il database è un servizio MySQL su Aiven, gestito con la CLI ufficiale `avn` (aiven-client).

| Voce | Valore |
|---|---|
| Progetto Aiven | `esameinf` (organizzazione `My Organization`) |
| Servizio | `esameinf-mysql` |
| Tipo / piano | MySQL 8.4, `free-1-1gb` ($0, 1 GB RAM, 1 GB disco) |
| Cloud | `do-ams` (DigitalOcean Amsterdam) |
| Database / utente | `defaultdb` / `avnadmin` |
| Connessione | variabile `DATABASE_URL` nel file `.env` (SSL obbligatorio) |

Nota: gli altri progetti dell'account (`chatwithdb`, `informatica-titze`) NON fanno parte di questo lavoro. Non creare né modificare servizi lì.

### Regole
- Non stampare mai `DATABASE_URL`, la password o il contenuto di `.env` in chat o nei log. Se serve mostrarlo, mascheralo (`sed -E 's#//[^@]*@#//***:***@#'`).
- `.env` è in `.gitignore`: non committarlo.
- Il piano è gratuito: non creare servizi a pagamento, non cambiare piano e non creare altri servizi senza chiedere all'utente.
- Chiedi conferma prima di operazioni distruttive (`DROP`, `TRUNCATE`, `DELETE` senza `WHERE`, `avn service terminate`).
- Per documentazione aggiornata di Aiven, MySQL o qualsiasi libreria usa la skill `/context7-cli` (`ctx7 library aiven ...`, poi `ctx7 docs /aiven/aiven-docs "<domanda>"`), invece di andare a memoria.

### Setup degli strumenti (macOS)
```bash
brew install aiven-client        # comando: avn
brew install mysql-client        # client SQL (non nel PATH di default)
export PATH="/opt/homebrew/opt/mysql-client/bin:$PATH"
avn user login <email> --token   # una tantum, chiede il token API (Console Aiven → User information → Tokens)
avn user info                    # verifica il login
```

### Operazioni sul servizio (`avn`)
Aggiungi sempre `--project esameinf`.
```bash
avn service list --project esameinf
avn service get esameinf-mysql --project esameinf                    # dettagli
avn service get esameinf-mysql --project esameinf --format '{state}' # stato (RUNNING / POWEROFF ...)
avn service update esameinf-mysql --project esameinf --power-on      # riaccende se spento per inattività
avn service wait esameinf-mysql --project esameinf                   # attende RUNNING
avn service database-create esameinf-mysql --project esameinf --dbname nome_db
avn service user-create esameinf-mysql --project esameinf --username nome_utente
avn service user-list esameinf-mysql --project esameinf
```
Aiuto: `avn service --help`, `avn service <comando> --help`.

### Eseguire query
Carica `.env`, estrai le parti dell'URI e usa il client `mysql` senza mettere la password sulla riga di comando:
```bash
cd /Users/francescomascolo/Desktop/Progetto-esameINF
set -a; . ./.env; set +a
read U P H PORT DB < <(python3 -c 'import os,urllib.parse as u;p=u.urlparse(os.environ["DATABASE_URL"]);print(p.username,u.unquote(p.password),p.hostname,p.port,p.path[1:])')
MYSQL_PWD="$P" mysql -h "$H" -P "$PORT" -u "$U" --ssl-mode=REQUIRED "$DB" -e "SELECT VERSION();"
# file SQL:  ... "$DB" < schema.sql
```
Se la password cambia o il servizio viene ricreato, rigenera `.env`:
```bash
printf 'DATABASE_URL=%s\n' "$(avn service get esameinf-mysql --project esameinf --format '{service_uri}')" > .env && chmod 600 .env
```

### Schema del progetto
Tutto in `db/` (vedi `db/README.md`): schema, territorio, seed, logica, viste, eventi, query dell'app e test.
- Esegui SQL con `db/esegui.sh file.sql` o `db/esegui.sh -e "query"`; test con `db/test/esegui_test.sh` (ROLLBACK, non lascia dati).
- Lo stato di una segnalazione cambia solo con `CALL sp_cambia_stato(...)`; i vincoli RD sono nei trigger di `db/04_logica.sql`.
- Il server ha `ANSI_QUOTES`: le stringhe SQL vanno tra apici singoli.

### Problemi comuni
- `not authenticated`: rifai `avn user login <email> --token`.
- Connessione rifiutata / timeout: controlla lo stato con `avn service get ... --format '{state}'`; se non è `RUNNING`, usa `--power-on` e `avn service wait`.
- `mysql: command not found`: manca il PATH del client (vedi setup).

## Sessioni cloud (Claude Code sul web)

Nel cloud il repo viene clonato da GitHub: `.env` e `web/.env.local` non ci sono. Le variabili stanno nell'ambiente cloud (selettore su claude.ai/code), mai nel repo. Non scrivere qui l'host del database né le password, nemmeno se il repo è privato.

Variabili dell'ambiente, con i valori copiati dai file locali:
- `DATABASE_URL`: quella di `web/.env.local`, utente `lnc_app` con permessi ridotti. Non metterci `avnadmin`: lo schema si cambia solo in locale.
- `JWT_SEGRETO` e `TOTP_CHIAVE`: uguali a quelli di `web/.env.local`.

Accesso di rete: **Custom**, con in *Allowed domains* l'host del database (quello di `DATABASE_URL`, senza utente, porta e percorso) e la casella *Also include default list of common package managers*.

Script di setup, da incollare nel campo *Setup script*:
```bash
#!/bin/bash
# Lo script può partire da qualsiasi cartella: cerca web/ nel repo clonato
WEB=$(dirname "$(find /root /home /workspace /workspaces -maxdepth 5 -path '*/web/package.json' -not -path '*/node_modules/*' 2>/dev/null | head -1)")
apt-get update -qq && apt-get install -y -qq default-mysql-client || true
cd "$WEB" && npm ci --no-audit --no-fund || true
```

Alla prima sessione controlla che il database sia raggiungibile (sostituisci `HOST` e `PORTA`):
```bash
timeout 5 bash -c '</dev/tcp/HOST/PORTA' && echo raggiungibile || echo non raggiungibile
```
Se non è raggiungibile, le query e i test d'integrazione si fanno in locale; in cloud restano codice, test unitari e typecheck. `npm run seed` scrive nel database condiviso: in cloud solo su richiesta esplicita.
