import { beforeAll, describe, expect, it } from "vitest";
import { generate } from "otplib";
import { ErroreApp, isDuplicato, traduciErroreDb } from "@/lib/server/errori";
import {
  cifraSegreto,
  decifraSegreto,
  hashPassword,
  nuovoSegretoTotp,
  nuovoToken,
  sha256,
  verificaCodiceTotp,
  verificaPassword,
} from "@/lib/server/auth/cripto";
import { firmaJwt, leggiJwt } from "@/lib/server/auth/token";

beforeAll(() => {
  process.env.TOTP_CHIAVE = "a".repeat(64);
  process.env.JWT_SEGRETO = "segreto-di-prova-lungo-almeno-trentadue-caratteri";
});

describe("traduciErroreDb (RNF-27)", () => {
  it("toglie il codice del requisito dai messaggi dei trigger", () => {
    const e = traduciErroreDb({ sqlState: "45000", sqlMessage: "RD-06: l'autore non può sostenere la propria segnalazione" });
    expect(e).toBeInstanceOf(ErroreApp);
    expect((e as ErroreApp).message).toBe("L'autore non può sostenere la propria segnalazione");
    expect((e as ErroreApp).codice).toBe("RD-06");
  });

  it("lascia passare gli altri errori, che non vanno mostrati all'utente", () => {
    const originale = { code: "ER_PARSE_ERROR", sqlState: "42000", sqlMessage: "You have an error in your SQL syntax" };
    expect(traduciErroreDb(originale)).toBe(originale);
    expect(isDuplicato({ code: "ER_DUP_ENTRY" })).toBe(true);
  });
});

describe("password (RNF-02)", () => {
  it("usa Argon2id e verifica solo la password giusta", async () => {
    const h = await hashPassword("una-password-lunga");
    expect(h.startsWith("$argon2id$")).toBe(true);
    expect(await verificaPassword(h, "una-password-lunga")).toBe(true);
    expect(await verificaPassword(h, "un'altra-password")).toBe(false);
    expect(await verificaPassword("hash-rovinato", "x")).toBe(false);
  });
});

describe("token di sessione (RNF-03)", () => {
  it("il refresh token è casuale e nel database va solo il suo hash", () => {
    const a = nuovoToken();
    expect(a).not.toBe(nuovoToken());
    expect(Buffer.from(a, "base64url")).toHaveLength(32);
    expect(sha256(a)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("un JWT vale solo per lo scopo per cui è stato firmato", async () => {
    const t = await firmaJwt(42, "2fa", 60);
    expect(await leggiJwt(t, "2fa")).toBe(42);
    expect(await leggiJwt(t, "accesso")).toBeNull();
    expect(await leggiJwt(t.slice(0, -2) + "xx", "2fa")).toBeNull();
    expect(await leggiJwt(undefined, "accesso")).toBeNull();
  });
});

describe("TOTP (RF-10)", () => {
  it("il segreto si cifra e si decifra, e un byte alterato viene scoperto", () => {
    const s = nuovoSegretoTotp();
    const blob = cifraSegreto(s);
    expect(blob.toString("utf8")).not.toContain(s);
    expect(decifraSegreto(blob)).toBe(s);
    blob[blob.length - 1] ^= 1;
    expect(() => decifraSegreto(blob)).toThrow();
  });

  it("accetta il codice corrente e rifiuta quelli sbagliati", async () => {
    const s = nuovoSegretoTotp();
    expect(await verificaCodiceTotp(s, await generate({ secret: s }))).toBe(true);
    expect(await verificaCodiceTotp(s, "000000")).toBe(false);
    expect(await verificaCodiceTotp(s, "12ab56")).toBe(false);
  });
});
