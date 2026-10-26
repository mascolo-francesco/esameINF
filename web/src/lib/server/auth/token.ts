import { SignJWT, jwtVerify } from "jose";
import { db } from "../db";
import { nuovoToken, sha256 } from "./cripto";

export const COOKIE_ACCESSO = "lnc_accesso";
export const COOKIE_REFRESH = "lnc_refresh";
export const COOKIE_2FA = "lnc_2fa";

export const DURATA_ACCESSO_S = 15 * 60; // RNF-03
export const DURATA_REFRESH_S = 30 * 24 * 3600;
export const DURATA_2FA_S = 5 * 60;

export const opzioniCookie = (maxAge: number) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge,
});

// "accesso" apre la sessione; "2fa" dice solo che la password è giusta e manca il codice TOTP.
type Scopo = "accesso" | "2fa";

function chiaveJwt(): Uint8Array {
  const s = process.env.JWT_SEGRETO;
  if (!s || s.length < 32) throw new Error("JWT_SEGRETO mancante o troppo corto");
  return new TextEncoder().encode(s);
}

export async function firmaJwt(idUtente: number, scopo: Scopo, durataS: number): Promise<string> {
  return new SignJWT({ scopo })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(idUtente))
    .setIssuedAt()
    .setExpirationTime(`${durataS}s`)
    .sign(chiaveJwt());
}

export async function leggiJwt(token: string | undefined, scopo: Scopo): Promise<number | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, chiaveJwt(), { algorithms: ["HS256"] });
    if (payload.scopo !== scopo || !payload.sub) return null;
    return Number(payload.sub);
  } catch {
    return null;
  }
}

export interface CoppiaToken {
  accesso: string;
  refresh: string;
}

/** Nuova sessione: JWT da 15 minuti + refresh token salvato come hash in token_utente. */
export async function emettiSessione(idUtente: number, ip: string | null, ua: string | null): Promise<CoppiaToken> {
  const refresh = nuovoToken();
  await db.esegui(
    `INSERT INTO token_utente (id_utente, tipo, token_hash, scade_il, indirizzo_ip, user_agent)
     VALUES (?, 'refresh', ?, NOW() + INTERVAL ? MINUTE, ?, ?)`,
    [idUtente, sha256(refresh), String(DURATA_REFRESH_S / 60), ip, ua?.slice(0, 255) ?? null],
  );
  return { accesso: await firmaJwt(idUtente, "accesso", DURATA_ACCESSO_S), refresh };
}

/**
 * Rotazione (RNF-03): il refresh token si usa una volta sola. Se è valido lo segno come usato
 * e ne emetto uno nuovo; se l'account nel frattempo è stato bannato o cancellato, niente sessione.
 */
export async function ruotaRefresh(refresh: string, ip: string | null, ua: string | null): Promise<CoppiaToken | null> {
  const h = sha256(refresh);
  const r = await db.esegui(
    `UPDATE token_utente SET usato_il = NOW()
      WHERE token_hash = ? AND tipo = 'refresh' AND usato_il IS NULL AND revocato_il IS NULL AND scade_il > NOW()`,
    [h],
  );
  if (r.affectedRows !== 1) return null;
  const u = await db.riga<{ id: number; stato_account: string }>(
    `SELECT u.id, u.stato_account FROM token_utente t JOIN utente u ON u.id = t.id_utente WHERE t.token_hash = ?`,
    [h],
  );
  if (!u || !["attivo", "sospeso"].includes(u.stato_account)) return null;
  return emettiSessione(u.id, ip, ua);
}

/**
 * Il browser manda spesso più richieste insieme (pagina e prefetch dei link) con lo stesso
 * refresh token: la prima lo ruota, le altre lo trovano già usato. Se è stato usato da pochi
 * secondi non è un furto ma questa corsa, e i cookie nuovi non vanno cancellati.
 */
export async function refreshAppenaRuotato(refresh: string): Promise<boolean> {
  const r = await db.riga<{ n: number }>(
    `SELECT COUNT(*) AS n FROM token_utente
      WHERE token_hash = ? AND tipo = 'refresh' AND revocato_il IS NULL AND usato_il > NOW() - INTERVAL 30 SECOND`,
    [sha256(refresh)],
  );
  return (r?.n ?? 0) > 0;
}

export async function revocaRefresh(refresh: string | undefined): Promise<void> {
  if (!refresh) return;
  await db.esegui(
    `UPDATE token_utente SET revocato_il = NOW() WHERE token_hash = ? AND tipo = 'refresh' AND revocato_il IS NULL`,
    [sha256(refresh)],
  );
}
