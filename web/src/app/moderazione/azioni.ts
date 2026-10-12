"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, inTransazione, type Db } from "@/lib/server/db";
import { ErroreApp } from "@/lib/server/errori";
import { datiForm, eseguiAzione, type Esito } from "@/lib/server/azione";
import { contestoRichiesta, LIVELLO, richiediUtente } from "@/lib/server/auth/sessione";
import { cambiaStato } from "@/lib/server/segnalazioni";

const schemaCodice = z.string().regex(/^MI-\d{4}-\d{6}$/, "Codice non valido (es. MI-2026-000012)");

/** Moderatore o amministratore, con l'attore giusto per sp_cambia_stato e l'audit. */
async function staff() {
  const u = await richiediUtente(LIVELLO.moderatore);
  if (!u.puoScrivere) throw new ErroreApp("Il tuo account non può moderare in questo momento.");
  const { ip } = await contestoRichiesta();
  const ruolo = u.livello >= LIVELLO.amministratore ? ("amministratore" as const) : ("moderatore" as const);
  return { u, ruolo, attore: { idUtente: u.id, ip } };
}

async function idDaCodice(tx: Db, codice: string): Promise<number> {
  const r = await tx.riga<{ id: number }>("SELECT id FROM segnalazione WHERE codice_pubblico = ?", [schemaCodice.parse(codice)]);
  if (!r) throw new ErroreApp("Segnalazione non trovata.");
  return r.id;
}

function aggiorna(codice?: string) {
  revalidatePath("/moderazione");
  if (codice) {
    revalidatePath(`/moderazione/${codice}`);
    revalidatePath(`/segnalazioni/${codice}`);
  }
}

const DECISIONI = {
  pubblica: { stato: "PUBBLICATA", abusi: "respinta" },
  integra: { stato: "DA_INTEGRARE", abusi: null },
  rifiuta: { stato: "RIFIUTATA", abusi: "accolta" },
  presa: { stato: "PRESA_IN_CARICO", abusi: null },
  riesame: { stato: "IN_REVISIONE", abusi: null },
  riattiva: { stato: "PUBBLICATA", abusi: null },
} as const;

const schemaDecisione = z.object({
  codice: schemaCodice,
  decisione: z.enum(Object.keys(DECISIONI) as [keyof typeof DECISIONI]),
  motivazione: z
    .string()
    .trim()
    .max(1000, "Al massimo 1000 caratteri")
    .optional()
    .transform((s) => s || null),
});

/**
 * RF-43: decisione del moderatore. La transizione, l'obbligo di motivazione (RD-11) e i
 * requisiti (es. una categoria confermata per pubblicare) li controlla il database.
 * Se c'erano segnalazioni di abuso aperte le chiudo insieme alla decisione.
 */
export async function decidi(_: Esito | null, fd: FormData): Promise<Esito> {
  return eseguiAzione(async () => {
    const { u, ruolo, attore } = await staff();
    const d = schemaDecisione.parse(datiForm(fd));
    const regola = DECISIONI[d.decisione];
    await inTransazione(attore, async (tx) => {
      const id = await idDaCodice(tx, d.codice);
      await cambiaStato(tx, id, regola.stato, ruolo, u.id, d.motivazione);
      if (regola.abusi) {
        await tx.esegui("UPDATE segnalazione_abuso SET esito = ?, id_moderatore = ? WHERE esito = 'aperta' AND id_segnalazione = ?", [
          regola.abusi,
          u.id,
          id,
        ]);
      }
    });
    aggiorna(d.codice);
  }, "Decisione registrata.");
}

