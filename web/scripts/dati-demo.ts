import { join } from "node:path";

/** Segnalazioni di prova: le usano npm run seed e scripts/aggiorna-foto-demo.ts. */

export const CATEGORIE = {
  mobilita: "Mobilità urbana",
  strade: "Manutenzione stradale",
  luce: "Illuminazione pubblica",
  verde: "Ambiente e verde",
  decoro: "Decoro urbano",
  sicurezza: "Sicurezza e vivibilità",
  acqua: "Rischio idrogeologico",
  giovani: "Politiche giovanili",
  sociale: "Servizi e sociale",
  altro: "Altro",
} as const;

export type Esito = "pubblica" | "presa" | "revisione" | "integrare" | "rifiuta" | "unisci";

export interface Demo {
  chiave: string;
  autore: number; // indice in CITTADINI
  titolo: string;
  descrizione: string;
  tipo: "problema" | "proposta";
  lat: number;
  lon: number;
  indirizzo: string;
  categorie: (keyof typeof CATEGORIE)[];
  esito: Esito;
  motivo?: string;
  principale?: string;
}

export const SEGNALAZIONI: Demo[] = [
  { chiave: "buca-padova", autore: 0, titolo: "Buca profonda in via Padova all'altezza del civico 80", descrizione: "Da settimane c'è una buca larga quasi un metro sulla corsia di destra. Scooter e bici la evitano all'ultimo, di sera non si vede.", tipo: "problema", lat: 45.4979, lon: 9.2272, indirizzo: "Via Padova 80", categorie: ["strade"], esito: "pubblica" },
  { chiave: "sempione-buio", autore: 1, titolo: "Lampioni spenti nel vialetto nord del Parco Sempione", descrizione: "Sei lampioni consecutivi sono spenti dal cancello di viale Byron fino all'Arena. Dopo le 19 il vialetto è completamente al buio.", tipo: "problema", lat: 45.4745, lon: 9.1765, indirizzo: "Parco Sempione, viale Byron", categorie: ["luce", "sicurezza"], esito: "presa" },
  { chiave: "ciclabile-buenos-aires", autore: 1, titolo: "Ciclabile di corso Buenos Aires interrotta dai dehors", descrizione: "In più punti tra piazza Lima e Loreto i tavolini dei bar occupano la ciclabile e costringono a scendere in carreggiata.", tipo: "problema", lat: 45.4790, lon: 9.2110, indirizzo: "Corso Buenos Aires 40", categorie: ["mobilita"], esito: "pubblica" },
  { chiave: "lambro-rifiuti", autore: 7, titolo: "Rifiuti ingombranti abbandonati al Parco Lambro", descrizione: "Vicino all'ingresso di via Feltre ci sono un materasso, due sedie e sacchi di calcinacci. Sono lì da almeno dieci giorni.", tipo: "problema", lat: 45.4985, lon: 9.2435, indirizzo: "Parco Lambro, ingresso via Feltre", categorie: ["verde", "decoro"], esito: "pubblica" },
  { chiave: "navigli-graffiti", autore: 3, titolo: "Scritte vandaliche sul ponte di via Casale", descrizione: "Il parapetto del ponte sul Naviglio Grande è stato ricoperto di scritte spray. È uno dei punti più fotografati dai turisti.", tipo: "problema", lat: 45.4523, lon: 9.1752, indirizzo: "Alzaia Naviglio Grande, ponte di via Casale", categorie: ["decoro"], esito: "pubblica" },
  { chiave: "corso-como-rumore", autore: 4, titolo: "Rumore fino alle tre di notte in corso Como", descrizione: "Nel fine settimana gruppi numerosi restano in strada fino a tardi con musica alta. Chi abita qui non riesce a dormire.", tipo: "problema", lat: 45.4822, lon: 9.1873, indirizzo: "Corso Como 10", categorie: ["sicurezza"], esito: "pubblica" },
  { chiave: "niguarda-tombini", autore: 2, titolo: "Tombini ostruiti in via Ornato, la strada si allaga", descrizione: "A ogni temporale l'acqua arriva al marciapiede perché le caditoie sono piene di foglie e terra. Le auto parcheggiate si bagnano fino alle portiere.", tipo: "problema", lat: 45.5165, lon: 9.1915, indirizzo: "Via Ornato 30", categorie: ["acqua"], esito: "pubblica" },
  { chiave: "bovisa-aula-studio", autore: 5, titolo: "Un'aula studio aperta la sera in Bovisa", descrizione: "Propongo di aprire fino alle 23 una sala del centro civico di via Candiani: molti studenti del Politecnico e delle superiori non hanno un posto tranquillo dove studiare.", tipo: "proposta", lat: 45.5032, lon: 9.1602, indirizzo: "Via Candiani", categorie: ["giovani"], esito: "presa" },
  { chiave: "citta-studi-scivolo", autore: 4, titolo: "Marciapiede senza scivolo davanti alla fermata del 93", descrizione: "Chi è in carrozzina o con un passeggino deve scendere in strada per raggiungere la fermata. Manca lo scivolo su entrambi i lati.", tipo: "problema", lat: 45.4782, lon: 9.2268, indirizzo: "Via Pascal, fermata 93", categorie: ["sociale", "mobilita"], esito: "pubblica" },
  { chiave: "montanelli-panchine", autore: 0, titolo: "Panchine rotte ai Giardini Montanelli", descrizione: "Tre panchine vicino al laghetto hanno le assi spaccate e chiodi sporgenti. Ci giocano molti bambini, è pericoloso.", tipo: "problema", lat: 45.4745, lon: 9.2010, indirizzo: "Giardini Indro Montanelli", categorie: ["decoro"], esito: "pubblica" },
  { chiave: "viale-monza-attraversamento", autore: 7, titolo: "Attraversamento pericoloso in viale Monza vicino a Gorla", descrizione: "Le strisce non hanno semaforo e le auto arrivano veloci dal sottopasso. Servirebbe almeno un semaforo a chiamata.", tipo: "problema", lat: 45.5040, lon: 9.2235, indirizzo: "Viale Monza 220", categorie: ["mobilita", "sicurezza"], esito: "pubblica" },
  { chiave: "gratosoglio-alberi", autore: 6, titolo: "Rami pericolanti sugli alberi di via Saponaro", descrizione: "Dopo l'ultimo temporale alcuni rami grossi sono rimasti spezzati e appesi sopra il marciapiede, proprio davanti alla scuola.", tipo: "problema", lat: 45.4100, lon: 9.1735, indirizzo: "Via Saponaro", categorie: ["verde"], esito: "pubblica" },
  { chiave: "buca-padova-bis", autore: 2, titolo: "Voragine in via Padova vicino a via Arquà", descrizione: "Una buca enorme sulla destra, ci ho quasi perso la ruota della bici. Andrebbe chiusa prima che qualcuno si faccia male.", tipo: "problema", lat: 45.4981, lon: 9.2276, indirizzo: "Via Padova angolo via Arquà", categorie: ["strade"], esito: "unisci", principale: "buca-padova" },
  { chiave: "quarto-oggiaro-orti", autore: 5, titolo: "Orti urbani nell'area verde di via Lopez", descrizione: "L'area verde dietro i palazzi di via Lopez è poco usata. Si potrebbe trasformarla in orti condivisi gestiti dalle associazioni del quartiere.", tipo: "proposta", lat: 45.5135, lon: 9.1365, indirizzo: "Via Lopez", categorie: ["verde", "giovani"], esito: "pubblica" },
  { chiave: "lorenteggio-lampione", autore: 6, titolo: "Lampione abbattuto in via Lorenteggio", descrizione: "Il lampione all'incrocio con via Inganni è stato abbattuto da un'auto e ora è appoggiato alla recinzione, con i fili scoperti.", tipo: "problema", lat: 45.4520, lon: 9.1300, indirizzo: "Via Lorenteggio angolo via Inganni", categorie: ["luce"], esito: "revisione" },
  { chiave: "corvetto-parco", autore: 3, titolo: "Problema nel parchetto di piazzale Corvetto", descrizione: "Nel parchetto c'è qualcosa che non va da un po' di tempo, sarebbe il caso che qualcuno passasse a vedere.", tipo: "problema", lat: 45.4400, lon: 9.2240, indirizzo: "Piazzale Corvetto", categorie: ["altro"], esito: "integrare", motivo: "Puoi indicare con precisione qual è il problema e aggiungere una foto che lo mostri?" },
  { chiave: "fuori-tema", autore: 1, titolo: "Il mio vicino parcheggia sempre male", descrizione: "Il vicino del terzo piano lascia sempre la macchina storta e occupa due posti, qualcuno dovrebbe dirglielo.", tipo: "problema", lat: 45.4650, lon: 9.1500, indirizzo: "Via Washington", categorie: ["altro"], esito: "rifiuta", motivo: "Questione tra privati: non riguarda il bene comune della città." },
  { chiave: "loreto-piazza", autore: 0, titolo: "Piazzale Loreto: semafori pedonali troppo brevi", descrizione: "Il verde pedonale per attraversare viale Monza dura pochi secondi. Gli anziani restano a metà strada quando scatta il rosso.", tipo: "problema", lat: 45.4860, lon: 9.2165, indirizzo: "Piazzale Loreto", categorie: ["mobilita", "sociale"], esito: "revisione" },
];

/** Foto vere da Wikimedia Commons, una per segnalazione (crediti in foto-demo/crediti.json). */
export const fotoDemo = (chiave: string) => join(process.cwd(), "scripts", "foto-demo", `${chiave}.jpg`);
