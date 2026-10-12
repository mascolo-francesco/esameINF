import { existsSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Test sul database vero (Aiven): servono DATABASE_URL (in .env.local o nell'ambiente) e i dati di npm run seed.
// Scrive solo righe di token_utente, che il job notturno cancella dopo la scadenza.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const conDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!conDb)("refresh token (RNF-03)", async () => {
  const { db, pool } = await import("@/lib/server/db");
  const { emettiSessione, leggiJwt, revocaRefresh, ruotaRefresh } = await import("@/lib/server/auth/token");
  let idUtente = 0;

  beforeAll(async () => {
    const u = await db.riga<{ id: number }>("SELECT id FROM utente WHERE stato_account = 'attivo' ORDER BY id LIMIT 1");
    if (!u) throw new Error("Nessun utente attivo: lancia npm run seed");
    idUtente = u.id;
  });
  afterAll(() => pool().end());

  it("si usa una volta sola: la rotazione dà una nuova coppia e invalida la vecchia", async () => {
    const prima = await emettiSessione(idUtente, "127.0.0.1", "test");
    expect(await leggiJwt(prima.accesso, "accesso")).toBe(idUtente);

    const seconda = await ruotaRefresh(prima.refresh, "127.0.0.1", "test");
    expect(seconda).not.toBeNull();
    expect(seconda!.refresh).not.toBe(prima.refresh);
    expect(await leggiJwt(seconda!.accesso, "accesso")).toBe(idUtente);

    // riuso del token già ruotato: rifiutato
    expect(await ruotaRefresh(prima.refresh, "127.0.0.1", "test")).toBeNull();
  });

  it("dopo il logout il refresh token non vale più", async () => {
    const s = await emettiSessione(idUtente, "127.0.0.1", "test");
    await revocaRefresh(s.refresh);
    expect(await ruotaRefresh(s.refresh, "127.0.0.1", "test")).toBeNull();
  });

  it("un token inventato non apre sessioni", async () => {
    expect(await ruotaRefresh("token-inventato", "127.0.0.1", "test")).toBeNull();
  });
});
