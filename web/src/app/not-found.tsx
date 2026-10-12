import Link from "next/link";
import { MapPinSimpleIcon } from "@phosphor-icons/react/ssr";
import { Pagina } from "@/components/pagina";
import { StatoVuoto } from "@/components/stato-vuoto";
import { buttonVariants } from "@/components/ui/button";

export default function NonTrovata() {
  return (
    <Pagina className="max-w-xl">
      <StatoVuoto
        icona={<MapPinSimpleIcon weight="duotone" />}
        titolo="Pagina non trovata"
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
        Il link potrebbe essere sbagliato, oppure la segnalazione non è più pubblica.
      </StatoVuoto>
    </Pagina>
  );
}
