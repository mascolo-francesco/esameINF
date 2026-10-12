import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { utenteIn2fa } from "@/lib/server/auth/sessione";
import { Pagina } from "@/components/pagina";
import { FormVerifica } from "./form-verifica";

export const metadata: Metadata = { title: "Verifica in due passaggi" };

export default async function PaginaVerifica({ searchParams }: PageProps<"/accedi/verifica">) {
  const { da } = await searchParams;
  if ((await utenteIn2fa()) === null) redirect("/accedi");
  return (
    <Pagina
      titolo="Verifica in due passaggi"
      descrizione="Apri l'app di autenticazione sul telefono e inserisci il codice di 6 cifre."
      stretta
    >
      <FormVerifica da={typeof da === "string" ? da : "/"} />
    </Pagina>
  );
}
