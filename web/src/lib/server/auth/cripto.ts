import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { hash, verify } from "@node-rs/argon2";
import { generateSecret, generateURI, verify as verificaOtp } from "otplib";

// RNF-02: Argon2id con i parametri predefiniti della libreria (19 MiB, 2 iterazioni).
export const hashPassword = (password: string) => hash(password);

export async function verificaPassword(hashSalvato: string, password: string): Promise<boolean> {
  try {
    return await verify(hashSalvato, password);
  } catch {
    return false;
  }
}

/** Token casuale da 32 byte, da dare al browser. Nel database va solo il suo hash. */
export const nuovoToken = () => randomBytes(32).toString("base64url");
export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

// --- TOTP (RF-10) ------------------------------------------------------------
// Il segreto si salva cifrato con AES-256-GCM: iv (12 byte) + tag (16) + testo cifrato.

function chiaveTotp(): Buffer {
  const hex = process.env.TOTP_CHIAVE;
  if (!hex || hex.length !== 64) throw new Error("TOTP_CHIAVE mancante o non valida (64 cifre esadecimali)");
  return Buffer.from(hex, "hex");
}

export function cifraSegreto(segreto: string): Buffer {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", chiaveTotp(), iv);
  const dati = Buffer.concat([c.update(segreto, "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), dati]);
}

export function decifraSegreto(blob: Buffer): string {
  const d = createDecipheriv("aes-256-gcm", chiaveTotp(), blob.subarray(0, 12));
  d.setAuthTag(blob.subarray(12, 28));
  return Buffer.concat([d.update(blob.subarray(28)), d.final()]).toString("utf8");
}

export const nuovoSegretoTotp = () => generateSecret();

export const uriTotp = (segreto: string, etichetta: string) =>
  generateURI({ issuer: "La Nostra Città", label: etichetta, secret: segreto });

/** Accetta anche il codice del periodo precedente o successivo (30 s), per gli orologi poco precisi. */
export async function verificaCodiceTotp(segreto: string, codice: string): Promise<boolean> {
  if (!/^\d{6}$/.test(codice)) return false;
  const r = await verificaOtp({ secret: segreto, token: codice, epochTolerance: 30 });
  return r.valid;
}
