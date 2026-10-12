/** Errore con un messaggio che si può mostrare all'utente così com'è. */
export class ErroreApp extends Error {
  constructor(
    message: string,
    public readonly codice?: string,
  ) {
    super(message);
    this.name = "ErroreApp";
  }
}

interface ErroreMysql {
  code?: string;
  errno?: number;
  sqlState?: string;
  sqlMessage?: string;
}

/**
 * I trigger rifiutano le operazioni con SQLSTATE 45000 e un messaggio che inizia col codice
 * del requisito ("RD-06: l'autore non può..."). Tolgo il codice e tengo il testo per l'utente.
 * Ogni altro errore del database resta un errore interno: va nei log, non all'utente.
 */
export function traduciErroreDb(e: unknown): unknown {
  if (e instanceof ErroreApp) return e;
  const m = e as ErroreMysql;
  if (m?.sqlState === "45000" && m.sqlMessage) {
    const match = /^([A-Z]{2,3}-\d+):\s*([\s\S]*)$/.exec(m.sqlMessage);
    const testo = (match ? match[2] : m.sqlMessage).trim();
    // come gli altri messaggi dell'app: maiuscola iniziale e punto finale
    const frase = testo.charAt(0).toUpperCase() + testo.slice(1) + (/[.!?]$/.test(testo) ? "" : ".");
    return new ErroreApp(frase, match?.[1]);
  }
  return e;
}

export function isDuplicato(e: unknown): boolean {
  return (e as ErroreMysql)?.code === "ER_DUP_ENTRY";
}
