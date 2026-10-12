import Link from "next/link";
import { Pagina } from "@/components/pagina";
import { buttonVariants } from "@/components/ui/button";

export default function Home() {
  return (
    <Pagina titolo="La Nostra Città, Il Nostro Futuro" descrizione="Le segnalazioni dei cittadini di Milano.">
      <Link href="/classifica" className={buttonVariants()}>
        Vedi la classifica
      </Link>
    </Pagina>
  );
}
