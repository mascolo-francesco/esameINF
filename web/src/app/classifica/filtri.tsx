"use client";

import { useEffect, useId, useRef } from "react";
import { useRouter } from "next/navigation";
import { Scelta, type Opzione } from "@/components/form";

/**
 * Un filtro della classifica: tendina del sito che, appena cambia, ricarica la classifica.
 * L'URL si costruisce dai campi del form: i filtri vuoti non finiscono nell'indirizzo e, cambiando
 * Municipio, il quartiere scelto si azzera (potrebbe non appartenere al nuovo municipio).
 */
export function FiltroScelta({
  nome,
  etichetta,
  valore,
  vuoto,
  opzioni,
}: {
  nome: string;
  etichetta: string;
  valore: string | number;
  vuoto: string;
  opzioni: readonly Opzione[];
}) {
  const id = useId();
  const router = useRouter();
  const contenitore = useRef<HTMLDivElement>(null);

  // da tablet in su c'è spazio: il pannello dei filtri parte aperto
  useEffect(() => {
    const pannello = contenitore.current?.closest("details");
    if (pannello && window.matchMedia("(min-width: 640px)").matches) pannello.open = true;
  }, []);

  const cambia = (nuovo: string) => {
    const form = contenitore.current?.closest("form");
    if (!form) return;
    const parametri = new URLSearchParams();
    for (const [k, v] of new FormData(form)) if (typeof v === "string" && v !== "") parametri.set(k, v);
    if (nuovo === "") parametri.delete(nome);
    else parametri.set(nome, nuovo);
    if (nome === "municipio") parametri.delete("quartiere");
    const query = parametri.toString();
    router.push(query ? `/classifica?${query}` : "/classifica", { scroll: false });
  };

  return (
    <div ref={contenitore} className="grid min-w-0 gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {etichetta}
      </label>
      {/* la chiave segue il valore dell'URL: dopo la navigazione la tendina riparte dal nuovo valore */}
      <Scelta key={String(valore)} id={id} name={nome} size="sm" defaultValue={valore} segnaposto={vuoto} opzioni={[["", vuoto], ...opzioni]} onValueChange={cambia} />
    </div>
  );
}
