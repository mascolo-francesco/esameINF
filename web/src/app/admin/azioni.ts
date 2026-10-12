"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, inTransazione } from "@/lib/server/db";
import { ErroreApp, isDuplicato } from "@/lib/server/errori";
import { datiForm, eseguiAzione, type Esito } from "@/lib/server/azione";
import { contestoRichiesta, LIVELLO, richiediUtente } from "@/lib/server/auth/sessione";

async function amministratore() {
  const u = await richiediUtente(LIVELLO.amministratore);
  if (!u.puoScrivere) throw new ErroreApp("Il tuo account non può fare modifiche in questo momento.");
  const { ip } = await contestoRichiesta();
  return { u, attore: { idUtente: u.id, ip } };
}

const id = z.coerce.number().int().positive();
const casella = z.preprocess((v) => v === "on" || v === "true", z.boolean());

// RF-45: il trigger impone il 2FA a moderatori e amministratori e scrive l'audit
export async function cambiaRuolo(_: Esito | null, fd: FormData): Promise<Esito> {
  return eseguiAzione(async () => {
    const { u, attore } = await amministratore();
    const d = z.object({ idUtente: id, idRuolo: z.coerce.number().int().min(1).max(3) }).parse(datiForm(fd));
    if (d.idUtente === u.id) throw new ErroreApp("Non puoi cambiare il tuo stesso ruolo.");
    const r = await db.riga<{ totp_attivo: number }>("SELECT totp_attivo FROM utente WHERE id = ?", [d.idUtente]);
    if (d.idRuolo > 1 && !r?.totp_attivo)
      throw new ErroreApp("Prima l'utente deve attivare la verifica in due passaggi dal suo profilo.");
    await inTransazione(attore, (tx) => tx.esegui("UPDATE utente SET id_ruolo = ? WHERE id = ?", [d.idRuolo, d.idUtente]));
    revalidatePath("/admin/utenti");
  }, "Ruolo aggiornato.");
}

const schemaCategoria = z.object({
  id: id.optional(),
  nome: z.string().trim().min(2, "Nome: almeno 2 caratteri").max(50),
  descrizione: z.string().trim().min(5, "Descrizione: almeno 5 caratteri").max(255),
  colore: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Colore non valido"),
  ordine: z.coerce.number().int().min(0).max(255),
  attiva: casella,
});

export async function salvaCategoria(_: Esito | null, fd: FormData): Promise<Esito> {
  return eseguiAzione(async () => {
    const { attore } = await amministratore();
    const d = schemaCategoria.parse(datiForm(fd));
    try {
      await inTransazione(attore, (tx) =>
        d.id
          ? tx.esegui("UPDATE categoria SET nome = ?, descrizione = ?, colore_mappa = ?, ordine = ?, attiva = ? WHERE id = ?", [
              d.nome,
              d.descrizione,
              d.colore,
              d.ordine,
              d.attiva,
              d.id,
            ])
          : tx.esegui("INSERT INTO categoria (nome, descrizione, colore_mappa, ordine, attiva) VALUES (?, ?, ?, ?, ?)", [
              d.nome,
              d.descrizione,
              d.colore,
              d.ordine,
              d.attiva,
            ]),
      );
    } catch (e) {
      if (isDuplicato(e)) throw new ErroreApp("Esiste già una categoria con questo nome.");
      throw e;
    }
    revalidatePath("/admin/categorie");
  }, "Categoria salvata.");
}

// RF-45: se cambia un peso della formula di priorità ricalcolo tutti i punteggi (7.3)
export async function salvaParametro(_: Esito | null, fd: FormData): Promise<Esito> {
  return eseguiAzione(async () => {
    const { attore } = await amministratore();
    const d = z
      .object({ chiave: z.string().max(60), valore: z.coerce.number({ error: "Inserisci un numero." }) })
      .parse({ chiave: fd.get("chiave"), valore: String(fd.get("valore") ?? "").replace(",", ".") });
    const p = await db.riga<{ valore_min: number; valore_max: number }>(
      "SELECT valore_min, valore_max FROM parametro_sistema WHERE chiave = ?",
      [d.chiave],
    );
    if (!p) throw new ErroreApp("Parametro inesistente.");
    if (d.valore < p.valore_min || d.valore > p.valore_max)
      throw new ErroreApp(`Il valore deve stare tra ${p.valore_min} e ${p.valore_max}.`);
    await inTransazione(attore, async (tx) => {
      await tx.esegui("UPDATE parametro_sistema SET valore = ? WHERE chiave = ?", [d.valore, d.chiave]);
      if (d.chiave.startsWith("priorita.") && d.chiave !== "priorita.tendenza_giorni") await tx.esegui("CALL sp_ricalcola_tutti_punteggi()");
    });
    revalidatePath("/admin/parametri");
    revalidatePath("/classifica");
  }, "Parametro aggiornato.");
}

// ---------------------------------------------------------------- documento programmatico (RF-48)

