import "server-only";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { ErroreApp } from "./errori";

/** Risposta di ogni Server Action: i form la usano per mostrare errori e messaggi. */
export type Esito<T = undefined> =
  | { ok: true; dati?: T; messaggio?: string }
  | { ok: false; errore: string; campi?: Record<string, string> };

export const ERRORE_GENERICO = "Si è verificato un errore imprevisto. Riprova tra poco.";

/**
 * Esegue il corpo di una Server Action e traduce gli errori:
 * validazione Zod -> errori per campo; ErroreApp (anche quelli dei trigger) -> messaggio;
 * tutto il resto -> messaggio generico, con il dettaglio solo nei log del server.
 */
export async function eseguiAzione<T>(fn: () => Promise<T>, messaggio?: string): Promise<Esito<T>> {
  try {
    return { ok: true, dati: await fn(), messaggio };
  } catch (e) {
    unstable_rethrow(e); // redirect(), notFound() e simili devono proseguire
    if (e instanceof z.ZodError) {
      const campi: Record<string, string> = {};
      for (const issue of e.issues) {
        const chiave = issue.path.join(".") || "_";
        campi[chiave] ??= issue.message;
      }
      return { ok: false, errore: "Controlla i campi evidenziati.", campi };
    }
    if (e instanceof ErroreApp) return { ok: false, errore: e.message };
    console.error(e);
    return { ok: false, errore: ERRORE_GENERICO };
  }
}

/** Legge un FormData come oggetto semplice (le chiavi ripetute diventano array). */
export function datiForm(fd: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of fd.entries()) {
    if (k.startsWith("$ACTION")) continue;
    if (k in out) out[k] = ([] as unknown[]).concat(out[k], v);
    else out[k] = v;
  }
  return out;
}
