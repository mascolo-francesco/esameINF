import { z } from "zod";

// Messaggi in italiano per tutti gli schemi (RNF-27)
const testo = (min: number, max: number, nome: string) =>
  z
    .string()
    .trim()
    .min(min, `${nome}: almeno ${min} caratteri`)
    .max(max, `${nome}: al massimo ${max} caratteri`);

const casella = z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean());

const etaAlmeno = (data: string, anni: number) => {
  const d = new Date(`${data}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return false;
  const limite = new Date();
  limite.setUTCFullYear(limite.getUTCFullYear() - anni);
  return d <= limite;
};

export const schemaEmail = z.string().trim().toLowerCase().max(254).email("Email non valida");

export const schemaPassword = z
  .string()
  .min(10, "La password deve avere almeno 10 caratteri") // RNF-02
  .max(200, "Password troppo lunga");

export const schemaPseudonimo = z
  .string()
  .trim()
  .min(3, "Il nome visualizzato deve avere almeno 3 caratteri")
  .max(40, "Il nome visualizzato può avere al massimo 40 caratteri")
  .regex(/^[\p{L}\p{N} ._'·-]+$/u, "Usa solo lettere, numeri, spazi, punti e trattini");

export const schemaRegistrazione = z.object({
  nome: testo(1, 50, "Nome"),
  cognome: testo(1, 50, "Cognome"),
  email: schemaEmail,
  password: schemaPassword,
  dataNascita: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data non valida")
    .refine((d) => etaAlmeno(d, 14), "Per iscriversi servono almeno 14 anni"), // RD-02
  telefono: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ]{6,20}$/, "Numero di telefono non valido")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  nomeVisualizzato: schemaPseudonimo,
  idQuartiere: z.coerce.number({ error: "Scegli il tuo quartiere" }).int().positive("Scegli il tuo quartiere"),
  privacy: casella.refine((v) => v, "Per iscriversi bisogna accettare l'informativa privacy"),
  consensoNotifiche: casella,
  consensoIa: casella,
});

export const schemaAccesso = z.object({
  email: schemaEmail,
  password: z.string().min(1, "Inserisci la password").max(200),
});

export const schemaCodiceTotp = z.object({
  codice: z
    .string()
    .transform((s) => s.replace(/\s/g, ""))
    .pipe(z.string().regex(/^\d{6}$/, "Il codice è di 6 cifre")),
});

export const schemaProfilo = z.object({
  nomeVisualizzato: schemaPseudonimo,
  mostraNomeReale: casella,
  idQuartiere: z.coerce.number().int().positive("Scegli il tuo quartiere"),
  consensoNotifiche: casella,
  consensoIa: casella,
});

export const schemaSegnalazione = z.object({
  titolo: testo(10, 100, "Titolo"), // RD-16
  descrizione: testo(30, 2000, "Descrizione"),
  tipo: z.enum(["problema", "proposta"], { error: "Scegli se è un problema o una proposta" }),
  latitudine: z.coerce.number().min(45.38).max(45.54),
  longitudine: z.coerce.number().min(9.04).max(9.28),
  indirizzo: z
    .string()
    .trim()
    .max(255)
    .optional()
    .transform((s) => s || null),
  fonte: z.enum(["exif", "gps", "manuale"]),
  categorie: z
    .array(z.coerce.number().int().positive())
    .min(1, "Scegli almeno una categoria")
    .max(3, "Puoi scegliere al massimo tre categorie"),
});

export const schemaCommento = z.object({
  testo: testo(1, 1000, "Commento"),
});

export const schemaMotivazione = z.object({
  motivazione: testo(5, 1000, "Motivazione"),
});
