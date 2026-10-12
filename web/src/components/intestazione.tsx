import Link from "next/link";
import { MapPinned, Plus } from "lucide-react";
import { utenteCorrente } from "@/lib/server/auth/sessione";
import { buttonVariants } from "@/components/ui/button";
import { MenuUtente } from "@/components/menu-utente";
import { cn } from "@/lib/utils";

const VOCI = [
  { href: "/mappa", testo: "Mappa" },
  { href: "/classifica", testo: "Classifica" },
];

export async function Intestazione() {
  const utente = await utenteCorrente();
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4">
        <Link href="/" className="mr-2 flex items-center gap-2 font-semibold tracking-tight">
          <MapPinned className="size-5 text-primary" aria-hidden />
          <span className="hidden sm:inline">La Nostra Città</span>
          <span className="sm:hidden">LNC</span>
        </Link>
        <nav aria-label="Principale" className="flex items-center gap-1">
          {VOCI.map((v) => (
            <Link key={v.href} href={v.href} className={buttonVariants({ variant: "ghost", size: "sm" })}>
              {v.testo}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Link href="/nuova" className={cn(buttonVariants({ size: "sm" }), "gap-1")}>
            <Plus className="size-4" aria-hidden />
            Segnala
          </Link>
          {utente ? (
            <MenuUtente nome={utente.nomeVisualizzato} livello={utente.livello} />
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
