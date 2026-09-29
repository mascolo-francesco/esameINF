# Database — La Nostra Città, Il Nostro Futuro

MySQL 8.4 su Aiven (`esameinf-mysql`, database `defaultdb`). Schema ricavato dalla sezione 7 di
[`docs/Analisi_Requisiti_La_Nostra_Citta.pdf`](../docs/Analisi_Requisiti_La_Nostra_Citta.pdf); i commenti nei file SQL citano i codici RF / RIA / RD / RNF.

## File

| File | Contenuto |
|---|---|
| `01_schema.sql` | 28 tabelle con chiavi, indici (anche spaziali e full-text) e vincoli CHECK |
| `02_territorio.sql` | 9 Municipi e 88 NIL con i confini ufficiali (generato, ~1 MB) |
| `03_seed.sql` | Ruoli, 11 stati, 20 transizioni ammesse, 10 categorie, 28 parametri |
| `04_logica.sql` | 6 funzioni, 8 procedure, 53 trigger (vincoli RD e ciclo di vita) |
| `05_viste.sql` | 16 viste: segnalazioni pubbliche, classifica, timeline, coda moderazione, dashboard |
| `06_eventi.sql` | Job notturno (02:00 UTC) |
| `query_applicazione.sql` | 75 query parametrizzate per la web app, divise per caso d'uso |
| `territorio/genera_territorio.py` | Scarica gli open data del Comune e rigenera `02_territorio.sql` |
| `test/test_vincoli.sql` | Test di vincoli e ciclo di vita, in una transazione annullata con ROLLBACK |
| `esegui.sh` | Esegue file SQL o una query sul DB (`db/esegui.sh -e "SELECT ..."`) |

Installazione su un database vuoto, in ordine:

```bash
db/esegui.sh db/01_schema.sql db/02_territorio.sql db/03_seed.sql db/04_logica.sql db/05_viste.sql db/06_eventi.sql
db/test/esegui_test.sh     # atteso: solo "ATTESO ERRORE" seguiti dal loro errore, poi "FINE: rollback eseguito"
```

`04`, `05` e `06` si possono rieseguire: ricreano solo oggetti di logica, mai dati.

## Regole d'uso per l'applicazione

- **Lo stato di una segnalazione cambia solo con `CALL sp_cambia_stato(...)`**, dentro una transazione.
  Un `UPDATE` diretto di `stato_corrente` viene rifiutato (RD-09).
- Una segnalazione nasce sempre in `BOZZA` (con posizione già confermata), poi si aggiungono allegati e
  categorie e si passa a `RICEVUTA`.
- A inizio transazione l'app imposta `SET @lnc_id_utente = ?, @lnc_ip = ?`: i trigger li usano per l'audit.
- Commenti e aggiornamenti nascono `in_revisione` e diventano `visibile` dopo il filtro IA (fail-safe RIA-04).
- Gli errori di vincolo arrivano come `SQLSTATE 45000` con un messaggio in italiano che inizia col codice
  del requisito (es. `RD-06: ...`): si possono mostrare all'utente (RNF-27).

## Adattamenti rispetto al documento di analisi

Il documento propone PostgreSQL + PostGIS + Supabase (§9.1) e ammette tecnologie equivalenti. Su MySQL:

| Documento | Implementazione |
|---|---|
| PostGIS, point-in-polygon | Colonne `GEOMETRY/POINT SRID 4326`, indice `SPATIAL`, `ST_Intersects` sui confini NIL |
| `UNIQUE lower(email)` | Indice funzionale `UNIQUE ((LOWER(email)))` |
| Row Level Security (RD-14, RNF-04) | Trigger su ogni scrittura (`fn_utente_puo_scrivere`) + autorizzazione nell'app |
| Permessi DB per sola aggiunta (RD-19) | Trigger che bloccano UPDATE/DELETE su `storico_stato`, `audit_log`, `invio_documento` |
| Job notturno | `EVENT` MySQL che chiama `sp_job_notturno()` |

