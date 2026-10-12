"use client";

import { useEffect, useRef } from "react";

/**
 * Con JavaScript attivo i filtri si applicano appena cambia una tendina; senza JavaScript
 * resta il pulsante "Applica i filtri" (il form è un normale GET).
 */
export function FiltriAutomatici() {
  const ancora = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const form = ancora.current?.closest("form");
    if (!form) return;
    form.querySelector<HTMLElement>(".js-nascondi")?.classList.add("sr-only");
    // da tablet in su c'è spazio: il pannello dei filtri parte aperto
    const pannello = form.closest("details");
    if (pannello && window.matchMedia("(min-width: 640px)").matches) pannello.open = true;
    const invia = (e: Event) => {
      const t = e.target as HTMLSelectElement;
      // cambiando Municipio il quartiere scelto potrebbe non appartenervi più
      if (t.name === "municipio") {
        const q = form.querySelector<HTMLSelectElement>('select[name="quartiere"]');
        if (q) q.value = "";
      }
      for (const s of form.querySelectorAll<HTMLSelectElement>("select")) s.disabled = s.value === "";
      form.requestSubmit();
    };
    form.addEventListener("change", invia);
    return () => form.removeEventListener("change", invia);
  }, []);
  return <span ref={ancora} hidden />;
}
