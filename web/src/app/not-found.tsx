import type { Metadata } from "next";
import Link from "next/link";
import { MapPinSimpleIcon } from "@phosphor-icons/react/ssr";
import { Pagina } from "@/components/pagina";
import { StatoVuoto } from "@/components/stato-vuoto";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = { title: "Pagina non trovata" };

export default function NonTrovata() {
  return (
    <Pagina className="max-w-xl">
      <StatoVuoto
        icona={<MapPinSimpleIcon weight="regular" />}
        titolo="Pagina non trovata"
        principale
        azione={
          <div className="flex flex-wrap justify-center gap-2">
            <Link href="/" className={buttonVariants()}>
              Torna alla home
            </Link>
            <Link href="/classifica" className={buttonVariants({ variant: "outline" })}>
              Vai alla classifica
            </Link>
          </div>
        }
      >
        Controlla l&apos;indirizzo. Se cercavi una segnalazione, potrebbe essere stata ritirata o non essere ancora pubblica.
      </StatoVuoto>
    </Pagina>
  );
}
