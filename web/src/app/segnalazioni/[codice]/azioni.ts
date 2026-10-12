"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, inTransazione } from "@/lib/server/db";
import { ErroreApp, isDuplicato } from "@/lib/server/errori";
import { datiForm, eseguiAzione, type Esito } from "@/lib/server/azione";
import { contestoRichiesta, richiediUtente } from "@/lib/server/auth/sessione";
import { cambiaStato, MOTIVO_SENZA_IA } from "@/lib/server/segnalazioni";
import { schemaCommento } from "@/lib/validazione";

const schemaCodice = z.string().regex(/^MI-\d{4}-\d{6}$/);

async function idDaCodice(codice: string): Promise<number> {
  const r = await db.riga<{ id: number }>("SELECT id FROM segnalazione WHERE codice_pubblico = ?", [schemaCodice.parse(codice)]);
  if (!r) throw new ErroreApp("Segnalazione non trovata.");
  return r.id;
}

/** Utente che può scrivere + attore per l'audit. I vincoli veri li applicano i trigger. */
async function scrittore() {
  const u = await richiediUtente();
  if (!u.puoScrivere) throw new ErroreApp("Il tuo account al momento non può partecipare.");
  const { ip } = await contestoRichiesta();
  return { u, attore: { idUtente: u.id, ip } };
}

const aggiorna = (codice: string) => revalidatePath(`/segnalazioni/${codice}`);

// RF-31: sostegno (uno per utente, non alla propria, solo se votabile: lo garantisce il DB)
export async function sostieni(codice: string): Promise<Esito> {
  return eseguiAzione(async () => {
    const { u, attore } = await scrittore();
    const id = await idDaCodice(codice);
    try {
      await inTransazione(attore, (tx) =>
        tx.esegui("INSERT INTO sostegno (id_utente, id_segnalazione, indirizzo_ip) VALUES (?, ?, ?)", [u.id, id, attore.ip]),
      );
    } catch (e) {
      if (isDuplicato(e)) throw new ErroreApp("Hai già sostenuto questa segnalazione.");
      throw e;
    }
    aggiorna(codice);
  }, "Grazie per il tuo sostegno!");
}

export async function ritiraSostegno(codice: string): Promise<Esito> {
  return eseguiAzione(async () => {
    const { u, attore } = await scrittore();
    const id = await idDaCodice(codice);
    await inTransazione(attore, (tx) => tx.esegui("DELETE FROM sostegno WHERE id_utente = ? AND id_segnalazione = ?", [u.id, id]));
    aggiorna(codice);
  }, "Sostegno ritirato.");
}

// RF-37
export async function seguiSegnalazione(codice: string, segui: boolean): Promise<Esito> {
  return eseguiAzione(async () => {
    const u = await richiediUtente();
    const id = await idDaCodice(codice);
    if (segui) await db.esegui("INSERT IGNORE INTO segue (id_utente, id_segnalazione) VALUES (?, ?)", [u.id, id]);
    else await db.esegui("DELETE FROM segue WHERE id_utente = ? AND id_segnalazione = ?", [u.id, id]);
    aggiorna(codice);
  }, segui ? "Riceverai una notifica a ogni cambio di stato." : "Non segui più questa segnalazione.");
}

// RF-33. Senza il filtro IA il commento è subito visibile; il controllo resta la segnalazione di abuso.
export async function commenta(_: Esito | null, fd: FormData): Promise<Esito> {
  const codice = String(fd.get("codice") ?? "");
  return eseguiAzione(async () => {
    const { u, attore } = await scrittore();
    const id = await idDaCodice(codice);
    const { testo } = schemaCommento.parse(datiForm(fd));
    await inTransazione(attore, (tx) =>
      tx.esegui("INSERT INTO commento (id_segnalazione, id_autore, testo, stato) VALUES (?, ?, ?, 'visibile')", [id, u.id, testo]),
    );
    aggiorna(codice);
  }, "Commento pubblicato.");
}

