# La web app

È la prima versione dell'applicazione descritta nell'analisi dei requisiti. Copre i requisiti con
priorità "M" e usa il database della cartella [`db/`](../db/README.md) così com'è: i vincoli li fanno
rispettare i trigger, l'app si limita a chiamarli e a mostrare i loro messaggi.

## Cosa si può fare

**Chi visita il sito** vede la mappa di Milano con le segnalazioni pubblicate, la classifica "Più
sostenute" e "Di tendenza" con i filtri per categoria, Municipio, quartiere, tipo, stato e periodo, e la
pagina di ogni segnalazione con foto, cronologia degli stati e commenti.

**Il cittadino registrato** può:

- inviare una segnalazione in quattro passaggi: foto, posizione, descrizione, conferma. La posizione
  arriva dal GPS della foto, dal telefono o da un clic sulla mappa; prima dell'invio l'app mostra
  quartiere e Municipio e avvisa se nei dintorni c'è già una segnalazione simile;
- sostenere le segnalazioni degli altri, commentarle, seguirle e segnalare abusi;
- aggiungere aggiornamenti alle proprie segnalazioni, ritirarle, integrarle quando il comitato lo chiede;
- leggere le notifiche, scaricare i propri dati in JSON, attivare la verifica in due passaggi,
  cancellare l'account.

**Il moderatore** lavora sulla coda di revisione: approva, rifiuta con motivazione, chiede
integrazioni, corregge categorie e posizione, unisce i duplicati, nasconde i commenti, sospende o
banna gli utenti. Vede anche le foto originali con data e distanza del GPS dal punto indicato.

**L'amministratore** ha in più la dashboard, la gestione di ruoli, categorie e parametri, il registro
di audit e il documento programmatico: sceglie le segnalazioni prese in carico, lo esporta in CSV e lo
invia a tutti i candidati.

## Cosa ho lasciato fuori dalla demo

- **Email.** Alla registrazione l'account è subito attivo, senza link di conferma, e non c'è il
  recupero della password. Le notifiche si leggono solo dentro l'app.
- **Moduli di intelligenza artificiale.** Ogni segnalazione inviata va in revisione e la approva un
  moderatore. I commenti escono subito; il controllo resta affidato alle segnalazioni di abuso, che
  dopo tre segnalazioni da utenti diversi nascondono il contenuto.
- **CAPTCHA e video.** Resta il blocco dopo 5 accessi sbagliati in 15 minuti; si caricano solo foto.

Il database è già pronto per tutte e tre le cose.

## Come l'ho costruita

| Parte | Scelta |
|---|---|
| Framework | Next.js 16 (App Router) con TypeScript. Le pagine leggono i dati sul server; i form usano le Server Actions |
| Interfaccia | Tailwind CSS e componenti shadcn/ui, in italiano, utilizzabile da tastiera e da 360 px di larghezza, installabile come app |
| Database | mysql2 con SQL scritto a mano, collegato con l'utente `lnc_app` che non può modificare lo schema |
| Validazione | Zod, con messaggi in italiano, su ogni input lato server |
| Accesso | password con Argon2id; sessione con un JWT da 15 minuti e un refresh token che cambia a ogni rinnovo; codice TOTP obbligatorio per moderatori e amministratori, con il segreto cifrato nel database |
| Foto | sharp ed exifr: controllo del tipo reale del file, lettura di posizione e data dello scatto, copia pubblica senza metadati e miniatura. Tutto salvato nella tabella `file_allegato` |
| Mappa | MapLibre con le mappe di OpenFreeMap, marker raggruppati e caricati solo per l'area visibile |

Ogni scrittura passa da `inTransazione` ([`src/lib/server/db.ts`](src/lib/server/db.ts)), che prima
imposta l'utente e l'IP per il registro di audit. Gli errori dei trigger arrivano come SQLSTATE 45000
con il codice del requisito ("RD-06: ..."): l'app toglie il codice e mostra il resto all'utente.

## Struttura

```
web/
├── src/app/              pagine e Server Actions, una cartella per sezione
│   ├── nuova/            invio di una segnalazione
│   ├── segnalazioni/     pagina di dettaglio, sostegno, commenti
│   ├── moderazione/      coda di revisione e utenti
│   ├── admin/            dashboard, ruoli, categorie, parametri, audit, documento
│   └── api/              foto, marker della mappa, CSV, esportazione dei dati
├── src/lib/server/       accesso al database, sessioni, foto, query condivise
├── src/components/       componenti dell'interfaccia
├── scripts/              dati di prova (seed-demo.ts) e le loro foto (foto-demo/)
└── test/                 test automatici
```

## Provarla

Le credenziali degli account di prova (otto cittadini, una moderatrice e un amministratore) le
fornisco a parte: lo script di seed le genera e le salva fuori dal repository. Per lo staff serve
anche un'app di autenticazione come Google Authenticator, in cui inquadrare il codice QR fornito.

Per avviarla in locale servono Node.js 22 o successivo e il database già creato:

```bash
cd web
npm install
cp .env.example .env.local   # poi compilare i tre valori
npm run seed                 # solo su un database senza utenti
npm run dev                  # http://localhost:3000
```

Le segnalazioni di prova hanno foto vere prese da Wikimedia Commons; autori e licenze sono nella
pagina `/crediti`. Se il database è stato riempito con un seed precedente, che usava immagini
segnaposto, `npm run foto-demo` sostituisce le foto senza toccare il resto.

## Test

```bash
npm test          # Vitest: foto, sicurezza, validazione e rotazione delle sessioni sul database
npm run test:e2e  # Chrome senza interfaccia sull'app avviata: consultazione, permessi, accesso
```

I test end-to-end li guido con la CLI di Chrome DevTools (`chrome-devtools`), che va installata a parte.
