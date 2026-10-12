# Il database

Ho costruito il database partendo dalla sezione 7 dell'[analisi dei requisiti](../docs/Analisi_Requisiti_La_Nostra_Citta.pdf).
Gira su MySQL 8.4, ospitato da Aiven. Nei file SQL ogni commento riporta il codice del requisito che
implementa (RF, RD, RNF, RIA), così si può controllare la corrispondenza riga per riga.

## I file

| File | Cosa contiene |
|---|---|
| `01_schema.sql` | Le 28 tabelle, con chiavi, indici (anche geografici e di ricerca testuale) e vincoli CHECK |
| `02_territorio.sql` | I 9 Municipi e gli 88 quartieri (NIL) con i confini ufficiali. Lo genera uno script, pesa circa 1 MB |
| `03_seed.sql` | Ruoli, 11 stati, 20 transizioni ammesse, 10 categorie e 28 parametri configurabili |
| `04_logica.sql` | 6 funzioni, 8 procedure e 53 trigger per i vincoli e il ciclo di vita |
| `05_viste.sql` | 16 viste: segnalazioni pubbliche, classifica, cronologia, coda di moderazione, statistiche |
| `06_eventi.sql` | La manutenzione notturna automatica |
| `07_file_allegato.sql` | Il contenuto delle foto: originale, copia pubblica senza EXIF e miniatura, salvate nel database |
| `08_utente_app.sql` | I permessi dell'utente `lnc_app` con cui si collega la web app: solo dati ed esecuzione di procedure, niente modifiche allo schema |
| `query_applicazione.sql` | Le 75 query della web app, raggruppate per caso d'uso |
| `territorio/genera_territorio.py` | Scarica i confini dal portale open data del Comune e scrive `02_territorio.sql` |
| `../docs/er/` | Il modello Entità-Relazione da cui deriva lo schema |
| `test/test_vincoli.sql` | I test: violano di proposito i vincoli e controllano che il database li blocchi |
| `esegui.sh` | Lancia un file SQL o una query: `db/esegui.sh -e "SELECT ..."` |

Per installare tutto su un database vuoto si eseguono i file nell'ordine dei numeri:

```bash
db/esegui.sh db/01_schema.sql db/02_territorio.sql db/03_seed.sql db/04_logica.sql db/05_viste.sql db/06_eventi.sql db/07_file_allegato.sql
db/test/esegui_test.sh
```

Nell'output dei test ogni riga "ATTESO ERRORE" deve essere seguita dal suo errore, e l'ultima riga deve
dire "FINE: rollback eseguito". I file 04, 05 e 06 si possono rilanciare quando cambiano: ricreano
trigger, procedure e viste e non toccano i dati.

L'utente `lnc_app` lo creo con `avn service user-create`, poi lancio `08_utente_app.sql` per togliergli
i permessi da amministratore che Aiven assegna di default.

## Come si usa dall'applicazione

- Lo stato di una segnalazione si cambia chiamando `sp_cambia_stato`, dentro una transazione. La
  procedura scrive la riga nello storico e aggiorna lo stato insieme. Se l'app prova a modificare lo
  stato con un `UPDATE` diretto, il database lo rifiuta (RD-09).
- Una segnalazione nasce come bozza, con la posizione già confermata. L'app aggiunge foto e categorie e
  poi la invia, passando allo stato Ricevuta.
- All'inizio di ogni transazione l'app scrive chi sta agendo e da quale IP:
  `SET @lnc_id_utente = ?, @lnc_ip = ?`. I trigger usano questi valori per il registro di audit.
- Quando rifiuta un'operazione, il database risponde con un messaggio in italiano che comincia col
  codice del requisito, per esempio `RD-06: l'autore non può sostenere la propria segnalazione`. L'app
  può mostrarlo all'utente così com'è (RNF-27).
- Senza moduli di intelligenza artificiale il sistema funziona lo stesso. All'invio il backend decide
  se pubblicare la segnalazione o mandarla a un moderatore, l'utente sceglie le categorie a mano e la
  tabella `analisi_ia` resta vuota.
- Le foto stanno nella tabella `file_allegato`, in tre varianti. Per una demo scolastica mi è sembrato
  più semplice di uno storage esterno: tutto il progetto vive in un solo database. Nelle colonne
  `percorso_*` di `allegato` salvo la route dell'app che restituisce la variante.

## La manutenzione notturna

Alcune regole dell'analisi scattano col passare del tempo, quando nessun utente sta facendo niente.
Per queste ho creato un `EVENT` di MySQL che ogni notte alle 4 (ora italiana) chiama la procedura
`sp_job_notturno`. La procedura:

- archivia le segnalazioni senza sostegni né commenti da 120 giorni;
- ritira quelle rimaste "Da integrare" per più di 14 giorni;
- cancella le bozze abbandonate da oltre 30 giorni;
- riattiva gli utenti con la sospensione scaduta;
- elimina i link email scaduti e i log di accesso più vecchi di 6 mesi;
- anonimizza gli account di chi ha chiesto la cancellazione.

## Dove MySQL differisce dall'analisi

L'analisi proponeva PostgreSQL con PostGIS e Supabase, ma accettava tecnologie equivalenti. Io uso
MySQL, e alcune soluzioni cambiano:

