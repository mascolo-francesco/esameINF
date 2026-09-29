# La Nostra Città, Il Nostro Futuro

Progetto d'esame di Informatica di Francesco Mascolo.

Il comitato *Insieme per Milano* vuole raccogliere dai cittadini i problemi dei quartieri prima delle
elezioni comunali. Con questa piattaforma chi abita a Milano segnala una buca, un lampione spento o un
parco abbandonato, allega una foto e raccoglie il sostegno degli altri iscritti. Dai voti esce una
classifica delle priorità, che il comitato consegna a tutti i candidati Sindaco.

## Da dove partire

Se ha poco tempo, le consiglio quest'ordine:

1. [La consegna](docs/progetto-desame.md), per ricordare cosa chiedeva il progetto.
2. [L'analisi dei requisiti](docs/Analisi_Requisiti_La_Nostra_Citta.pdf), il materiale 1.
3. [Lo schema del database](db/01_schema.sql), il materiale 2: tabelle, chiavi e vincoli, con i
   commenti che rimandano ai requisiti.
4. [Le note sul database](db/README.md), dove spiego le scelte fatte e dove mi sono discostato
   dall'analisi.

Poi, se vuole entrare nel dettaglio:

| Cosa | File |
|---|---|
| Ruoli, stati, transizioni, categorie di partenza | [`db/03_seed.sql`](db/03_seed.sql) |
| Trigger e procedure che fanno rispettare i vincoli | [`db/04_logica.sql`](db/04_logica.sql) |
| Viste per mappa, classifica, moderazione e statistiche | [`db/05_viste.sql`](db/05_viste.sql) |
| Le query che userà la web app, divise per caso d'uso | [`db/query_applicazione.sql`](db/query_applicazione.sql) |
| I test dei vincoli | [`db/test/test_vincoli.sql`](db/test/test_vincoli.sql) |
| Codice della web app | in sviluppo |

Nel codice SQL ogni commento cita il requisito che implementa. RF indica i requisiti funzionali, RD i
vincoli sui dati, RNF i non funzionali e RIA quelli sull'intelligenza artificiale, con la numerazione
del documento di analisi.

## Com'è organizzato il repository

```
.
├── README.md                  questa pagina
├── docs/                      consegna e analisi dei requisiti
├── db/                        database MySQL
│   ├── 01_schema.sql          le 28 tabelle
│   ├── 02_territorio.sql      9 Municipi e 88 quartieri (NIL) con i confini ufficiali
│   ├── 03_seed.sql            dati di configurazione
│   ├── 04_logica.sql          funzioni, procedure e trigger
│   ├── 05_viste.sql           viste per l'applicazione
│   ├── 06_eventi.sql          manutenzione notturna automatica
│   ├── query_applicazione.sql query della web app
│   ├── territorio/            script che genera i confini dagli open data del Comune
│   ├── test/                  test dei vincoli
│   └── esegui.sh              lancia file SQL sul database
└── .env.example               formato della connessione al database
```

Il file `.env` con la password del database resta sul mio computer e non è nel repository.

## A che punto sono

| Fase | Stato |
|---|---|
| Analisi dei requisiti | completata |
| Database: schema, vincoli, query | completato e testato |
| Web app, prima versione: registrazione, segnalazioni, voti, classifica, mappa, moderazione manuale | da sviluppare |
| Moduli di intelligenza artificiale | rimandati alle fasi successive; il database è già pronto a ospitarli |

## Tecnologie

Il database gira su MySQL 8.4, ospitato da Aiven sul piano gratuito in un data center europeo. Per
mappa e quartieri uso le coordinate geografiche di MySQL (SRID 4326) e i confini pubblicati dal Comune
di Milano come open data (licenza CC BY 4.0).

## Ricreare il database

Servono il client `mysql` e un file `.env` compilato come `.env.example`. Poi:

```bash
db/esegui.sh db/01_schema.sql db/02_territorio.sql db/03_seed.sql db/04_logica.sql db/05_viste.sql db/06_eventi.sql
db/test/esegui_test.sh
```

I test girano dentro una transazione che alla fine viene annullata, quindi non lasciano dati.
