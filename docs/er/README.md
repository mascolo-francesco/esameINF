# Modello Entità-Relazione

Il modello è in due versioni:

| Versione | Contenuto | File |
|---|---|---|
| Essenziale | Le 14 entità della prima versione dell'app e i loro attributi principali. È quella da ricopiare sul foglio | [SVG](modello_er_ridotto.svg), [PNG](modello_er_ridotto.png) |
| Completa | Tutte le 22 entità del database con tutti gli attributi, compresi i moduli IA e le tabelle tecniche | [SVG](modello_er.svg), [PNG](modello_er.png) |

![Modello Entità-Relazione, versione essenziale](modello_er_ridotto.svg)

La versione essenziale lascia fuori le tabelle tecniche (token, registro accessi, parametri, audit), i
moduli di intelligenza artificiale, le notifiche, gli aggiornamenti, i "segui" e le transizioni
ammesse. Sono tutte parti già presenti nel database, ma non servono a capire come funziona la
piattaforma.

Ho disegnato il modello in notazione di Chen, la stessa usata a lezione:

- il rettangolo è un'entità, il rombo una relazione;
- il pallino pieno indica l'identificatore, quello vuoto un attributo;
- accanto a ogni entità, sulla linea che la collega a una relazione, c'è la cardinalità min:max
  con cui l'entità partecipa. Per esempio UTENTE (0:N) INSERISCE (1:1) SEGNALAZIONE si legge così:
  un utente inserisce da zero a molte segnalazioni, ogni segnalazione ha esattamente un autore.

Il modello completo ha 22 entità e 42 relazioni. Le associazioni molti a molti che nel database diventano
tabelle (SOSTIENE, SEGUE, CLASSIFICATA, INCLUDE, INVIATO_A) qui compaiono come relazioni, con i loro
attributi attaccati al rombo. UNITA_A è una relazione ricorsiva su SEGNALAZIONE: una segnalazione
duplicata ("secondaria") confluisce in una "principale".

Gli attributi sono quelli delle tabelle in [`db/01_schema.sql`](../../db/01_schema.sql), senza le
chiavi esterne, che nel modello concettuale sono rappresentate dalle relazioni.

## Rigenerare il disegno

I due file SVG li produce uno script Python, senza librerie esterne. Le posizioni di entità e relazioni
sono scritte a mano nello script: per spostare un elemento si cambia la coordinata e si rilancia.

```bash
python3 docs/er/genera_er.py
```
