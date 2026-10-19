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
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomInt } from "node:crypto";
import sharp from "sharp";
import QRCode from "qrcode";
import { db, inTransazione, pool } from "../src/lib/server/db";
import { cifraSegreto, hashPassword, nuovoSegretoTotp, uriTotp } from "../src/lib/server/auth/cripto";
import { elaboraFoto } from "../src/lib/server/foto";
import { cambiaStato, inviaSegnalazione } from "../src/lib/server/segnalazioni";
import { CATEGORIE, SEGNALAZIONI, fotoDemo } from "./dati-demo";

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

/** Segnaposto disegnato, usato solo se manca la foto della segnalazione. */
async function fotoSegnaposto(titolo: string, colore: string, n: number): Promise<Buffer> {
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
    const file = fotoDemo(s.chiave);
    const originale = existsSync(file)
      ? readFileSync(file)
      : await fotoSegnaposto(s.titolo, cat[0].colore_mappa, s.chiave.length % 4);
    const foto = await elaboraFoto(originale);
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