const schemaAbuso = z.object({
  oggetto: z.enum(["segnalazione", "commento", "aggiornamento"]),
  idOggetto: z.coerce.number().int().positive(),
  motivo: z.enum(["offensivo", "odio_discriminazione", "spam", "falso", "fuori_tema", "dati_personali", "altro"], {
    error: "Scegli un motivo",
  }),
  nota: z
    .string()
    .trim()
    .max(500, "Al massimo 500 caratteri")
    .optional()
    .transform((s) => s || null),
});

// RF-34
export async function segnalaAbuso(_: Esito | null, fd: FormData): Promise<Esito> {
  const codice = String(fd.get("codice") ?? "");
  return eseguiAzione(async () => {
    const { u, attore } = await scrittore();
    const d = schemaAbuso.parse(datiForm(fd));
    const col = { segnalazione: "id_segnalazione", commento: "id_commento", aggiornamento: "id_aggiornamento" }[d.oggetto];
    try {
      await inTransazione(attore, (tx) =>
        tx.esegui(`INSERT INTO segnalazione_abuso (id_segnalante, ${col}, motivo, nota) VALUES (?, ?, ?, ?)`, [
          u.id,
          d.idOggetto,
          d.motivo,
          d.nota,
        ]),
      );
    } catch (e) {
      if (isDuplicato(e)) throw new ErroreApp("Hai già segnalato questo contenuto.");
      throw e;
    }
    aggiorna(codice);
  }, "Grazie, la segnalazione arriverà ai moderatori.");
}

// RF-19: dopo la pubblicazione l'autore può solo aggiungere aggiornamenti
export async function aggiungiAggiornamento(_: Esito | null, fd: FormData): Promise<Esito> {
  const codice = String(fd.get("codice") ?? "");
  return eseguiAzione(async () => {
    const { u, attore } = await scrittore();
    const id = await idDaCodice(codice);
    const { testo } = schemaCommento.parse(datiForm(fd));
    await inTransazione(attore, (tx) =>
      tx.esegui("INSERT INTO aggiornamento (id_segnalazione, id_autore, testo, stato) VALUES (?, ?, ?, 'visibile')", [id, u.id, testo]),
    );
    aggiorna(codice);
  }, "Aggiornamento pubblicato.");
}

// RF-20
export async function ritiraSegnalazione(codice: string): Promise<Esito> {
  return eseguiAzione(async () => {
    const { u, attore } = await scrittore();
    const id = await idDaCodice(codice);
    await inTransazione(attore, (tx) => cambiaStato(tx, id, "RITIRATA", "autore", u.id));
    aggiorna(codice);
  }, "Segnalazione ritirata.");
}

const schemaIntegrazione = z.object({
  titolo: z.string().trim().min(10, "Titolo: almeno 10 caratteri").max(100),
  descrizione: z.string().trim().min(30, "Descrizione: almeno 30 caratteri").max(2000),
});

/** Risposta a "Da integrare": testo corretto e nuovo invio, che torna in coda ai moderatori. */
export async function integraSegnalazione(_: Esito | null, fd: FormData): Promise<Esito> {
  const codice = String(fd.get("codice") ?? "");
  return eseguiAzione(async () => {
    const { u, attore } = await scrittore();
    const id = await idDaCodice(codice);
    const d = schemaIntegrazione.parse(datiForm(fd));
    await inTransazione(attore, async (tx) => {
      const r = await tx.esegui("UPDATE segnalazione SET titolo = ?, descrizione = ? WHERE id = ? AND id_autore = ?", [
        d.titolo,
        d.descrizione,
        id,
        u.id,
      ]);
      if (r.affectedRows === 0) throw new ErroreApp("Puoi modificare solo le tue segnalazioni.");
      await cambiaStato(tx, id, "RICEVUTA", "autore", u.id);
      await cambiaStato(tx, id, "IN_REVISIONE", "sistema", null, MOTIVO_SENZA_IA);
    });
    aggiorna(codice);
  }, "Integrazione inviata: la segnalazione torna ai moderatori.");
}
