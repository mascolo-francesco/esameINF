/**
 * Dati di prova per lo sviluppo e la demo: utenti, staff, segnalazioni in vari stati, sostegni,
 * commenti e candidati. Passa dalle stesse funzioni dell'app (hash delle password, foto,
 * sp_cambia_stato), quindi i trigger controllano anche questi dati.
 *
 *   npm run seed
 *
 * Parte solo su un database senza utenti. Le credenziali generate finiscono in web/.demo/,
 * cartella esclusa da git.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomInt } from "node:crypto";
import sharp from "sharp";
import QRCode from "qrcode";
import { db, inTransazione, pool } from "../src/lib/server/db";
import { cifraSegreto, hashPassword, nuovoSegretoTotp, uriTotp } from "../src/lib/server/auth/cripto";
import { elaboraFoto } from "../src/lib/server/foto";
import { cambiaStato, inviaSegnalazione } from "../src/lib/server/segnalazioni";

const IP = "127.0.0.1";

function password(): string {
  const alfabeto = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 14 }, () => alfabeto[randomInt(alfabeto.length)]).join("");
}

const CITTADINI = [
  { nome: "Giulia", cognome: "Ferri", pseudonimo: "giulia_nolo", quartiere: "LORETO - CASORETTO - NOLO", nascita: "1998-04-12", mostra: false },
  { nome: "Marco", cognome: "Colombo", pseudonimo: "MarcoBici", quartiere: "BUENOS AIRES - PORTA VENEZIA - PORTA MONFORTE", nascita: "1987-09-03", mostra: true },
  { nome: "Sara", cognome: "Galli", pseudonimo: "sara.niguarda", quartiere: "NIGUARDA - CA' GRANDA - PRATO CENTENARO - Q.RE FULVIO TESTI", nascita: "2003-01-27", mostra: false },
  { nome: "Luca", cognome: "Bianchi", pseudonimo: "luca_navigli", quartiere: "PORTA TICINESE - CONCHETTA", nascita: "1979-11-15", mostra: false },
  { nome: "Elena", cognome: "Fontana", pseudonimo: "ElenaF", quartiere: "CITTA' STUDI", nascita: "1992-06-30", mostra: true },
  { nome: "Davide", cognome: "Russo", pseudonimo: "davide_bovisa", quartiere: "BOVISA", nascita: "2005-03-08", mostra: false },
  { nome: "Chiara", cognome: "Marino", pseudonimo: "chiara.m", quartiere: "GRATOSOGLIO - Q.RE MISSAGLIA - Q.RE TERRAZZE", nascita: "1984-12-01", mostra: false },
  { nome: "Paolo", cognome: "Greco", pseudonimo: "paolo_lambrate", quartiere: "LAMBRATE - ORTICA", nascita: "1969-08-21", mostra: false },
];

const CATEGORIE = {
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

type Esito = "pubblica" | "presa" | "revisione" | "integrare" | "rifiuta" | "unisci";

interface Demo {
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

const SEGNALAZIONI: Demo[] = [
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

const SOSTEGNI: Record<string, number> = {
  "buca-padova": 6, "sempione-buio": 7, "ciclabile-buenos-aires": 5, "lambro-rifiuti": 4, "navigli-graffiti": 3,
  "corso-como-rumore": 5, "niguarda-tombini": 2, "bovisa-aula-studio": 6, "citta-studi-scivolo": 4,
  "montanelli-panchine": 2, "viale-monza-attraversamento": 3, "gratosoglio-alberi": 1, "quarto-oggiaro-orti": 3,
  "buca-padova-bis": 1,
};

const COMMENTI: [string, number, string][] = [
  ["buca-padova", 2, "Confermo, ci passo ogni mattina in bici ed è peggiorata con la pioggia."],
  ["buca-padova", 7, "Ho visto un motorino cadere proprio lì la settimana scorsa."],
  ["sempione-buio", 4, "La sera evito di passare di lì, è davvero buio."],
  ["sempione-buio", 3, "Anche dal lato di via Gadio ce ne sono due spenti."],
  ["ciclabile-buenos-aires", 5, "Il problema c'è soprattutto il sabato pomeriggio."],
  ["bovisa-aula-studio", 2, "Ottima idea, al Politecnico le aule chiudono presto."],
  ["bovisa-aula-studio", 6, "Sarebbe utile anche per i ragazzi delle medie con i compiti."],
  ["corso-como-rumore", 1, "Servirebbero più controlli nel fine settimana."],
  ["citta-studi-scivolo", 0, "Mia madre usa il deambulatore e ha lo stesso problema."],
  ["quarto-oggiaro-orti", 7, "La parrocchia vicina potrebbe dare una mano a gestirli."],
];

async function fotoDemo(titolo: string, colore: string, n: number): Promise<Buffer> {
  const righe = titolo.match(/.{1,34}(\s|$)/g)?.map((r) => r.trim()) ?? [titolo];
  const testo = righe
    .slice(0, 3)
    .map((r, i) => `<text x="60" y="${560 + i * 64}" font-size="52" font-family="Helvetica, Arial" font-weight="700" fill="#fff">${r.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</text>`)
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${colore}"/><stop offset="1" stop-color="#111827"/></linearGradient></defs>
    <rect width="1200" height="900" fill="url(#g)"/>
    <circle cx="${900 - n * 120}" cy="260" r="180" fill="#ffffff" fill-opacity="0.12"/>
    <text x="60" y="110" font-size="34" font-family="Helvetica, Arial" fill="#fff" fill-opacity="0.8">Foto di esempio · demo</text>
    ${testo}</svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 82 }).toBuffer();
}

async function main() {
  const esistenti = await db.riga<{ n: number }>("SELECT COUNT(*) AS n FROM utente");
  if (esistenti && esistenti.n > 0) {
    console.error(`Il database contiene già ${esistenti.n} utenti: il seed parte solo su un database senza utenti.`);
    process.exit(1);
  }

  const pwCittadini = password();
  const pwModeratore = password();
  const pwAdmin = password();
  const [hCittadini, hMod, hAdmin] = await Promise.all([hashPassword(pwCittadini), hashPassword(pwModeratore), hashPassword(pwAdmin)]);

  const quartieri = new Map(
    (await db.righe<{ id: number; nome: string }>("SELECT id, nome FROM quartiere")).map((q) => [q.nome, q.id]),
  );
  const categorie = new Map(
    (await db.righe<{ id: number; nome: string; colore_mappa: string }>("SELECT id, nome, colore_mappa FROM categoria")).map(
      (k) => [k.nome, k],
    ),
  );

  // --- utenti (l'email è verificata subito: nella demo non si inviano email)
  const idCittadini: number[] = [];
  for (const c of CITTADINI) {
    const idQ = quartieri.get(c.quartiere);
    if (!idQ) throw new Error(`Quartiere non trovato: ${c.quartiere}`);
    const email = `${c.nome}.${c.cognome}@example.com`.toLowerCase();
    const { insertId } = await db.esegui(
      `INSERT INTO utente (nome, cognome, email, password_hash, data_nascita, nome_visualizzato, mostra_nome_reale,
                           stato_account, email_verificata_il, consenso_privacy_il, id_quartiere)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'attivo', NOW(), NOW(), ?)`,
      [c.nome, c.cognome, email, hCittadini, c.nascita, c.pseudonimo, c.mostra, idQ],
    );
    idCittadini.push(insertId);
  }

  const staff = [
    { nome: "Martina", cognome: "Moretti", pseudonimo: "Comitato · Martina", email: "moderatrice@example.com", ruolo: 2, hash: hMod, pw: pwModeratore },
    { nome: "Stefano", cognome: "Conti", pseudonimo: "Comitato · Stefano", email: "admin@example.com", ruolo: 3, hash: hAdmin, pw: pwAdmin },
  ];
  const segretiStaff: { email: string; pw: string; segreto: string; uri: string; ruolo: string }[] = [];
  const idStaff: number[] = [];
  for (const s of staff) {
    const segreto = nuovoSegretoTotp();
    const { insertId } = await db.esegui(
      `INSERT INTO utente (nome, cognome, email, password_hash, data_nascita, nome_visualizzato, stato_account,
                           email_verificata_il, consenso_privacy_il, id_quartiere, id_ruolo, totp_attivo, totp_segreto)
       VALUES (?, ?, ?, ?, '1990-01-01', ?, 'attivo', NOW(), NOW(), ?, ?, TRUE, ?)`,
      [s.nome, s.cognome, s.email, s.hash, s.pseudonimo, quartieri.get("DUOMO")!, s.ruolo, cifraSegreto(segreto)],
    );
    idStaff.push(insertId);
    segretiStaff.push({ email: s.email, pw: s.pw, segreto, uri: uriTotp(segreto, s.email), ruolo: s.ruolo === 2 ? "Moderatrice" : "Amministratore" });
  }
  const [idMod, idAdmin] = idStaff;
  console.log(`Utenti: ${idCittadini.length} cittadini, 1 moderatrice, 1 amministratore`);

  // --- segnalazioni: invio come nell'app, poi decisione della moderatrice
  const idSegn = new Map<string, number>();
  for (const s of SEGNALAZIONI) {
    const cat = s.categorie.map((k) => categorie.get(CATEGORIE[k])!);
    const foto = await elaboraFoto(await fotoDemo(s.titolo, cat[0].colore_mappa, s.chiave.length % 4));
    const { id, codice } = await inviaSegnalazione(
      { idUtente: idCittadini[s.autore], ip: IP },
      {
        titolo: s.titolo,
        descrizione: s.descrizione,
        tipo: s.tipo,
        latitudine: s.lat,
        longitudine: s.lon,
        indirizzo: s.indirizzo,
        fonte: "manuale",
        categorie: cat.map((k) => k.id),
        foto: [foto],
      },
    );
    idSegn.set(s.chiave, id);

    await inTransazione({ idUtente: idMod, ip: IP }, async (tx) => {
      if (["pubblica", "presa", "unisci"].includes(s.esito)) await cambiaStato(tx, id, "PUBBLICATA", "moderatore", idMod);
      if (s.esito === "presa") await cambiaStato(tx, id, "PRESA_IN_CARICO", "moderatore", idMod);
      if (s.esito === "integrare") await cambiaStato(tx, id, "DA_INTEGRARE", "moderatore", idMod, s.motivo);
      if (s.esito === "rifiuta") await cambiaStato(tx, id, "RIFIUTATA", "moderatore", idMod, s.motivo);
    });
    console.log(`  ${codice}  ${s.esito.padEnd(9)}  ${s.titolo}`);
  }

  // --- sostegni e commenti (prima dell'unione: i sostegni del duplicato passano alla principale)
  for (const [chiave, n] of Object.entries(SOSTEGNI)) {
    const id = idSegn.get(chiave)!;
    const autore = idCittadini[SEGNALAZIONI.find((s) => s.chiave === chiave)!.autore];
    const sostenitori = idCittadini.filter((u) => u !== autore).slice(0, n);
    for (const u of sostenitori) {
      await inTransazione({ idUtente: u, ip: IP }, (tx) =>
        tx.esegui("INSERT INTO sostegno (id_utente, id_segnalazione, indirizzo_ip) VALUES (?, ?, ?)", [u, id, IP]),
      );
    }
  }
  for (const [chiave, autore, testo] of COMMENTI) {
    // senza moderazione automatica i commenti sono subito visibili
    await inTransazione({ idUtente: idCittadini[autore], ip: IP }, (tx) =>
      tx.esegui("INSERT INTO commento (id_segnalazione, id_autore, testo, stato) VALUES (?, ?, ?, 'visibile')", [
        idSegn.get(chiave)!,
        idCittadini[autore],
        testo,
      ]),
    );
  }
  for (const s of SEGNALAZIONI.filter((x) => x.esito === "unisci")) {
    await inTransazione({ idUtente: idMod, ip: IP }, (tx) =>
      cambiaStato(tx, idSegn.get(s.chiave)!, "UNITA", "moderatore", idMod, null, idSegn.get(s.principale!)!),
    );
  }
  console.log(`Sostegni e ${COMMENTI.length} commenti inseriti`);

  // --- un commento segnalato come fuori tema, per la coda di moderazione
  const { insertId: idCommento } = await inTransazione({ idUtente: idCittadini[5], ip: IP }, (tx) =>
    tx.esegui("INSERT INTO commento (id_segnalazione, id_autore, testo, stato) VALUES (?, ?, ?, 'visibile')", [
      idSegn.get("navigli-graffiti")!,
      idCittadini[5],
      "Seguitemi sul mio canale per altre foto dei Navigli!!!",
    ]),
  );
  await inTransazione({ idUtente: idCittadini[3], ip: IP }, (tx) =>
    tx.esegui("INSERT INTO segnalazione_abuso (id_segnalante, id_commento, motivo, nota) VALUES (?, ?, 'spam', ?)", [
      idCittadini[3],
      idCommento,
      "Pubblicità del proprio canale",
    ]),
  );

  // --- candidati fittizi per il documento programmatico
  for (const [nome, cognome, lista] of [
    ["Alessandra", "Riva", "Lista civica Milano Domani (demo)"],
    ["Giorgio", "Sala", "Coalizione Città Aperta (demo)"],
    ["Federica", "Longo", "Movimento Quartieri al Centro (demo)"],
  ]) {
    await db.esegui("INSERT INTO candidato (nome, cognome, lista_coalizione, email_contatto) VALUES (?, ?, ?, ?)", [
      nome,
      cognome,
      lista,
      `${nome}.${cognome}@example.com`.toLowerCase(),
    ]);
  }
  console.log("Candidati fittizi inseriti");
  void idAdmin;

  // --- credenziali in locale, mai nel repository
  const dir = join(process.cwd(), ".demo");
  mkdirSync(dir, { recursive: true });
  const qr: string[] = [];
  for (const s of segretiStaff) {
    const file = `qr-${s.email.split("@")[0]}.svg`;
    writeFileSync(join(dir, file), await QRCode.toString(s.uri, { type: "svg", margin: 2 }));
    qr.push(file);
  }
  const md = [
    "# Credenziali della demo",
    "",
    "File generato da `npm run seed`. Non va nel repository.",
    "",
    "## Cittadini",
    "",
    `Password comune: \`${pwCittadini}\``,
    "",
    ...CITTADINI.map((c) => `- ${`${c.nome}.${c.cognome}@example.com`.toLowerCase()} (${c.pseudonimo})`),
    "",
    "## Staff (2FA obbligatoria)",
    "",
    ...segretiStaff.flatMap((s, i) => [
      `### ${s.ruolo}`,
      "",
      `- Email: ${s.email}`,
      `- Password: \`${s.pw}\``,
      `- Segreto TOTP: \`${s.segreto}\` (QR in \`${qr[i]}\`)`,
      `- URI: \`${s.uri}\``,
      "",
    ]),
  ].join("\n");
  writeFileSync(join(dir, "credenziali.md"), md, { mode: 0o600 });
  console.log("Credenziali scritte in web/.demo/credenziali.md");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => pool().end());
