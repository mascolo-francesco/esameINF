import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { utenteCorrente } from "@/lib/server/auth/sessione";
import { percorsoInterno } from "@/lib/server/richiesta";
import { Pagina } from "@/components/pagina";
import { FormAccesso } from "./form-accesso";

export const metadata: Metadata = { title: "Accedi" };

export default async function PaginaAccedi({ searchParams }: PageProps<"/accedi">) {
  const { da } = await searchParams;
  const destinazione = percorsoInterno(da);
  if (await utenteCorrente()) redirect(destinazione);
  return (
    <Pagina titolo="Accedi" descrizione="Entra per segnalare, sostenere e commentare." stretta>
      <div className="rounded-2xl border bg-card p-6 shadow-card">
        <FormAccesso da={destinazione} />
      </div>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Non hai un account?{" "}
        <Link href={`/registrati?da=${encodeURIComponent(destinazione)}`} className="font-medium text-primary underline-offset-4 hover:underline">
          Registrati
        </Link>
      </p>
    </Pagina>
  );
}