| Nell'analisi | Nel database |
|---|---|
| PostGIS e ricerca del quartiere dalle coordinate | Colonne geografiche con SRID 4326, indice `SPATIAL` e `ST_Intersects` sui confini dei NIL |
| Email unica senza distinguere maiuscole (`lower(email)`) | Indice univoco su `LOWER(email)` |
| Row Level Security (RD-14, RNF-04) | MySQL non ce l'ha: un trigger controlla l'utente a ogni scrittura e il backend verifica i permessi |
| Storico e audit in sola aggiunta (RD-19) | Trigger che bloccano `UPDATE` e `DELETE` su quelle tabelle |
| Job notturno | `EVENT` di MySQL |

## Cosa ho corretto rispetto all'analisi

Scrivendo lo schema ho trovato alcuni punti incompleti o in contraddizione. Li ho risolti così.

1. **Tre transizioni mancavano nella tabella 4.2**, anche se il testo le prevede. Nella tabella
   `transizione_ammessa` sono marcate con `[+]`:
   - da Archiviata a Pubblicata, fatta dal moderatore: è la riattivazione descritta nella tabella 4.1
     e nel diagramma;
   - da Rifiutata a In revisione, fatta dal moderatore: è il riesame dei rifiuti dell'IA citato in RIA-06
     e nel caso d'uso UC-01;
   - da Da integrare a Ritirata, fatta dal sistema dopo 14 giorni. La tabella indicava solo l'autore.
2. **Chi esegue una transizione.** L'analisi usa un campo `ruolo_minimo`, ma "autore" e "sistema" non
   sono ruoli. L'ho sostituito con `attore`, che vale `autore`, `sistema`, `moderatore` o
   `amministratore`. Dove basta il moderatore, può agire anche l'amministratore.
3. **Soglia delle segnalazioni di abuso.** RF-34 dice "oltre 3", la tabella 4.2 "almeno 3". Ho scelto
   "almeno 3", contando solo le segnalazioni ancora aperte. La soglia si cambia dal parametro
   `abuso.soglia_revisione`.
4. **Fino a quando l'autore può ritirare.** RF-20 dice "prima di Inviata ai candidati", la tabella 4.2
   lo esclude già da Presa in carico. Ho seguito la tabella: il ritiro vale da Bozza, Ricevuta, Da
   integrare e Pubblicata.
5. **Formula del punteggio (7.3).** Il testo nomina una variabile S che nella formula non compare.
   Applico P = Σwᵢ + 0,3·Cᵤ. Il peso di ogni sostegno viene fissato quando l'utente vota; se
   l'amministratore cambia i pesi, `sp_ricalcola_tutti_punteggi()` ricalcola tutto.
6. **Bozze e RD-17.** RF-17 elimina le bozze dopo 30 giorni, RD-17 vieta di cancellare le segnalazioni.
   Permetto la cancellazione solo alle bozze.
7. **Pezzi che i requisiti richiedono ma il modello della sezione 7.1 non aveva:**
   - le tabelle `documento_segnalazione` e `invio_documento`, per le associazioni molti a molti
     "Include" e "Inviato a";
   - `aggiornamento` (RF-19), `token_utente` (RF-02, RF-05, RNF-03), `accesso_log` (RF-03, RNF-12),
     `parametro_sistema` (RF-45, RIA-06, 7.3), `notifica` e `segue` (RF-29, RF-37), `sequenza_codice`
     per numerare i codici pubblici;
   - in UTENTE: foto e preferenze di notifica (RF-06), consensi separati (RNF-09), segreto per il
     2FA, blocco dopo troppi tentativi di login, date di cancellazione e anonimizzazione;
   - in SEGNALAZIONE: `data_pubblicazione`, che serve alla classifica "Di tendenza",
     `data_stato_corrente` e `num_commentatori`;
   - `exif_altitudine` in ALLEGATO (RIA-12), i moduli `duplicati` e `volti_targhe` in ANALISI_IA
     (RIA-15, RIA-16), `id_revocato_da` in PROVVEDIMENTO.
8. **Posizione obbligatoria anche nelle bozze.** L'indice geografico richiede un valore sempre
   presente, e nel caso d'uso UC-01 l'utente conferma la posizione prima di scrivere il testo.
9. **Quartiere di residenza (RF-01).** Nel database il campo resta facoltativo e l'obbligo lo impone
   l'app. Così posso cambiare idea senza toccare lo schema quando il comitato risponderà alla
   questione aperta 9.4, cioè se far votare anche chi studia o lavora a Milano senza abitarci.

## I quartieri

Uso gli 88 NIL (Nuclei di Identità Locale) del PGT 2030, con i confini che il Comune di Milano pubblica
come open data. I confini dei NIL non coincidono sempre con quelli dei Municipi, quindi assegno ogni NIL
al Municipio che ne contiene la parte più grande. Porta Romana, per esempio, sta a cavallo tra il 4 e il
5 e finisce nel 5. Tre confini ufficiali (Lambrate-Ortica, Ronchetto sul Naviglio e Baggio) hanno
piccoli difetti geometrici che MySQL segnala, ma la ricerca del quartiere da una coordinata funziona
anche su di loro.
