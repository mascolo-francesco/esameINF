**PROGETTO D'ESAME**

*Sviluppo della Piattaforma "La Nostra Città, Il Nostro Futuro"*

**1\. Visione d'Insieme e Obiettivi**

Il comitato di cittadini Insieme per Milano vuole costruire una piattaforma web che rimetta al centro del dibattito politico le reali necessità dei quartieri, contrastando il progressivo allontanamento della cittadinanza – e in particolare delle fasce più giovani – dalla cura del bene comune. In vista delle prossime elezioni amministrative comunali, il comitato non vuole limitarsi a subire i programmi elettorali calati dall'alto dai vari candidati Sindaco, ma vuole capovolgere il paradigma: raccogliere le priorità della comunità direttamente dalla voce di chi vive la città, per poi presentare un documento programmatico condiviso a tutte le forze politiche prima del voto.

Per fare questo, il comitato necessita di un'applicazione digitale accessibile, moderna e fortemente visuale, capace di trasformare una semplice lamentela in una proposta strutturata, trasparente e tracciabile.

**2\. Specifiche e Requisiti dell'Applicazione**

**Gestione della Community e Accessi**

Il comitato ha espresso la ferrea volontà di evitare lo "spam" o i caricamenti anonimi che minerebbero la credibilità dell'intera iniziativa. Per poter interagire con la piattaforma, chiunque deve poter creare un proprio profilo personale in modo sicuro, fornendo le credenziali e le informazioni minime necessarie a identificarlo e a capire, eventualmente, in quale zona o quartiere risiede.

Il sistema deve gestire gli accessi in modo che ogni azione (inserimenti, interazioni) sia sempre riconducibile a un profilo verificato. Devono inoltre essere previsti dei profili con poteri speciali, dedicati ai membri del comitato stesso, che avranno il compito di supervisionare l'andamento della piattaforma.

**Raccolta delle Segnalazioni e Ciclo di Vita**

Il cuore del sistema è la raccolta delle priorità urbane. La procedura deve essere intuitiva ma documentata:

* **Ogni utente registrato deve poter inserire una nuova proposta o segnalazione di intervento** legata al territorio (es. buche stradali, illuminazione carente, aree verdi abbandonate, problemi di viabilità, criticità idrogeologiche o fenomeni di movida selvaggia).  
* **Il testo descrittivo fornito dall'utente deve essere tassativamente supportato da una prova multimediale (uno scatto fotografico o un breve video)** che attesti visivamente la reale necessità dell'intervento.  
* **Ogni segnalazione, una volta inserita, non rimane statica: deve seguire un ciclo di vita evolutivo** (es. dal momento in cui viene ricevuta fino all'eventuale presa in carico o all'invio finale ai candidati Sindaco) e deve permettere agli altri membri della community di esprimere il proprio sostegno o interesse, creando così una vera e propria classifica delle priorità cittadine più sentite.

**3\. Evoluzione Tecnologica del Sistema (Integrazione IA)**

Poiché il comitato è composto da volontari e non dispone delle risorse umane per gestire manualmente una mole massiccia di dati, l'applicazione software iniziale dovrà essere progressivamente potenziata e "complicata" (ispirandosi alle moderne pipeline di AI Engineering) integrando moduli di Intelligenza Artificiale per automatizzare i processi.

Il sistema dovrà essere predisposto per l'integrazione dei seguenti moduli intelligenti:

* **Filtro di Moderazione Automatico (Content Moderation):** Per evitare che la piattaforma diventi ricettacolo di insulti (soprattutto nel clima teso della campagna elettorale), serve un sistema basato su algoritmi NLP che analizzi il testo delle segnalazioni in tempo reale al momento dell'invio. Se l'IA rileva linguaggio volgare, offensivo o d'odio, deve bloccare la pubblicazione o contrassegnare il contenuto per la revisione da parte del comitato.  
* **Smistamento Tematico Assistito (Topic Classification):** Spesso i cittadini non sanno qual è l'esatta categoria burocratica di un problema. Il sistema deve integrare un model di classificazione testuale che analizzi la descrizione scritta dall'utente e vi associ automaticamente una o più categorie di riferimento (es. Ambiente, Mobilità Urbana, Politiche Giovanili, Decoro Urbano).  
* **Localizzazione Analitica e Controllo Visivo (Vision & Metadata):** Il comitato vuole mostrare le segnalazioni su una mappa interattiva. L'applicazione dovrà integrare un modulo capace di ispezionare i file multimediali caricati per estrarre automaticamente le coordinate geografiche originarie (metadati EXIF). Inoltre, si desidera implementare una funzione di Visione Computazionale per verificare se l'immagine caricata è coerente con il testo (evitando, ad esempio, che un utente carichi una foto non pertinente per segnalare un problema di traffico).

**4\. Output Richiesti per la Soluzione**

Per considerare il progetto pronto per la fase di sviluppo, devono essere presentati i seguenti materiali:

1. **Documento di Analisi dei Requisiti:** Traduzione delle richieste del comitato in specifiche tecniche precise e vincoli di integrità.  
2. **Progettazione Concettuale e Logica:** Diagramma Entità-Relazione (ER) completo e relativo schema logico relazionale normalizzato.  
3. **Architettura di Integrazione IA:** Schema a blocchi del sistema che illustri chiaramente come i moduli di Intelligenza Artificiale si innestano sul flusso della web app tradizionale e del database.

**5\. Richieste per la verifica di oggi:**

Realizzare i materiali 1 e 2 del punto precedente. Utilizzare il primo foglio protocollo per la richiesta 1, dettagliando i requisiti, e il secondo foglio protocollo (in orizzontale) per il modello ER (seconda  facciata) e il modello logico (terza facciata).