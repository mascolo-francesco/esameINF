import { LIVELLO, richiediUtente } from "@/lib/server/auth/sessione";
import { ClockCounterClockwiseIcon, FileTextIcon, GaugeIcon, SlidersHorizontalIcon, TagIcon, UserGearIcon } from "@phosphor-icons/react/ssr";
import { SchedeNavigazione } from "@/components/schede-navigazione";

export default async function LayoutAdmin({ children }: LayoutProps<"/admin">) {
  await richiediUtente(LIVELLO.amministratore, "/admin");
  return (
    <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 pt-8 pb-12 sm:pt-10">
      <div className="grid gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">Amministrazione</h1>
        <SchedeNavigazione
          voci={[
            { href: "/admin", testo: "Dashboard", icona: <GaugeIcon aria-hidden /> },
            { href: "/admin/documenti", testo: "Documento programmatico", icona: <FileTextIcon aria-hidden /> },
            { href: "/admin/utenti", testo: "Ruoli", icona: <UserGearIcon aria-hidden /> },
            { href: "/admin/categorie", testo: "Categorie", icona: <TagIcon aria-hidden /> },
            { href: "/admin/parametri", testo: "Parametri", icona: <SlidersHorizontalIcon aria-hidden /> },
            { href: "/admin/audit", testo: "Registro di audit", icona: <ClockCounterClockwiseIcon aria-hidden /> },
          ]}
        />
      </div>
      {children}
    </div>
  );
}