export async function creaDocumento(_: Esito | null, fd: FormData): Promise<Esito> {
  let nuovo = 0;
  const esito = await eseguiAzione(async () => {
    const { u, attore } = await amministratore();
    const d = z
      .object({
        titolo: z.string().trim().min(5, "Titolo: almeno 5 caratteri").max(200),
        introduzione: z.string().trim().max(5000).optional(),
      })
      .parse(datiForm(fd));
    const v = await db.riga<{ v: number }>("SELECT COALESCE(MAX(versione), 0) + 1 AS v FROM documento_programmatico WHERE titolo = ?", [d.titolo]);
    nuovo = (
      await inTransazione(attore, (tx) =>
        tx.esegui("INSERT INTO documento_programmatico (titolo, versione, introduzione, id_amministratore) VALUES (?, ?, ?, ?)", [
          d.titolo,
          v?.v ?? 1,
          d.introduzione || null,
          u.id,
        ]),
      )
    ).insertId;
  });
  if (esito.ok) redirect(`/admin/documenti/${nuovo}`);
  return esito;
}

export async function includiSegnalazione(_: Esito | null, fd: FormData): Promise<Esito> {
  return eseguiAzione(async () => {
    const { attore } = await amministratore();
    const d = z
      .object({ idDocumento: id, idSegnalazione: id, nota: z.string().trim().max(1000).optional() })
      .parse(datiForm(fd));
    // RD-21: solo segnalazioni prese in carico; lo controlla il trigger
    await inTransazione(attore, async (tx) => {
      const p = await tx.riga<{ p: number }>(
        "SELECT COALESCE(MAX(posizione), 0) + 1 AS p FROM documento_segnalazione WHERE id_documento = ?",
        [d.idDocumento],
      );
      await tx.esegui("INSERT INTO documento_segnalazione (id_documento, id_segnalazione, posizione, nota_comitato) VALUES (?, ?, ?, ?)", [
        d.idDocumento,
        d.idSegnalazione,
        p?.p ?? 1,
        d.nota || null,
      ]);
    });
    revalidatePath(`/admin/documenti/${d.idDocumento}`);
  }, "Segnalazione inclusa.");
}

export async function togliSegnalazione(idDocumento: number, idSegnalazione: number): Promise<Esito> {
  return eseguiAzione(async () => {
    const { attore } = await amministratore();
    await inTransazione(attore, (tx) =>
      tx.esegui("DELETE FROM documento_segnalazione WHERE id_documento = ? AND id_segnalazione = ?", [
        id.parse(idDocumento),
        id.parse(idSegnalazione),
      ]),
    );
    revalidatePath(`/admin/documenti/${idDocumento}`);
  }, "Segnalazione tolta dal documento.");
}

export async function rendiDefinitivo(idDocumento: number): Promise<Esito> {
  return eseguiAzione(async () => {
    const { attore } = await amministratore();
    const n = await db.riga<{ n: number }>("SELECT COUNT(*) AS n FROM documento_segnalazione WHERE id_documento = ?", [idDocumento]);
    if (!n?.n) throw new ErroreApp("Il documento non contiene segnalazioni.");
    await inTransazione(attore, (tx) =>
      tx.esegui("UPDATE documento_programmatico SET stato = 'definitivo', percorso_csv = ? WHERE id = ? AND stato = 'bozza'", [
        `/api/documenti/${idDocumento}/csv`,
        id.parse(idDocumento),
      ]),
    );
    revalidatePath(`/admin/documenti/${idDocumento}`);
  }, "Documento reso definitivo.");
}

/**
 * RF-48: invio a tutti i candidati attivi. Nella demo non parte nessuna email: la procedura
 * registra gli invii e porta le segnalazioni incluse a "Inviata ai candidati".
 */
export async function inviaDocumento(idDocumento: number): Promise<Esito> {
  return eseguiAzione(async () => {
    const { u, attore } = await amministratore();
    await inTransazione(attore, (tx) => tx.esegui("CALL sp_invia_documento(?, ?)", [id.parse(idDocumento), u.id]));
    revalidatePath(`/admin/documenti/${idDocumento}`);
  }, "Documento inviato a tutti i candidati.");
}

export async function salvaCandidato(_: Esito | null, fd: FormData): Promise<Esito> {
  return eseguiAzione(async () => {
    const { attore } = await amministratore();
    const d = z
      .object({
        nome: z.string().trim().min(1, "Nome obbligatorio").max(50),
        cognome: z.string().trim().min(1, "Cognome obbligatorio").max(50),
        lista: z.string().trim().min(2, "Lista o coalizione obbligatoria").max(150),
        email: z.string().trim().toLowerCase().email("Email non valida").max(254),
      })
      .parse(datiForm(fd));
    try {
      await inTransazione(attore, (tx) =>
        tx.esegui("INSERT INTO candidato (nome, cognome, lista_coalizione, email_contatto) VALUES (?, ?, ?, ?)", [
          d.nome,
          d.cognome,
          d.lista,
          d.email,
        ]),
      );
    } catch (e) {
      if (isDuplicato(e)) throw new ErroreApp("Esiste già un candidato con questa email.");
      throw e;
    }
    revalidatePath("/admin/documenti");
  }, "Candidato aggiunto.");
}

export async function attivaCandidato(idCandidato: number, attivo: boolean): Promise<Esito> {
  return eseguiAzione(async () => {
    await amministratore();
    await db.esegui("UPDATE candidato SET attivo = ? WHERE id = ?", [attivo, id.parse(idCandidato)]);
    revalidatePath("/admin/documenti");
  }, attivo ? "Candidato riattivato." : "Candidato disattivato.");
}
