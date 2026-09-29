-- =============================================================================
-- Dati di riferimento (configurazione iniziale). Territorio in 02_territorio.sql.
-- =============================================================================

SET NAMES utf8mb4;

-- Ruoli (2.3): cumulativi verso l'alto tramite "livello"
INSERT INTO ruolo (id, codice, nome, descrizione, livello) VALUES
  (1, 'cittadino',      'Cittadino',      'Utente registrato: inserisce, sostiene e commenta segnalazioni', 1),
  (2, 'moderatore',     'Moderatore',     'Membro del comitato: revisiona contenuti, cambia stato, sospende utenti', 2),
  (3, 'amministratore', 'Amministratore', 'Membro del comitato con pieni poteri di configurazione ed esportazione', 3);

-- Stati del ciclo di vita (4.1)
INSERT INTO stato (codice, nome, descrizione, finale, pubblico, votabile, in_classifica, ordine) VALUES
  ('BOZZA',             'Bozza',               'Salvata ma non inviata',                                                    FALSE, FALSE, FALSE, FALSE,  1),
  ('RICEVUTA',          'Ricevuta',            'Inviata; in analisi automatica dai moduli IA',                              FALSE, FALSE, FALSE, FALSE,  2),
  ('IN_REVISIONE',      'In revisione',        'Marcata dall''IA o da utenti; attende un moderatore',                       FALSE, FALSE, FALSE, FALSE,  3),
  ('DA_INTEGRARE',      'Da integrare',        'Il moderatore chiede all''autore più informazioni o una foto pertinente',  FALSE, FALSE, FALSE, FALSE,  4),
  ('RIFIUTATA',         'Rifiutata',           'Non conforme (offensiva, fuori tema, fuori Milano, falsa)',                 TRUE,  FALSE, FALSE, FALSE,  5),
  ('PUBBLICATA',        'Pubblicata',          'Visibile su mappa e classifica',                                           FALSE, TRUE,  TRUE,  TRUE,   6),
  ('PRESA_IN_CARICO',   'Presa in carico',     'Il comitato la inserisce nella bozza del documento programmatico',          FALSE, TRUE,  TRUE,  TRUE,   7),
  ('INVIATA_CANDIDATI', 'Inviata ai candidati','Inclusa nel documento consegnato ai candidati',                            TRUE,  TRUE,  FALSE, TRUE,   8),
  ('UNITA',             'Unita',               'Duplicato confluito in un''altra segnalazione',                             TRUE,  TRUE,  FALSE, FALSE,  9),
  ('ARCHIVIATA',        'Archiviata',          'Nessuna attività per 120 giorni o superata; riattivabile dal moderatore',   FALSE, TRUE,  FALSE, FALSE, 10),
  ('RITIRATA',          'Ritirata',            'Ritirata dall''autore',                                                     TRUE,  FALSE, FALSE, FALSE, 11);

