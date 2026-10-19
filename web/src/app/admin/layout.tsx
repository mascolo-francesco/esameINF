import { LIVELLO, richiediUtente } from "@/lib/server/auth/sessione";
import { AreaStaff } from "@/components/area-staff";

export default async function LayoutAdmin({ children }: LayoutProps<"/admin">) {
  const utente = await richiediUtente(LIVELLO.amministratore, "/admin");
  return <AreaStaff utente={utente}>{children}</AreaStaff>;
}
