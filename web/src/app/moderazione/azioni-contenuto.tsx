"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { CheckIcon, EyeSlashIcon } from "@phosphor-icons/react";
import { moderaContenuto } from "./azioni";
import { Button } from "@/components/ui/button";

export function AzioniContenuto({ tipo, id, visibile }: { tipo: "commento" | "aggiornamento"; id: number; visibile: boolean }) {
  const [inCorso, avvia] = useTransition();
  const esegui = (azione: "visibile" | "nascosto") =>
    avvia(async () => {
      const r = await moderaContenuto(tipo, id, azione);
      if (r.ok) toast.success(r.messaggio ?? "Operazione completata.");
      else toast.error(r.errore);
    });
  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="outline" disabled={inCorso} onClick={() => esegui("visibile")}>
        <CheckIcon aria-hidden />
        {visibile ? "Va bene, lascia visibile" : "Rendi visibile"}
      </Button>
      <Button size="sm" variant="destructive" disabled={inCorso} onClick={() => esegui("nascosto")}>
        <EyeSlashIcon aria-hidden />
        Nascondi
      </Button>
    </div>
  );
}
