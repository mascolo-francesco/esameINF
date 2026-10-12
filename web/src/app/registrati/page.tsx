import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { utenteCorrente } from "@/lib/server/auth/sessione";
import { elencoQuartieri } from "@/lib/server/catalogo";
import { Pagina } from "@/components/pagina";
import { FormRegistrazione } from "./form-registrazione";

export const metadata: Metadata = { title: "Registrati" };

export default async function PaginaRegistrati({ searchParams }: PageProps<"/registrati">) {
  const { da } = await searchParams;
  const destinazione = typeof da === "string" ? da : "/";
  if (await utenteCorrente()) redirect(destinazione);
  return (
    <Pagina
      titolo="Crea il tuo account"
      descrizione="Nome e cognome restano privati: in pubblico compare il nome visualizzato che scegli."
      className="max-w-xl"
    >
      <div className="rounded-2xl border bg-card p-6 shadow-card">
        <FormRegistrazione da={destinazione} quartieri={await elencoQuartieri()} />
      </div>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Hai già un account?{" "}
        <Link href="/accedi" className="font-medium text-primary underline-offset-4 hover:underline">
          Accedi
        </Link>
      </p>
    </Pagina>
  );
}
