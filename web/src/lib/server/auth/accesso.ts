import "server-only";
import { db } from "../db";
import { ErroreApp } from "../errori";
import { decifraSegreto, hashPassword, verificaCodiceTotp, verificaPassword } from "./cripto";
import { apriSessione, attendi2fa, contestoRichiesta, utenteIn2fa } from "./sessione";

type Esito = "successo" | "password_errata" | "totp_errato" | "utente_inesistente" | "account_bloccato" | "account_non_attivo";

const CREDENZIALI_ERRATE = "Email o password non corretti.";

// Hash fittizio: anche per un'email inesistente faccio una verifica Argon2, così i tempi di
// risposta non rivelano quali email sono registrate.
let hashFittizio: Promise<string> | null = null;

async function registraAccesso(idUtente: number | null, email: string | null, ip: string | null, esito: Esito) {
  await db.esegui("INSERT INTO accesso_log (id_utente, email_tentata, indirizzo_ip, esito) VALUES (?, ?, ?, ?)", [
    idUtente,
    email,
    ip ?? "sconosciuto",
    esito,
  ]);
}

/** RF-03: dopo auth.max_tentativi errori nella finestra, blocco temporaneo dell'account. */
async function forseBlocca(idUtente: number, email: string) {
  const r = await db.riga<{ n: number; max: number }>(
    `SELECT COUNT(*) AS n, fn_param('auth.max_tentativi') AS max
       FROM accesso_log
      WHERE email_tentata = ? AND esito IN ('password_errata','totp_errato')
        AND data_ora >= NOW() - INTERVAL fn_param('auth.finestra_minuti') MINUTE`,
    [email],
  );
  if (r && r.n >= r.max) {
    await db.esegui("UPDATE utente SET bloccato_fino_a = NOW() + INTERVAL fn_param('auth.blocco_minuti') MINUTE WHERE id = ?", [
      idUtente,
    ]);
  }
}

async function completaAccesso(idUtente: number, email: string, ip: string | null) {
  await db.esegui("UPDATE utente SET ultimo_accesso = NOW(), tentativi_falliti = 0, bloccato_fino_a = NULL WHERE id = ?", [
    idUtente,
  ]);
  await registraAccesso(idUtente, email, ip, "successo");
  await apriSessione(idUtente);
}

/** Primo passo del login. Ritorna "2fa" se l'account richiede il codice TOTP. */
export async function accedi(emailInserita: string, password: string): Promise<"ok" | "2fa"> {
  const email = emailInserita.trim().toLowerCase();
  const { ip } = await contestoRichiesta();
  const u = await db.riga<{
    id: number;
    password_hash: string | null;
    stato_account: string;
    totp_attivo: number;
    bloccato: number;
    minuti_blocco: number | null;
  }>(
    `SELECT id, password_hash, stato_account, totp_attivo,
            COALESCE(bloccato_fino_a > NOW(), 0) AS bloccato,
            CEIL(TIMESTAMPDIFF(SECOND, NOW(), bloccato_fino_a) / 60) AS minuti_blocco
       FROM utente WHERE LOWER(email) = ?`,
    [email],
  );

  if (!u || !u.password_hash) {
    hashFittizio ??= hashPassword("password-fittizia-per-i-tempi");
    await verificaPassword(await hashFittizio, password);
    await registraAccesso(null, email, ip, "utente_inesistente");
    throw new ErroreApp(CREDENZIALI_ERRATE);
  }
  if (u.bloccato) {
    await registraAccesso(u.id, email, ip, "account_bloccato");
    throw new ErroreApp(`Troppi tentativi falliti. Riprova tra ${u.minuti_blocco ?? 15} minuti.`);
  }
  if (!(await verificaPassword(u.password_hash, password))) {
    await registraAccesso(u.id, email, ip, "password_errata");
    await forseBlocca(u.id, email);
    throw new ErroreApp(CREDENZIALI_ERRATE);
  }
  if (!["attivo", "sospeso"].includes(u.stato_account)) {
    await registraAccesso(u.id, email, ip, "account_non_attivo");
    throw new ErroreApp(
      u.stato_account === "bannato" ? "Questo account è stato bloccato dai moderatori." : "Questo account non è attivo.",
    );
  }
  if (u.totp_attivo) {
    await attendi2fa(u.id);
    return "2fa";
  }
  await completaAccesso(u.id, email, ip);
  return "ok";
}

/** Secondo passo per gli account con 2FA (obbligatoria per lo staff, RF-10). */
export async function verifica2fa(codice: string): Promise<void> {
  const id = await utenteIn2fa();
  if (id === null) throw new ErroreApp("La verifica è scaduta: accedi di nuovo con email e password.");
  const { ip } = await contestoRichiesta();
  const u = await db.riga<{ email: string; totp_segreto: Buffer | null; bloccato: number }>(
    "SELECT email, totp_segreto, COALESCE(bloccato_fino_a > NOW(), 0) AS bloccato FROM utente WHERE id = ?",
    [id],
  );
  if (!u?.totp_segreto) throw new ErroreApp("La verifica è scaduta: accedi di nuovo con email e password.");
  const email = u.email.toLowerCase();
  if (u.bloccato) {
    await registraAccesso(id, email, ip, "account_bloccato");
    throw new ErroreApp("Troppi tentativi falliti. Riprova più tardi.");
  }
  if (!(await verificaCodiceTotp(decifraSegreto(u.totp_segreto), codice.replace(/\s/g, "")))) {
    await registraAccesso(id, email, ip, "totp_errato");
    await forseBlocca(id, email);
    throw new ErroreApp("Codice non valido. Controlla l'ora del telefono e riprova.");
  }
  await completaAccesso(id, email, ip);
}
