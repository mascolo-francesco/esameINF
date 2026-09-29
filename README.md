# La Nostra Città, Il Nostro Futuro

Progetto d'esame di Informatica — Francesco Mascolo.

Piattaforma web per il comitato *Insieme per Milano*. I cittadini segnalano problemi e proposte sul
territorio, le documentano con foto o video e le sostengono con un voto. Ne nasce una classifica delle
priorità dei quartieri, che il comitato consegna ai candidati Sindaco.

## Dove trovare cosa

| Cosa | Dove |
|---|---|
| Testo della consegna | [`docs/progetto-desame.md`](docs/progetto-desame.md) |
| Analisi dei requisiti (materiale 1) | [`docs/Analisi_Requisiti_La_Nostra_Citta.pdf`](docs/Analisi_Requisiti_La_Nostra_Citta.pdf) |
| Schema logico relazionale: tabelle, chiavi, vincoli (materiale 2) | [`db/01_schema.sql`](db/01_schema.sql) |
| Scelte di progetto e differenze rispetto all'analisi | [`db/README.md`](db/README.md) |
| Dati di configurazione: ruoli, stati, transizioni, categorie | [`db/03_seed.sql`](db/03_seed.sql) |
| Vincoli di integrità e ciclo di vita (trigger, procedure) | [`db/04_logica.sql`](db/04_logica.sql) |
| Viste: mappa, classifica, moderazione, dashboard | [`db/05_viste.sql`](db/05_viste.sql) |
| Query usate dalla web app, divise per caso d'uso | [`db/query_applicazione.sql`](db/query_applicazione.sql) |
| Test dei vincoli | [`db/test/test_vincoli.sql`](db/test/test_vincoli.sql) |
| Codice della web app | *in sviluppo* |

## Struttura del repository

```
.
├── README.md                  questa pagina
├── docs/                      consegna e analisi dei requisiti
├── db/                        database MySQL
│   ├── 01_schema.sql          28 tabelle
│   ├── 02_territorio.sql      9 Municipi e 88 quartieri (NIL) con i confini ufficiali
│   ├── 03_seed.sql            dati di configurazione
│   ├── 04_logica.sql          funzioni, procedure e trigger
│   ├── 05_viste.sql           viste per l'applicazione
│   ├── 06_eventi.sql          job notturno di manutenzione
│   ├── query_applicazione.sql query della web app
│   ├── territorio/            script che genera 02_territorio.sql dagli open data del Comune
│   ├── test/                  test dei vincoli (in transazione, con rollback finale)
│   └── esegui.sh              esegue file SQL sul database
└── .env.example               formato della connessione al database (il file .env reale non è pubblicato)
```

Ogni commento nel codice SQL cita il requisito che implementa: RF = funzionale, RD = vincolo sui dati,
RNF = non funzionale, RIA = moduli di intelligenza artificiale. Il riferimento è sempre il documento di analisi.

## Stato del progetto

| Fase | Stato |
|---|---|
| Analisi dei requisiti | completata |
| Database (schema, vincoli, query) | completato e testato |
| Web app (fase 1: registrazione, segnalazioni, voti, classifica, mappa, moderazione manuale) | da sviluppare |
| Moduli di intelligenza artificiale | fasi successive: il database è già predisposto |

## Tecnologie

- **Database:** MySQL 8.4 su Aiven (piano gratuito, data center UE), con dati geografici (SRID 4326).
- **Dati territoriali:** open data del Comune di Milano (CC BY 4.0).

## Ricreare il database

Serve il client `mysql` e un file `.env` con `DATABASE_URL` (vedi `.env.example`).

```bash
db/esegui.sh db/01_schema.sql db/02_territorio.sql db/03_seed.sql db/04_logica.sql db/05_viste.sql db/06_eventi.sql
db/test/esegui_test.sh
```
