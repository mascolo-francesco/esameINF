#!/usr/bin/env bash
# Esegue i test dei vincoli in una transazione con ROLLBACK (il DB resta invariato).
# --force: gli errori attesi non interrompono lo script.
set -euo pipefail
cd "$(dirname "$0")/../.."
export PATH="/opt/homebrew/opt/mysql-client/bin:$PATH"
if [[ -f .env ]]; then set -a; . ./.env; set +a; fi
read -r U P H PORT DB < <(python3 -c 'import os,urllib.parse as u;p=u.urlparse(os.environ["DATABASE_URL"]);print(p.username,u.unquote(p.password),p.hostname,p.port,p.path[1:])')
MYSQL_PWD="$P" mysql -h "$H" -P "$PORT" -u "$U" --ssl-mode=REQUIRED --default-character-set=utf8mb4 \
  --force --table "$DB" < db/test/test_vincoli.sql 2>&1
