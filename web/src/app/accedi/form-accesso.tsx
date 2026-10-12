"use client";

import { accediAzione } from "@/app/azioni/sessione";
import { Campo, MessaggioEsito, PulsanteInvio, useFormAzione } from "@/components/form";

export function FormAccesso({ da }: { da: string }) {
  const { esito, onSubmit, inAttesa } = useFormAzione(accediAzione);
  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <input type="hidden" name="da" value={da} />
      <MessaggioEsito esito={esito} />
      <Campo nome="email" etichetta="Email" type="email" autoComplete="email" required esito={esito} />
      <Campo nome="password" etichetta="Password" type="password" autoComplete="current-password" required esito={esito} />
      <PulsanteInvio inAttesa={inAttesa}>Accedi</PulsanteInvio>
    </form>
  );
}
