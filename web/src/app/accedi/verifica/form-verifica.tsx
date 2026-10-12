"use client";

import { verifica2faAzione } from "@/app/azioni/sessione";
import { Campo, MessaggioEsito, PulsanteInvio, useFormAzione } from "@/components/form";

export function FormVerifica({ da }: { da: string }) {
  const { esito, onSubmit, inAttesa } = useFormAzione(verifica2faAzione);
  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <input type="hidden" name="da" value={da} />
      <MessaggioEsito esito={esito} />
      <Campo
        nome="codice"
        etichetta="Codice"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9 ]*"
        maxLength={7}
        autoFocus
        required
        esito={esito}
        className="max-w-40"
      />
      <PulsanteInvio inAttesa={inAttesa}>Verifica</PulsanteInvio>
    </form>
  );
}
