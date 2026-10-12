import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { forbidden, redirect } from "next/navigation";
import { db } from "../db";
import { ipRichiesta } from "../richiesta";
import {
  COOKIE_2FA,
  COOKIE_ACCESSO,
  COOKIE_REFRESH,
  DURATA_2FA_S,
  DURATA_ACCESSO_S,
  DURATA_REFRESH_S,
  emettiSessione,
  firmaJwt,
  leggiJwt,
  opzioniCookie,
  revocaRefresh,
} from "./token";

export const LIVELLO = { cittadino: 1, moderatore: 2, amministratore: 3 } as const;

export interface Utente {
  id: number;
  nome: string;
  cognome: string;
  email: string;
  nomeVisualizzato: string;
  ruolo: "cittadino" | "moderatore" | "amministratore";
  livello: number;
  stato: string;
  puoScrivere: boolean;
  totpAttivo: boolean;
  idQuartiere: number | null;
}

/**
 * L'utente della richiesta. Il JWT dice solo chi è; ruolo e stato li rileggo dal database,
 * così un cambio di ruolo o un ban hanno effetto subito e non alla scadenza del token.
 */
export const utenteCorrente = cache(async (): Promise<Utente | null> => {
  const id = await leggiJwt((await cookies()).get(COOKIE_ACCESSO)?.value, "accesso");
  if (id === null) return null;
  const r = await db.riga<{
    id: number;
    nome: string;
    cognome: string;
    email: string;
    nome_visualizzato: string;
    ruolo: Utente["ruolo"];
    livello: number;
    stato_account: string;
    puo_scrivere: number;
    totp_attivo: number;
    id_quartiere: number | null;
  }>(
    `SELECT u.id, u.nome, u.cognome, u.email, u.nome_visualizzato, r.codice AS ruolo, r.livello,
            u.stato_account, fn_utente_puo_scrivere(u.id) AS puo_scrivere, u.totp_attivo, u.id_quartiere
       FROM utente u JOIN ruolo r ON r.id = u.id_ruolo
      WHERE u.id = ?`,
    [id],
  );
  if (!r || !["attivo", "sospeso"].includes(r.stato_account)) return null;
  return {
    id: r.id,
    nome: r.nome,
    cognome: r.cognome,
    email: r.email,
    nomeVisualizzato: r.nome_visualizzato,
    ruolo: r.ruolo,
    livello: r.livello,
    stato: r.stato_account,
    puoScrivere: Boolean(r.puo_scrivere),
    totpAttivo: Boolean(r.totp_attivo),
    idQuartiere: r.id_quartiere,
  };
});

/** Per pagine e azioni riservate: senza sessione rimanda al login, con ruolo insufficiente dà 403. */
export async function richiediUtente(livelloMinimo: number = LIVELLO.cittadino, da?: string): Promise<Utente> {
  const u = await utenteCorrente();
  if (!u) redirect(da ? `/accedi?da=${encodeURIComponent(da)}` : "/accedi");
  if (u.livello < livelloMinimo) forbidden();
  return u;
}

export async function contestoRichiesta() {
  const h = await headers();
  return { ip: ipRichiesta(h), ua: h.get("user-agent") };
}

export async function apriSessione(idUtente: number): Promise<void> {
  const { ip, ua } = await contestoRichiesta();
  const coppia = await emettiSessione(idUtente, ip, ua);
  const c = await cookies();
  c.set(COOKIE_ACCESSO, coppia.accesso, opzioniCookie(DURATA_ACCESSO_S));
  c.set(COOKIE_REFRESH, coppia.refresh, opzioniCookie(DURATA_REFRESH_S));
  c.delete(COOKIE_2FA);
}

export async function chiudiSessione(): Promise<void> {
  const c = await cookies();
  await revocaRefresh(c.get(COOKIE_REFRESH)?.value);
  c.delete(COOKIE_ACCESSO);
  c.delete(COOKIE_REFRESH);
  c.delete(COOKIE_2FA);
}

/** Password corretta per un account con 2FA: resta in attesa del codice per 5 minuti. */
export async function attendi2fa(idUtente: number): Promise<void> {
  (await cookies()).set(COOKIE_2FA, await firmaJwt(idUtente, "2fa", DURATA_2FA_S), opzioniCookie(DURATA_2FA_S));
}

export async function utenteIn2fa(): Promise<number | null> {
  return leggiJwt((await cookies()).get(COOKIE_2FA)?.value, "2fa");
}