/** Chiude le segnalazioni di abuso su una segnalazione rimasta pubblicata (abuso respinto o accolto). */
export async function chiudiAbusiSegnalazione(codice: string, esito: "accolta" | "respinta"): Promise<Esito> {
  return eseguiAzione(async () => {
    const { u, attore } = await staff();
    await inTransazione(attore, async (tx) => {
      const id = await idDaCodice(tx, codice);
      await tx.esegui("UPDATE segnalazione_abuso SET esito = ?, id_moderatore = ? WHERE esito = 'aperta' AND id_segnalazione = ?", [
        esito,
        u.id,
        id,
      ]);
    });
    aggiorna(codice);
  }, "Segnalazioni di abuso chiuse.");
}

// RF-43, RIA-10: le categorie scelte diventano confermate dal moderatore, le altre si tolgono
export async function correggiCategorie(_: Esito | null, fd: FormData): Promise<Esito> {
  return eseguiAzione(async () => {
    const { attore } = await staff();
    const codice = schemaCodice.parse(fd.get("codice"));
    const scelte = z
      .array(z.coerce.number().int().positive())
      .min(1, "Scegli almeno una categoria")
      .max(3, "Al massimo tre categorie")
      .parse(fd.getAll("categorie"));
    await inTransazione(attore, async (tx) => {
      const id = await idDaCodice(tx, codice);
      // prima confermo le nuove, poi tolgo le vecchie: RD-08 vuole sempre almeno una categoria confermata
      for (const k of scelte) {
        await tx.esegui(
          `INSERT INTO classificazione (id_segnalazione, id_categoria, origine, confermata) VALUES (?, ?, 'moderatore', TRUE)
           ON DUPLICATE KEY UPDATE origine = 'moderatore', confermata = TRUE`,
          [id, k],
        );
      }
      await tx.esegui(
        `UPDATE classificazione SET confermata = FALSE
          WHERE id_segnalazione = ? AND confermata AND id_categoria NOT IN (${scelte.map(() => "?").join(", ")})`,
        [id, ...scelte],
      );
    });
    aggiorna(codice);
  }, "Categorie aggiornate.");
}

// RF-43: il trigger ricalcola il quartiere e scrive l'audit
export async function correggiPosizione(codice: string, lat: number, lon: number): Promise<Esito> {
  return eseguiAzione(async () => {
    const { attore } = await staff();
    const p = z.object({ lat: z.number().min(45.38).max(45.54), lon: z.number().min(9.04).max(9.28) }).parse({ lat, lon });
    await inTransazione(attore, async (tx) => {
      const id = await idDaCodice(tx, codice);
      await tx.esegui("UPDATE segnalazione SET latitudine = ?, longitudine = ? WHERE id = ?", [p.lat, p.lon, id]);
    });
    aggiorna(codice);
  }, "Posizione corretta.");
}

// RF-30: la segnalazione diventa Unita e i sostegni passano alla principale
export async function unisci(_: Esito | null, fd: FormData): Promise<Esito> {
  return eseguiAzione(async () => {
    const { u, ruolo, attore } = await staff();
    const codice = schemaCodice.parse(fd.get("codice"));
    const principale = schemaCodice.parse(String(fd.get("principale") ?? "").trim().toUpperCase());
    await inTransazione(attore, async (tx) => {
      const id = await idDaCodice(tx, codice);
      const idP = await idDaCodice(tx, principale);
      await cambiaStato(tx, id, "UNITA", ruolo, u.id, `Unita a ${principale}`, idP);
    });
    aggiorna(codice);
    revalidatePath(`/segnalazioni/${principale}`);
  }, "Segnalazioni unite.");
}

const schemaContenuto = z.object({
  tipo: z.enum(["commento", "aggiornamento"]),
  id: z.number().int().positive(),
  azione: z.enum(["visibile", "nascosto"]),
});

