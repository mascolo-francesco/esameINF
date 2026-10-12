import Link from "next/link";
import { Pagina } from "@/components/pagina";

export default function NonTrovata() {
  return (
    <Pagina titolo="Pagina non trovata" descrizione="Il link potrebbe essere sbagliato, oppure il contenuto non è più pubblico." stretta>
      <Link href="/" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
        Torna alla home
      </Link>
    </Pagina>
  );
}