-- Transizioni ammesse (4.2). Le righe marcate [+] colmano lacune del documento.
INSERT INTO transizione_ammessa (stato_da, stato_a, attore, motivazione_obbligatoria, condizione) VALUES
  ('BOZZA',           'RICEVUTA',          'autore',         FALSE, 'Campi obbligatori completi, 1-5 allegati, posizione dentro Milano'),
  ('RICEVUTA',        'PUBBLICATA',        'sistema',        FALSE, 'Moderazione sotto soglia, immagine coerente, almeno 1 categoria con confidenza >= 0,6'),
  ('RICEVUTA',        'IN_REVISIONE',      'sistema',        FALSE, 'Testo sospetto, immagine incoerente, EXIF > 1 km, categoria incerta o modulo IA in errore (RIA-04)'),
  ('RICEVUTA',        'RIFIUTATA',         'sistema',        TRUE,  'Tossicità >= 0,9; riesaminabile dal moderatore'),
  ('IN_REVISIONE',    'PUBBLICATA',        'moderatore',     FALSE, 'Approvata dal moderatore'),
  ('IN_REVISIONE',    'DA_INTEGRARE',      'moderatore',     TRUE,  'Richiesta di integrazione all''autore'),
  ('IN_REVISIONE',    'RIFIUTATA',         'moderatore',     TRUE,  'Rifiutata dal moderatore'),
  ('RIFIUTATA',       'IN_REVISIONE',      'moderatore',     TRUE,  '[+] Riesame di un rifiuto (RIA-06, UC-01 8b)'),
  ('DA_INTEGRARE',    'RICEVUTA',          'autore',         FALSE, 'Modifica inviata entro 14 giorni'),
  ('DA_INTEGRARE',    'RITIRATA',          'sistema',        TRUE,  '[+] Nessuna integrazione entro 14 giorni (job notturno)'),
  ('PUBBLICATA',      'IN_REVISIONE',      'sistema',        FALSE, 'Almeno 3 segnalazioni di abuso distinte'),
  ('PUBBLICATA',      'PRESA_IN_CARICO',   'moderatore',     FALSE, 'Scelta del comitato'),
  ('PUBBLICATA',      'UNITA',             'moderatore',     FALSE, 'Indicata la segnalazione principale'),
  ('PUBBLICATA',      'ARCHIVIATA',        'sistema',        FALSE, '120 giorni senza nuovi sostegni o commenti (job notturno)'),
  ('ARCHIVIATA',      'PUBBLICATA',        'moderatore',     FALSE, '[+] Riattivazione (diagramma 4 e tabella 4.1)'),
  ('PRESA_IN_CARICO', 'INVIATA_CANDIDATI', 'amministratore', FALSE, 'Documento programmatico esportato e inviato'),
  ('BOZZA',           'RITIRATA',          'autore',         FALSE, 'Ritiro da parte dell''autore'),
  ('RICEVUTA',        'RITIRATA',          'autore',         FALSE, 'Ritiro da parte dell''autore'),
  ('DA_INTEGRARE',    'RITIRATA',          'autore',         FALSE, 'Ritiro da parte dell''autore'),
  ('PUBBLICATA',      'RITIRATA',          'autore',         FALSE, 'Ritiro da parte dell''autore');

-- Catalogo iniziale delle categorie (7.4)
INSERT INTO categoria (nome, descrizione, colore_mappa, ordine) VALUES
  ('Mobilità urbana',        'Viabilità, piste ciclabili, trasporto pubblico, parcheggi',             '#2563EB',  1),
  ('Manutenzione stradale',  'Buche, marciapiedi, segnaletica',                                        '#92400E',  2),
  ('Illuminazione pubblica', 'Lampioni spenti, zone buie',                                             '#CA8A04',  3),
  ('Ambiente e verde',       'Aree verdi abbandonate, alberi, rifiuti, inquinamento',                  '#16A34A',  4),
  ('Decoro urbano',          'Graffiti, edifici degradati, arredo urbano',                             '#9333EA',  5),
  ('Sicurezza e vivibilità', 'Movida selvaggia, rumore, zone percepite come insicure',                 '#DC2626',  6),
  ('Rischio idrogeologico',  'Allagamenti, tombini ostruiti, esondazioni',                             '#0891B2',  7),
  ('Politiche giovanili',    'Spazi di aggregazione, sport, cultura, studio',                          '#EA580C',  8),
  ('Servizi e sociale',      'Scuole, sanità territoriale, accessibilità per disabili',                '#DB2777',  9),
  ('Altro',                  'Segnalazioni non classificabili, da smistare a mano',                    '#64748B', 10);

