import type { Metadata } from "next";
import Link from "next/link";
import { LockSimpleIcon } from "@phosphor-icons/react/ssr";
import { Pagina } from "@/components/pagina";
import { StatoVuoto } from "@/components/stato-vuoto";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = { title: "Pagina riservata" };

export default function Vietato() {
  return (
    <Pagina className="max-w-xl">
      <StatoVuoto
        icona={<LockSimpleIcon weight="duotone" />}
        titolo="Pagina riservata"
        principale
        azione={
          <Link href="/" className={buttonVariants()}>
            Torna alla home
          </Link>
        }
      >
        Questa sezione è riservata ai membri del comitato.
      </StatoVuoto>
    </Pagina>
  );
}
