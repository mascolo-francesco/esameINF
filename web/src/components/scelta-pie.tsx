"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

/** Nelle aree di lavoro del comitato basta un piè di pagina essenziale: la cartolina resta per il sito pubblico. */
export function SceltaPie({ completo, essenziale }: { completo: ReactNode; essenziale: ReactNode }) {
  const percorso = usePathname();
  return /^\/(admin|moderazione)(\/|$)/.test(percorso) ? essenziale : completo;
}
