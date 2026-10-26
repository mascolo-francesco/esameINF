"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/server/db";
import { isDuplicato, ErroreApp } from "@/lib/server/errori";
import { datiForm, eseguiAzione, type Esito } from "@/lib/server/azione";
import { hashPassword } from "@/lib/server/auth/cripto";
import { accedi, verifica2fa } from "@/lib/server/auth/accesso";
import { apriSessione, chiudiSessione } from "@/lib/server/auth/sessione";
import { percorsoInterno } from "@/lib/server/richiesta";
import { schemaAccesso, schemaCodiceTotp, schemaRegistrazione } from "@/lib/validazione";

/** Dopo il login torno alla pagina di partenza, ma solo se è un percorso interno. */
const destinazione = (fd: FormData) => percorsoInterno(fd.get("da"));

export async function registrati(_: Esito | null, fd: FormData): Promise<Esito> {
  const esito = await eseguiAzione(async () => {
    const d = schemaRegistrazione.parse(datiForm(fd));
    const hash = await hashPassword(d.password);
    try {
      // Demo senza invio di email: la verifica dell'indirizzo (RF-02) è esclusa, quindi l'account
      // nasce già attivo con email_verificata_il = NOW().
      const { insertId } = await db.esegui(
        `INSERT INTO utente (nome, cognome, email, password_hash, data_nascita, telefono, nome_visualizzato,
                             consenso_privacy_il, consenso_notifiche, consenso_addestramento_ia, id_quartiere,
                             stato_account, email_verificata_il)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, 'attivo', NOW())`,
        [
          d.nome,
          d.cognome,
          d.email,
          hash,
          d.dataNascita,
          d.telefono ?? null,
          d.nomeVisualizzato,
          d.consensoNotifiche,
          d.consensoIa,
          d.idQuartiere,
        ],
      );
      await apriSessione(insertId);
    } catch (e) {
      if (isDuplicato(e)) throw new ErroreApp("Esiste già un account con questa email.");
      throw e;
    }
  });
  if (esito.ok) redirect(destinazione(fd));
  return esito;
}

export async function accediAzione(_: Esito | null, fd: FormData): Promise<Esito> {
  let passo = "ok" as "ok" | "2fa";
  const esito = await eseguiAzione(async () => {
    const d = schemaAccesso.parse(datiForm(fd));
    passo = await accedi(d.email, d.password);
  });
  if (!esito.ok) return esito;
  const da = destinazione(fd);
  redirect(passo === "2fa" ? `/accedi/verifica?da=${encodeURIComponent(da)}` : da);
}

export async function verifica2faAzione(_: Esito | null, fd: FormData): Promise<Esito> {
  const esito = await eseguiAzione(async () => {
    await verifica2fa(schemaCodiceTotp.parse(datiForm(fd)).codice);
  });
  if (esito.ok) redirect(destinazione(fd));
  return esito;
}

export async function esci(): Promise<void> {
  await chiudiSessione();
  redirect("/");
}
