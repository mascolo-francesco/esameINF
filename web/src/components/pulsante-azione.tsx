"use client";

import { useTransition, type ComponentProps } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type Risposta = { ok: boolean; errore?: string; messaggio?: string };

/** Pulsante che chiama una Server Action e mostra l'esito in un avviso. */
export function PulsanteAzione({
  azione,
  conferma,
  children,
  ...props
}: { azione: () => Promise<Risposta>; conferma?: string } & Omit<ComponentProps<typeof Button>, "onClick">) {
  const [inCorso, avvia] = useTransition();
  return (
    <Button
      {...props}
      disabled={inCorso || props.disabled}
      aria-busy={inCorso}
      onClick={() => {
        if (conferma && !window.confirm(conferma)) return;
        avvia(async () => {
          const r = await azione();
          if (r.ok) toast.success(r.messaggio ?? "Operazione completata.");
          else toast.error(r.errore ?? "Operazione non riuscita. Riprova.");
        });
      }}
    >
      {children}
    </Button>
  );
}
