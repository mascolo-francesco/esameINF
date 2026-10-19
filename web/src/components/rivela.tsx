"use client";

import { useEffect } from "react";

const SELETTORE = "[data-rivela]:not([data-visibile])";
const mostra = (e: Element) => e.setAttribute("data-visibile", "");

/**
 * Entrate delle sezioni: gli elementi con data-rivela salgono e compaiono quando entrano nello schermo.
 * Senza JavaScript restano visibili: il CSS li nasconde solo sotto html.js.
 * Il contenuto delle pagine arriva in streaming dopo il layout, quindi guardo anche i nodi aggiunti più tardi.
 */
export function AttivaRivela() {
  useEffect(() => {
    if (!("IntersectionObserver" in window)) {
      document.querySelectorAll(SELETTORE).forEach(mostra);
      return;
    }
    const osservatore = new IntersectionObserver(
      (voci) => {
        for (const v of voci) {
          if (!v.isIntersecting) continue;
          mostra(v.target);
          osservatore.unobserve(v.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    const osserva = () => document.querySelectorAll(SELETTORE).forEach((e) => osservatore.observe(e));
    osserva();
    const mutazioni = new MutationObserver(osserva);
    mutazioni.observe(document.body, { childList: true, subtree: true });
    // rete di sicurezza: se per qualsiasi motivo un elemento resta nascosto, dopo qualche secondo compare comunque
    const sicurezza = window.setTimeout(() => {
      document.querySelectorAll(SELETTORE).forEach((e) => {
        const r = e.getBoundingClientRect();
        if (r.top < window.innerHeight) mostra(e);
      });
    }, 4000);
    return () => {
      osservatore.disconnect();
      mutazioni.disconnect();
      window.clearTimeout(sicurezza);
    };
  }, []);
  return null;
}