## Correzioni a incoerenze del documento

1. **Transizioni mancanti in tabella 4.2**, aggiunte (sono marcate `[+]` in `transizione_ammessa`):
   - `Archiviata → Pubblicata` (moderatore): la riattivazione è prevista in §4.1 e nel diagramma.
   - `Rifiutata → In revisione` (moderatore): il riesame dei rifiuti dell'IA è previsto in RIA-06 e UC-01 8b.
   - `Da integrare → Ritirata` (sistema): il ritiro automatico dopo 14 giorni è eseguito dal job notturno,
     mentre la tabella indicava solo l'autore.
2. **`ruolo_minimo` in TRANSIZIONE_AMMESSA** sostituito da `attore` (`autore`, `sistema`, `moderatore`,
   `amministratore`): "autore" e "sistema" non sono ruoli. `moderatore` ammette anche l'amministratore.
3. **Soglia abusi**: RF-34 dice "oltre 3", la tabella 4.2 "almeno 3". Si usa **almeno 3** (parametro
   `abuso.soglia_revisione`), contando solo le segnalazioni ancora aperte.
4. **Ritiro dell'autore**: RF-20 dice "prima di Inviata ai candidati", la tabella 4.2 esclude già Presa in
   carico. Vale la tabella: il ritiro è possibile da Bozza, Ricevuta, Da integrare e Pubblicata.
5. **Formula 7.3**: il testo cita una variabile S che non compare nella formula. Si applica
   P = Σwᵢ + 0,3·Cᵤ. Il peso wᵢ viene fissato al momento del sostegno; se l'amministratore cambia i pesi,
   `sp_ricalcola_tutti_punteggi()` li ricalcola.
6. **Bozze e RD-17**: RF-17 prevede di eliminare le bozze dopo 30 giorni, mentre RD-17 vieta di cancellare
   le segnalazioni. La cancellazione fisica resta ammessa solo per lo stato Bozza.
7. **Elementi richiesti dai requisiti ma assenti dal modello §7.1**, aggiunti:
   - tabelle `documento_segnalazione` e `invio_documento` (associazioni N:M "Include" e "Inviato a");
   - `aggiornamento` (RF-19), `token_utente` (RF-02, RF-05, RNF-03), `accesso_log` (RF-03, RNF-12),
     `parametro_sistema` (RF-45, RIA-06, 7.3), `notifica` e `segue` (RF-29, RF-37), `sequenza_codice`;
   - attributi in UTENTE: foto e preferenze notifiche (RF-06), consensi separati (RNF-09), segreto TOTP,
     blocco login, date di cancellazione e anonimizzazione;
   - attributi in SEGNALAZIONE: `data_pubblicazione` (serve alla vista "Di tendenza"), `data_stato_corrente`,
     `num_commentatori`;
   - `exif_altitudine` in ALLEGATO (RIA-12), moduli `duplicati` e `volti_targhe` in ANALISI_IA
     (RIA-15, RIA-16), `id_revocato_da` in PROVVEDIMENTO.
8. **Posizione obbligatoria anche in Bozza**: l'indice spaziale richiede `NOT NULL`, e nel flusso UC-01
   la posizione si conferma prima del testo.
9. **Residenza (RF-01)**: `id_quartiere` resta nullable nel DB, e l'obbligo lo impone l'app. Così resta
   aperta la questione §9.4 sul voto di chi studia o lavora a Milano senza risiedervi.

## Territorio

I NIL sono quelli vigenti del PGT 2030 (88), con i confini del portale open data del Comune di Milano
(CC BY 4.0). A ogni NIL viene assegnato il Municipio in cui cade la maggior parte della sua area. Porta
Romana è a cavallo tra i Municipi 4 e 5 ed è assegnata al 5. Tre poligoni ufficiali (Lambrate-Ortica,
Ronchetto, Baggio) hanno piccole auto-intersezioni: MySQL li segnala come non validi, ma il
point-in-polygon funziona correttamente.
