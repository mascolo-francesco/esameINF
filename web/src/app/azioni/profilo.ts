"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { z } from "zod";
import { db, inTransazione } from "@/lib/server/db";
import { ErroreApp } from "@/lib/server/errori";
import { datiForm, eseguiAzione, type Esito } from "@/lib/server/azione";
import {
  cifraSegreto,
  decifraSegreto,
  nuovoSegretoTotp,
  uriTotp,
  verificaCodiceTotp,
  verificaPassword,
} from "@/lib/server/auth/cripto";
import { chiudiSessione, contestoRichiesta, richiediUtente } from "@/lib/server/auth/sessione";
import { schemaCodiceTotp, schemaProfilo } from "@/lib/validazione";

export async function aggiornaProfilo(_: Esito | null, fd: FormData): Promise<Esito> {
  return eseguiAzione(async () => {
    const u = await richiediUtente();
    const d = schemaProfilo.parse(datiForm(fd));
    await db.esegui(
      `UPDATE utente SET nome_visualizzato = ?, mostra_nome_reale = ?, id_quartiere = ?,
              consenso_notifiche = ?, consenso_addestramento_ia = ?
        WHERE id = ?`,
      [d.nomeVisualizzato, d.mostraNomeReale, d.idQuartiere, d.consensoNotifiche, d.consensoIa, u.id],
    );
    revalidatePath("/", "layout");
  }, "Profilo aggiornato.");
}

export interface DatiNuovoTotp {
  segretoCifrato: string;
  segreto: string;
  qrSvg: string;
}

/** Primo passo della 2FA: segreto nuovo, mostrato come QR. Lo salvo solo dopo un codice corretto. */
export async function preparaTotp(): Promise<Esito<DatiNuovoTotp>> {
  return eseguiAzione(async () => {
    const u = await richiediUtente();
    if (u.totpAttivo) throw new ErroreApp("La verifica in due passaggi è già attiva.");
    const segreto = nuovoSegretoTotp();
    return {
      segreto,
      // il segreto in attesa di conferma viaggia cifrato (AES-GCM) in un campo nascosto del form
      segretoCifrato: cifraSegreto(segreto).toString("base64"),
      qrSvg: await QRCode.toString(uriTotp(segreto, u.email), { type: "svg", margin: 1 }),
    };
  });
}

export async function confermaTotp(_: Esito | null, fd: FormData): Promise<Esito> {
  return eseguiAzione(async () => {
    const u = await richiediUtente();
    const { codice } = schemaCodiceTotp.parse(datiForm(fd));
    let segreto: string;
    try {
      segreto = decifraSegreto(Buffer.from(String(fd.get("segretoCifrato") ?? ""), "base64"));
    } catch {
      throw new ErroreApp("La configurazione è scaduta: premi di nuovo \"Attiva la verifica in due passaggi\".");
    }
    if (!(await verificaCodiceTotp(segreto, codice))) throw new ErroreApp("Codice non valido. Controlla l'ora del telefono e riprova.");
    await db.esegui("UPDATE utente SET totp_attivo = TRUE, totp_segreto = ? WHERE id = ?", [cifraSegreto(segreto), u.id]);
    revalidatePath("/profilo");
  }, "Verifica in due passaggi attivata.");
}

export async function disattivaTotp(_: Esito | null, fd: FormData): Promise<Esito> {
  return eseguiAzione(async () => {
    const u = await richiediUtente();
    await controllaPassword(u.id, String(fd.get("password") ?? ""));
    // per moderatori e amministratori il trigger rifiuta (RF-10)
    await db.esegui("UPDATE utente SET totp_attivo = FALSE, totp_segreto = NULL WHERE id = ?", [u.id]);
    revalidatePath("/profilo");
  }, "Verifica in due passaggi disattivata.");
}

async function controllaPassword(idUtente: number, password: string) {
  const r = await db.riga<{ password_hash: string | null }>("SELECT password_hash FROM utente WHERE id = ?", [idUtente]);
  if (!r?.password_hash || !(await verificaPassword(r.password_hash, password)))
    throw new ErroreApp("Password non corretta.");
}

/**
 * RF-08: l'account passa subito a "cancellato" e non si può più usare. Il job notturno lo
 * anonimizza dopo account.giorni_anonimizzazione giorni; le segnalazioni restano, firmate
 * "Utente rimosso".
 */
export async function eliminaAccount(_: Esito | null, fd: FormData): Promise<Esito> {
  const esito = await eseguiAzione(async () => {
    const u = await richiediUtente();
    await controllaPassword(u.id, String(fd.get("password") ?? ""));
    z.literal("on", { error: "Conferma di aver compreso le conseguenze." }).parse(fd.get("conferma"));
    if (u.livello > 1) throw new ErroreApp("Un membro del comitato deve prima farsi togliere il ruolo da un amministratore.");
    const { ip } = await contestoRichiesta();
    await inTransazione({ idUtente: u.id, ip }, async (tx) => {
      await tx.esegui("UPDATE utente SET stato_account = 'cancellato', cancellazione_richiesta_il = NOW() WHERE id = ?", [u.id]);
      await tx.esegui("UPDATE token_utente SET revocato_il = NOW() WHERE id_utente = ? AND revocato_il IS NULL", [u.id]);
    });
    await chiudiSessione();
  });
  if (esito.ok) redirect("/?account=eliminato");
  return esito;
}
