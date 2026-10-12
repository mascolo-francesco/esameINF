import { LIVELLO, richiediUtente } from "@/lib/server/auth/sessione";
import { SchedeNavigazione } from "@/components/schede-navigazione";

export default async function LayoutModerazione({ children }: LayoutProps<"/moderazione">) {
  await richiediUtente(LIVELLO.moderatore, "/moderazione");
  return (
    <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-8">
      <div className="grid gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Moderazione</h1>
        <SchedeNavigazione
          voci={[
            { href: "/moderazione", testo: "Coda di revisione" },
            { href: "/moderazione/utenti", testo: "Utenti e provvedimenti" },
          ]}
        />
      </div>
      {children}
    </div>
  );
}
