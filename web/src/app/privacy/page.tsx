import type { ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Pagina } from "@/components/pagina";

export const metadata: Metadata = {
  title: "Informativa privacy",
  description: "Quali dati raccoglie La Nostra Città, perché, per quanto tempo e come chiederne copia o cancellazione.",
};

const SEZIONI: { id: string; titolo: string; testo: ReactNode }[] = [
  {
    id: "chi",
    titolo: "Chi tratta i dati",
    testo: (
      <p>
        Il sito è un progetto d&apos;esame che simula la piattaforma di un comitato civico milanese. I dati presenti sono
        dimostrativi. Se il servizio fosse attivo, il titolare del trattamento sarebbe il comitato &quot;La Nostra Città, Il Nostro
        Futuro&quot;.
      </p>
    ),
  },
  {
    id: "quali",
    titolo: "Quali dati raccogliamo",
    testo: (
      <ul>
        <li>
          <strong>Account:</strong> nome, cognome, email, data di nascita, quartiere di residenza, nome visualizzato e password
          (salvata solo come hash Argon2id).
        </li>
        <li>
          <strong>Segnalazioni:</strong> testo, posizione sulla mappa e foto. Le foto pubbliche sono copie senza metadati EXIF;
          l&apos;originale lo vedono solo i moderatori, per controllare che la foto sia del posto indicato.
        </li>
        <li>
          <strong>Partecipazione:</strong> sostegni, commenti e segnalazioni che segui.
        </li>
        <li>
          <strong>Sicurezza:</strong> l&apos;indirizzo IP e l&apos;esito degli accessi, e il registro delle azioni del comitato.
        </li>
      </ul>
    ),
  },
  {
    id: "perche",
    titolo: "Perché",
    testo: (
      <p>
        Per farti accedere, pubblicare le segnalazioni dopo la moderazione, contare i sostegni (chi abita nello stesso Municipio
        pesa un po&apos; di più, per questo serve il quartiere) e proteggere il servizio da abusi. Le notifiche e l&apos;uso
        anonimo delle segnalazioni per i modelli di classificazione sono facoltativi: li scegli alla registrazione e li cambi dal
        profilo.
      </p>
    ),
  },
  {
    id: "pubblico",
    titolo: "Cosa vedono gli altri",
    testo: (
      <p>
        Il nome visualizzato, le segnalazioni pubblicate, i commenti e gli aggiornamenti. Nome e cognome restano privati, a meno
        che tu non scelga di mostrarli. Email, data di nascita e quartiere non compaiono mai.
      </p>
    ),
  },
  {
    id: "quanto",
    titolo: "Per quanto tempo",
    testo: (
      <ul>
        <li>Le bozze non inviate si cancellano dopo 30 giorni.</li>
        <li>Il registro degli accessi si conserva per 180 giorni.</li>
        <li>
          Se chiudi l&apos;account, entro 7 giorni nome, email e gli altri dati personali vengono cancellati. Le segnalazioni
          restano pubbliche firmate &quot;Utente rimosso&quot;, perché fanno parte del documento consegnato ai candidati.
        </li>
      </ul>
    ),
  },
  {
    id: "diritti",
    titolo: "I tuoi diritti",
    testo: (
      <p>
        Dal <Link href="/profilo">profilo</Link> puoi correggere i tuoi dati, scaricarne una copia in formato JSON, cambiare i
        consensi e chiudere l&apos;account. Per qualsiasi altra richiesta (accesso, rettifica, opposizione) puoi scrivere al
        comitato; hai anche diritto di reclamo al Garante per la protezione dei dati personali.
      </p>
    ),
  },
];

export default function Privacy() {
  return (
    <Pagina
      sopratitolo="Trasparenza"
      titolo="Informativa privacy"
      descrizione="In breve: raccogliamo solo quello che serve a segnalare, sostenere e moderare. Qui sotto i dettagli."
      className="max-w-3xl"
    >
      <nav aria-label="In questa pagina" className="mb-8 rounded-xl bg-sunken p-4 ring-1 ring-border">
        <p className="mb-2 text-sm font-medium">In questa pagina</p>
        <ol className="grid gap-1 text-sm sm:grid-cols-2">
          {SEZIONI.map((s, i) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="text-primary underline-offset-4 hover:underline">
                {i + 1}. {s.titolo}
              </a>
            </li>
          ))}
        </ol>
      </nav>
      <div className="grid gap-8">
        {SEZIONI.map((s, i) => (
          <section
            key={s.id}
            id={s.id}
            aria-labelledby={`${s.id}-titolo`}
            className="grid scroll-mt-24 gap-3 leading-relaxed [&_a]:font-medium [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4 [&_li]:pl-1 [&_ul]:grid [&_ul]:list-disc [&_ul]:gap-2 [&_ul]:pl-5"
          >
            <h2 id={`${s.id}-titolo`} className="text-xl font-semibold tracking-tight">
              <span className="mr-2 text-muted-foreground tabular-nums">{i + 1}.</span>
              {s.titolo}
            </h2>
            {s.testo}
          </section>
        ))}
      </div>
    </Pagina>
  );
}
