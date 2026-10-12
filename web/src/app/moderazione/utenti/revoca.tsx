"use client";

import { useState } from "react";
import { toast } from "sonner";
import { revocaProvvedimento } from "../azioni";
import { Campo, MessaggioEsito, PulsanteInvio, useFormAzione } from "@/components/form";
import { Button } from "@/components/ui/button";

export function FormRevoca({ id }: { id: number }) {
  const [aperto, setAperto] = useState(false);
  const { esito, onSubmit, inAttesa } = useFormAzione(revocaProvvedimento, (r) => r.ok && toast.success(r.messaggio ?? "Operazione completata."));
  if (!aperto)
    return (
      <Button size="sm" variant="outline" className="justify-self-start" onClick={() => setAperto(true)}>
        Revoca…
      </Button>
    );
  return (
    <form onSubmit={onSubmit} className="grid gap-2" noValidate>
      <input type="hidden" name="id" value={id} />
      <MessaggioEsito esito={esito?.ok ? null : esito} />
      <Campo nome="motivazione" etichetta="Motivo della revoca" esito={esito} />
      <PulsanteInvio inAttesa={inAttesa} size="sm" className="justify-self-start">
        Revoca il provvedimento
      </PulsanteInvio>
    </form>
  );
}
