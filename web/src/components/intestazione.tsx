import Link from "next/link";
import { Logo } from "@/components/logo";
import { PlusIcon } from "@phosphor-icons/react/ssr";
import { utenteCorrente } from "@/lib/server/auth/sessione";
import { db } from "@/lib/server/db";
import { buttonVariants } from "@/components/ui/button";
import { MenuUtente } from "@/components/menu-utente";
import { NavPrincipale } from "@/components/nav-principale";
import { cn } from "@/lib/utils";

export async function Intestazione() {
  const utente = await utenteCorrente();
  const daLeggere = utente
    ? ((await db.riga<{ n: number }>("SELECT COUNT(*) AS n FROM notifica WHERE id_utente = ? AND NOT letta", [utente.id]))?.n ?? 0)
    : 0;
  return (
    <header className="sticky top-0 z-40 bg-carta">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
        <Link href="/" className="mr-3 flex-none">
          <Logo />
          <span className="sr-only">, pagina iniziale</span>
        </Link>
        <NavPrincipale />
        <div className="ml-auto flex items-center gap-2">
          <Link href="/nuova" className={cn(buttonVariants({ size: "sm" }), "hidden sm:inline-flex")}>
            <PlusIcon weight="bold" aria-hidden />
            Segnala
          </Link>
          {utente ? (
            <MenuUtente nome={utente.nomeVisualizzato} livello={utente.livello} daLeggere={daLeggere} />
          ) : (
            <Link href="/accedi" className={buttonVariants({ variant: "outline", size: "sm" })}>
              Accedi
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
