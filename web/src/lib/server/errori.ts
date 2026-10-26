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
 * Alcuni messaggi dei trigger parlano di requisiti e stati interni ("stato votabile", "provvedimenti").
 * Quelli che un cittadino può incontrare li riscrivo con le parole del sito; gli altri passano com'erano.
 */
const RISCRITTURE: Record<string, string> = {
  "l'autore non può sostenere la propria segnalazione": "Non puoi sostenere una tua segnalazione.",
  "la segnalazione non è in uno stato votabile": "Questa segnalazione non si può sostenere.",
  "la segnalazione non è più votabile, il sostegno resta registrato":
    "La segnalazione è chiusa: il tuo sostegno resta registrato e non si può ritirare.",
  "solo un utente verificato e senza provvedimenti può sostenere": "Il tuo account al momento non può partecipare.",
  "solo un utente verificato e senza provvedimenti può commentare": "Il tuo account al momento non può partecipare.",
  "solo un utente verificato e senza provvedimenti può segnalare abusi": "Il tuo account al momento non può partecipare.",
  "solo un utente verificato e senza provvedimenti può inserire segnalazioni":
    "Il tuo account al momento non può pubblicare segnalazioni.",
  "si commentano solo le segnalazioni pubblicate": "Puoi commentare solo le segnalazioni pubblicate.",
  "il contenuto non è visibile e non si può segnalare": "Questo contenuto è già nascosto in attesa di un moderatore.",
  "non si può segnalare un proprio contenuto": "Non puoi segnalare un tuo contenuto.",
  "il punto indicato è fuori dal Comune di Milano": "Il punto è fuori dal Comune di Milano: spostalo dentro i confini.",
  "servono da 1 a 5 allegati": "Aggiungi da 1 a 5 foto.",
  "raggiunto il limite di 5 segnalazioni nelle ultime 24 ore":
    "Hai già inviato 5 segnalazioni nelle ultime 24 ore. Potrai inviarne altre più tardi.",
  "moderatori e amministratori devono attivare il 2FA":
    "Moderatori e amministratori devono tenere attiva la verifica in due passaggi.",
};

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
    if (RISCRITTURE[testo]) return new ErroreApp(RISCRITTURE[testo], match?.[1]);
    // come gli altri messaggi dell'app: maiuscola iniziale e punto finale
    const frase = testo.charAt(0).toUpperCase() + testo.slice(1) + (/[.!?]$/.test(testo) ? "" : ".");
    return new ErroreApp(frase, match?.[1]);
  }
  return e;
}

export function isDuplicato(e: unknown): boolean {
  return (e as ErroreMysql)?.code === "ER_DUP_ENTRY";
}
