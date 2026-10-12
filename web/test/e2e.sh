#!/usr/bin/env bash
# Test end-to-end: guido Chrome senza interfaccia (chrome-devtools CLI) sull'app già avviata
# con `npm run dev` e popolata con `npm run seed`.
#   test/e2e.sh                  # contro http://localhost:3000
#   BASE=https://... test/e2e.sh
# Ogni esecuzione fa un tentativo di accesso sbagliato: più di 4 in 15 minuti bloccano
# temporaneamente l'utente di prova (RF-03).
set -uo pipefail
cd "$(dirname "$0")/.."
BASE=${BASE:-http://localhost:3000}
CREDENZIALI=.demo/credenziali.md
export NODE_NO_WARNINGS=1

[[ -f $CREDENZIALI ]] || { echo "Manca $CREDENZIALI: lancia prima npm run seed"; exit 1; }
EMAIL=$(grep -m1 -o '[a-z.]*@example.com (' "$CREDENZIALI" | cut -d' ' -f1)
PASSWORD=$(grep 'Password comune' "$CREDENZIALI" | sed -E 's/[^`]*`([^`]+)`.*/\1/')

chrome-devtools stop >/dev/null 2>&1
chrome-devtools start --isolated --no-usage-statistics >/dev/null 2>&1 # headless di default
# la CLI lavora sempre sulla pagina selezionata: ne apro una nuova e uso quella
chrome-devtools new_page "$BASE/" >/dev/null 2>&1

# esegue una funzione JS nella pagina e stampa il valore restituito
js() {
  chrome-devtools evaluate_script "$1" --output-format=json 2>/dev/null | tail -1 |
    node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const m=/```json\n([\s\S]*?)\n```/.exec(JSON.parse(s).message);console.log(m?m[1]:"ERRORE")})'
}
vai() { chrome-devtools navigate_page --type url --url "$BASE$1" >/dev/null 2>&1; }

OK=0; KO=0
verifica() { # nome, atteso, ottenuto
  if [[ "$3" == "$2" ]]; then echo "OK  $1"; OK=$((OK + 1)); else echo "KO  $1 (atteso: $2, ottenuto: $3)"; KO=$((KO + 1)); fi
}

# --- consultazione pubblica
vai /
verifica "home: cinque voci per ciascuna classifica" true "$(js '() => document.querySelectorAll("[aria-labelledby=h-sostenute] ol li, [aria-labelledby=h-tendenza] ol li").length === 10')"
verifica "mappa: marker in GeoJSON" true "$(js 'async () => (await (await fetch("/api/mappa?bbox=9.04,45.38,9.28,45.54")).json()).features.length > 0')"
verifica "mappa: bbox mancante rifiutata" 400 "$(js 'async () => (await fetch("/api/mappa")).status')"
vai "/classifica?municipio=2"
verifica "classifica: filtro per Municipio" true "$(js '() => { const v=[...document.querySelectorAll("ol li")].map(l => l.textContent); return v.length > 0 && v.every(t => t.includes("Municipio 2")) }')"
CODICE=$(js '() => document.querySelector("ol li a").getAttribute("href").split("/").pop()' | tr -d '"')
vai "/segnalazioni/$CODICE"
verifica "dettaglio: anteprima Open Graph (RF-41)" true "$(js '() => !!document.querySelector("meta[property=\"og:title\"]") && !!document.querySelector("meta[property=\"og:image\"]")')"
MINIATURA=$(js '() => document.querySelector("img[src*=\"/api/allegati/\"]")?.getAttribute("src")' | tr -d '"')
verifica "foto pubblica servita a tutti" 200 "$(js "async () => (await fetch('$MINIATURA')).status")"
verifica "foto originale con EXIF negata agli ospiti (RNF-07)" 404 "$(js "async () => (await fetch('${MINIATURA%/*}/originale')).status")"
vai /nuova
verifica "nuova segnalazione: senza accesso rimanda al login" '"/accedi?da=%2Fnuova"' "$(js '() => location.pathname + location.search')"

# --- accesso
vai /accedi
js "() => { const f=document.querySelector('form'); f.email.value='$EMAIL'; f.password.value='password-sbagliata'; f.requestSubmit(); return true }" >/dev/null
sleep 3
verifica "login: password errata" true "$(js '() => document.querySelector("[role=alert]")?.textContent.includes("non corretti") ?? false')"
verifica "login: l'email resta nel campo" "\"$EMAIL\"" "$(js '() => document.querySelector("form").email.value')"
js "() => { const f=document.querySelector('form'); f.password.value='$PASSWORD'; f.requestSubmit(); return true }" >/dev/null
sleep 4
verifica "login: riuscito, torna alla home" '"/"' "$(js '() => location.pathname')"
verifica "login: menu utente presente" true "$(js '() => !!document.querySelector("[aria-label^=\"Menu di\"]")')"
verifica "foto originale negata anche ai cittadini" 404 "$(js "async () => (await fetch('${MINIATURA%/*}/originale')).status")"
vai /admin
verifica "amministrazione negata a un cittadino (403)" '"Pagina riservata"' "$(js '() => document.querySelector("h1")?.textContent')"
vai /moderazione
verifica "moderazione negata a un cittadino (403)" '"Pagina riservata"' "$(js '() => document.querySelector("h1")?.textContent')"
vai /profilo
verifica "profilo: mostra l'email dell'utente" true "$(js "() => document.body.textContent.includes('$EMAIL')")"
verifica "esportazione dati in JSON (RF-09)" true "$(js 'async () => { const d = await (await fetch("/api/profilo/esporta")).json(); return d.profilo.email !== undefined }')"

chrome-devtools stop >/dev/null 2>&1
echo
echo "$OK superati, $KO falliti"
[[ $KO -eq 0 ]]
