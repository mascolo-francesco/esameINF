#!/usr/bin/env bash
# Esegue file SQL (o una query con -e) sul database Aiven. DATABASE_URL viene da .env;
# se il file non c'è (sessione cloud) la prende dall'ambiente.
#   db/esegui.sh db/01_schema.sql db/03_seed.sql
#   db/esegui.sh -e "SELECT COUNT(*) FROM quartiere"
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="/opt/homebrew/opt/mysql-client/bin:$PATH"
if [[ -f .env ]]; then set -a; . ./.env; set +a; fi
read -r U P H PORT DB < <(python3 -c 'import os,urllib.parse as u;p=u.urlparse(os.environ["DATABASE_URL"]);print(p.username,u.unquote(p.password),p.hostname,p.port,p.path[1:])')
export MYSQL_PWD="$P"
MYSQL=(mysql -h "$H" -P "$PORT" -u "$U" --ssl-mode=REQUIRED --default-character-set=utf8mb4 "$DB")

if [[ "${1:-}" == "-e" ]]; then
  "${MYSQL[@]}" --table -e "$2"
  exit
fi
for f in "$@"; do
  echo ">> $f"
  "${MYSQL[@]}" < "$f"
done
