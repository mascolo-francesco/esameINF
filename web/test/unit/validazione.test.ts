import { describe, expect, it } from "vitest";
import { schemaRegistrazione, schemaSegnalazione } from "@/lib/validazione";
import { nomeQuartiere } from "@/lib/formato";

const anniFa = (n: number) => {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - n);
  return d.toISOString().slice(0, 10);
};

const registrazione = {
  nome: "Anna",
  cognome: "Rossi",
  email: " Anna.Rossi@Example.com ",
  password: "password-sicura",
  dataNascita: anniFa(20),
  telefono: "",
  nomeVisualizzato: "anna_r",
  idQuartiere: "1",
  privacy: "on",
};

describe("schemaRegistrazione (RF-01)", () => {
  it("accetta dati validi e normalizza l'email", () => {
    const d = schemaRegistrazione.parse(registrazione);
    expect(d.email).toBe("anna.rossi@example.com");
    expect(d.telefono).toBeUndefined();
    expect(d.consensoNotifiche).toBe(false);
  });

  it("chiede almeno 14 anni (RD-02)", () => {
    const r = schemaRegistrazione.safeParse({ ...registrazione, dataNascita: anniFa(13) });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].message).toContain("14 anni");
  });

  it("chiede password di almeno 10 caratteri (RNF-02) e il consenso privacy", () => {
    expect(schemaRegistrazione.safeParse({ ...registrazione, password: "corta" }).success).toBe(false);
    expect(schemaRegistrazione.safeParse({ ...registrazione, privacy: undefined }).success).toBe(false);
  });
});

describe("schemaSegnalazione (RD-16, RD-04)", () => {
  const base = {
    titolo: "Buca in via Padova",
    descrizione: "Una buca profonda sulla corsia di destra, pericolosa per bici e scooter.",
    tipo: "problema",
    latitudine: "45.4979",
    longitudine: "9.2272",
    fonte: "manuale",
    categorie: ["2"],
  };

  it("accetta una segnalazione completa", () => {
    const d = schemaSegnalazione.parse(base);
    expect(d.categorie).toEqual([2]);
    expect(d.indirizzo).toBeNull();
  });

  it("rifiuta titolo corto, punti fuori dal riquadro di Milano e troppe categorie", () => {
    expect(schemaSegnalazione.safeParse({ ...base, titolo: "Buca" }).success).toBe(false);
    expect(schemaSegnalazione.safeParse({ ...base, latitudine: "41.9", longitudine: "12.5" }).success).toBe(false);
    expect(schemaSegnalazione.safeParse({ ...base, categorie: ["1", "2", "3", "4"] }).success).toBe(false);
    expect(schemaSegnalazione.safeParse({ ...base, categorie: [] }).success).toBe(false);
  });
});

describe("nomeQuartiere", () => {
  it("rende leggibili i nomi ufficiali dei NIL", () => {
    expect(nomeQuartiere("LORETO - CASORETTO - NOLO")).toBe("Loreto - Casoretto - Nolo");
    expect(nomeQuartiere("GRATOSOGLIO - Q.RE MISSAGLIA - Q.RE TERRAZZE")).toBe("Gratosoglio - Q.re Missaglia - Q.re Terrazze");
    expect(nomeQuartiere("CITTA' STUDI")).toBe("Città Studi");
    expect(nomeQuartiere("SANT'AMBROGIO")).toBe("Sant'Ambrogio");
  });
});
