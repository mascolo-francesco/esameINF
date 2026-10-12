import { LIVELLO, richiediUtente } from "@/lib/server/auth/sessione";
import { ShieldCheckIcon, UsersIcon } from "@phosphor-icons/react/ssr";
import { SchedeNavigazione } from "@/components/schede-navigazione";

export default async function LayoutModerazione({ children }: LayoutProps<"/moderazione">) {
  await richiediUtente(LIVELLO.moderatore, "/moderazione");
  return (
    <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 pt-8 pb-12 sm:pt-10">
      <div className="grid gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">Moderazione</h1>
        <SchedeNavigazione
          voci={[
            { href: "/moderazione", testo: "Coda di revisione", icona: <ShieldCheckIcon aria-hidden /> },
            { href: "/moderazione/utenti", testo: "Utenti e provvedimenti", icona: <UsersIcon aria-hidden /> },
          ]}
        />
      </div>
      {children}
    </div>
  );
}
