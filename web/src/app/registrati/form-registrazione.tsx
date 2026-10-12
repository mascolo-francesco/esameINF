"use client";

import Link from "next/link";
import { registrati } from "@/app/azioni/sessione";
import { Campo, CampoSelect, Casella, MessaggioEsito, PulsanteInvio, useFormAzione } from "@/components/form";

export function FormRegistrazione({ da, quartieri }: { da: string; quartieri: { id: number; nome: string }[] }) {
  const { esito, onSubmit, inAttesa } = useFormAzione(registrati);
  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <input type="hidden" name="da" value={da} />
      <MessaggioEsito esito={esito} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo nome="nome" etichetta="Nome" autoComplete="given-name" required esito={esito} />
        <Campo nome="cognome" etichetta="Cognome" autoComplete="family-name" required esito={esito} />
      </div>
      <Campo nome="email" etichetta="Email" type="email" autoComplete="email" required esito={esito} />
      <Campo
        nome="password"
        etichetta="Password"
        type="password"
        autoComplete="new-password"
        minLength={10}
        required
        esito={esito}
        aiuto="Almeno 10 caratteri. Puoi usare anche una frase."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo nome="dataNascita" etichetta="Data di nascita" type="date" autoComplete="bday" required esito={esito} />
        <Campo nome="telefono" etichetta="Telefono (facoltativo)" type="tel" autoComplete="tel" esito={esito} />
      </div>
      <Campo
        nome="nomeVisualizzato"
        etichetta="Nome visualizzato"
        required
        esito={esito}
        aiuto="È il nome con cui compari in pubblico, per esempio sotto i commenti."
      />
      <CampoSelect
        nome="idQuartiere"
        etichetta="Il tuo quartiere"
        required
        defaultValue=""
        esito={esito}
        aiuto="Serve per dare più peso ai sostegni dei residenti del Municipio."
      >
        <option value="" disabled>
          Scegli il quartiere…
        </option>
        {quartieri.map((q) => (
          <option key={q.id} value={q.id}>
            {q.nome}
          </option>
        ))}
      </CampoSelect>
      <fieldset className="grid gap-3 rounded-xl bg-sunken p-4 ring-1 ring-border">
        <legend className="px-1 text-sm font-medium">Consensi</legend>
        <Casella nome="privacy" esito={esito} required>
          Ho letto l&apos;
          <Link href="/privacy" target="_blank">
            informativa privacy
            <span className="sr-only"> (si apre in una nuova scheda)</span>
          </Link>{" "}
          e accetto il trattamento dei dati per usare il servizio (obbligatorio).
        </Casella>
        <Casella nome="consensoNotifiche">Ricevi notifiche sulle segnalazioni che segui.</Casella>
        <Casella nome="consensoIa">
          Consenti l&apos;uso anonimo delle tue segnalazioni per migliorare i modelli di classificazione.
        </Casella>
      </fieldset>
      <PulsanteInvio inAttesa={inAttesa}>Crea l&apos;account</PulsanteInvio>
    </form>
  );
}