-- Parametri configurabili dall'amministratore (RF-45)
INSERT INTO parametro_sistema (chiave, valore, valore_min, valore_max, unita, descrizione) VALUES
  -- Moderazione testo (RIA-06)
  ('ia.moderazione.soglia_revisione',    0.5,   0,    1,     NULL,     'Punteggio max >= soglia: In revisione'),
  ('ia.moderazione.soglia_blocco',       0.9,   0,    1,     NULL,     'Punteggio max >= soglia: Rifiutata (riesaminabile)'),
  ('ia.moderazione.timeout_ms',          2000,  100,  30000, 'ms',     'Timeout della moderazione sincrona (RIA-08)'),
  -- Classificazione (RIA-09)
  ('ia.classificazione.soglia_proposta', 0.6,   0,    1,     NULL,     'Confidenza minima per proporre una categoria'),
  ('ia.classificazione.max_proposte',    3,     1,    10,    NULL,     'Numero massimo di categorie proposte'),
  -- Vision & metadata (RIA-13, RIA-14, RIA-17)
  ('ia.exif.distanza_max_m',             1000,  50,   50000, 'm',      'Distanza EXIF-posizione dichiarata oltre cui va In revisione'),
  ('ia.exif.giorni_foto_datata',         90,    1,    3650,  'giorni', 'Foto più vecchia di così: foto datata'),
  ('ia.coerenza.soglia_revisione',       0.4,   0,    1,     NULL,     'Pertinenza immagine-testo sotto soglia: In revisione'),
  ('ia.video.intervallo_fotogrammi_s',   2,     1,    30,    's',      'Campionamento fotogrammi dei video'),
  ('ia.video.max_fotogrammi',            30,    1,    300,   NULL,     'Numero massimo di fotogrammi analizzati'),
  -- Punteggio di priorità (7.3)
  ('priorita.peso_stesso_municipio',     1.5,   0.1,  10,    NULL,     'w_i se il sostenitore risiede nel Municipio della segnalazione'),
  ('priorita.peso_altro',                1,     0.1,  10,    NULL,     'w_i negli altri casi'),
  ('priorita.coeff_commentatori',        0.3,   0,    10,    NULL,     'Coefficiente di C_u (utenti distinti che hanno commentato)'),
  ('priorita.tendenza_giorni',           30,    1,    365,   'giorni', 'Divisore della vista Di tendenza: P / (1 + giorni/valore)'),
  -- Segnalazioni e community
  ('segnalazione.max_giornaliere',       5,     1,    100,   NULL,     'Limite anti-spam per utente nelle ultime 24 ore (RF-18)'),
  ('segnalazione.max_allegati',          5,     1,    5,     NULL,     'Allegati per segnalazione (RF-21)'),
  ('segnalazione.raggio_duplicati_m',    200,   10,   5000,  'm',      'Raggio di ricerca segnalazioni simili (RF-16)'),
  ('segnalazione.giorni_archiviazione',  120,   7,    3650,  'giorni', 'Inattività oltre cui la segnalazione è archiviata'),
  ('segnalazione.giorni_da_integrare',   14,    1,    365,   'giorni', 'Tempo per integrare prima del ritiro automatico'),
  ('segnalazione.giorni_bozza',          30,    1,    365,   'giorni', 'Conservazione delle bozze (RF-17)'),
  ('abuso.soglia_revisione',             3,     1,    100,   NULL,     'Segnalazioni di abuso distinte che mandano il contenuto In revisione (RF-34)'),
  -- Account e sicurezza
  ('auth.max_tentativi',                 5,     1,    50,    NULL,     'Tentativi di accesso falliti prima del blocco (RF-03)'),
  ('auth.finestra_minuti',               15,    1,    1440,  'min',    'Finestra di conteggio dei tentativi falliti'),
  ('auth.blocco_minuti',                 15,    1,    1440,  'min',    'Durata del blocco temporaneo'),
  ('auth.verifica_email_ore',            24,    1,    168,   'ore',    'Validità del link di verifica email (RF-02)'),
  ('auth.reset_password_minuti',         60,    5,    1440,  'min',    'Validità del link di recupero password (RF-05)'),
  ('account.giorni_anonimizzazione',     7,     0,    30,    'giorni', 'Attesa prima di anonimizzare un account cancellato (max 30, RF-08)'),
  ('log.giorni_accessi',                 180,   30,   730,   'giorni', 'Conservazione del registro accessi (RNF-12)');
