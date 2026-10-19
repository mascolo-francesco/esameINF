import { LIVELLO, richiediUtente } from "@/lib/server/auth/sessione";
import { AreaStaff } from "@/components/area-staff";

export default async function LayoutModerazione({ children }: LayoutProps<"/moderazione">) {
  const utente = await richiediUtente(LIVELLO.moderatore, "/moderazione");
  return <AreaStaff utente={utente}>{children}</AreaStaff>;
}
