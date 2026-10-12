import Link from "next/link";
import { Pagina } from "@/components/pagina";

export default function Vietato() {
  return (
    <Pagina titolo="Pagina riservata" descrizione="Questa sezione è riservata ai membri del comitato." stretta>
      <Link href="/" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
        Torna alla home
      </Link>
    </Pagina>
  );
}
