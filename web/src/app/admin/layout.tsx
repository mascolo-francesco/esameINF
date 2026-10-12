import { LIVELLO, richiediUtente } from "@/lib/server/auth/sessione";
import { SchedeNavigazione } from "@/components/schede-navigazione";

export default async function LayoutAdmin({ children }: LayoutProps<"/admin">) {
  await richiediUtente(LIVELLO.amministratore, "/admin");
  return (
    <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-8">
      <div className="grid gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Amministrazione</h1>
        <SchedeNavigazione
          voci={[
            { href: "/admin", testo: "Dashboard" },
            { href: "/admin/documenti", testo: "Documento programmatico" },
            { href: "/admin/utenti", testo: "Ruoli" },
            { href: "/admin/categorie", testo: "Categorie" },
            { href: "/admin/parametri", testo: "Parametri" },
            { href: "/admin/audit", testo: "Registro di audit" },
          ]}
        />
      </div>
      {children}
    </div>
  );
}