/** Commenti e aggiornamenti in coda: si rendono visibili (abusi respinti) o si nascondono (accolti). */
export async function moderaContenuto(tipo: "commento" | "aggiornamento", id: number, azione: "visibile" | "nascosto"): Promise<Esito> {
  return eseguiAzione(async () => {
    const { u, attore } = await staff();
    const d = schemaContenuto.parse({ tipo, id, azione });
    const col = d.tipo === "commento" ? "id_commento" : "id_aggiornamento";
    let codice: string | undefined;
    await inTransazione(attore, async (tx) => {
      const r = await tx.riga<{ codice_pubblico: string }>(
        `SELECT s.codice_pubblico FROM ${d.tipo} x JOIN segnalazione s ON s.id = x.id_segnalazione WHERE x.id = ?`,
        [d.id],
      );
      if (!r) throw new ErroreApp("Contenuto non trovato.");
      codice = r.codice_pubblico;
      await tx.esegui(`UPDATE ${d.tipo} SET stato = ? WHERE id = ?`, [d.azione, d.id]);
      await tx.esegui(`UPDATE segnalazione_abuso SET esito = ?, id_moderatore = ? WHERE esito = 'aperta' AND ${col} = ?`, [
        d.azione === "nascosto" ? "accolta" : "respinta",
        u.id,
        d.id,
      ]);
    });
    aggiorna(codice);
  }, azione === "nascosto" ? "Contenuto nascosto." : "Contenuto visibile.");
}

const schemaSanzione = z
  .object({
    idUtente: z.coerce.number().int().positive(),
    tipo: z.enum(["sospensione", "ban"], { error: "Scegli il tipo di provvedimento" }),
    giorni: z.coerce.number().int().min(1, "Almeno 1 giorno").max(365, "Al massimo 365 giorni").optional(),
    motivazione: z.string().trim().min(5, "Motivazione: almeno 5 caratteri").max(1000),
  })
  .refine((d) => d.tipo === "ban" || d.giorni, { message: "Indica la durata della sospensione", path: ["giorni"] });

// RF-44: il trigger impedisce di sanzionare un pari grado o un superiore
export async function sanziona(_: Esito | null, fd: FormData): Promise<Esito> {
  return eseguiAzione(async () => {
    const { u, attore } = await staff();
    const d = schemaSanzione.parse(datiForm(fd));
    await inTransazione(attore, (tx) =>
      tx.esegui(
        `INSERT INTO provvedimento (tipo, motivazione, data_fine, id_destinatario, id_moderatore)
         VALUES (?, ?, IF(? = 'ban', NULL, NOW() + INTERVAL ? DAY), ?, ?)`,
        [d.tipo, d.motivazione, d.tipo, String(d.giorni ?? 1), d.idUtente, u.id],
      ),
    );
    revalidatePath("/moderazione/utenti");
  }, "Provvedimento registrato.");
}

// RF-44: la revoca spetta all'amministratore
export async function revocaProvvedimento(_: Esito | null, fd: FormData): Promise<Esito> {
  return eseguiAzione(async () => {
    const u = await richiediUtente(LIVELLO.amministratore);
    const { ip } = await contestoRichiesta();
    const d = z
      .object({ id: z.coerce.number().int().positive(), motivazione: z.string().trim().min(5, "Motivazione: almeno 5 caratteri").max(1000) })
      .parse(datiForm(fd));
    await inTransazione({ idUtente: u.id, ip }, (tx) =>
      tx.esegui("UPDATE provvedimento SET revocato_il = NOW(), id_revocato_da = ?, motivazione_revoca = ? WHERE id = ?", [
        u.id,
        d.motivazione,
        d.id,
      ]),
    );
    revalidatePath("/moderazione/utenti");
  }, "Provvedimento revocato.");
}

export async function apriPerCodice(fd: FormData): Promise<void> {
  await richiediUtente(LIVELLO.moderatore);
  const codice = String(fd.get("codice") ?? "").trim().toUpperCase();
  const r = await db.riga<{ n: number }>("SELECT COUNT(*) AS n FROM segnalazione WHERE codice_pubblico = ?", [codice]);
  redirect(r?.n ? `/moderazione/${codice}` : "/moderazione?nontrovata=1");
}
