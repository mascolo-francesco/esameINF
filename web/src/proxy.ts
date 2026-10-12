import { NextResponse, type NextRequest } from "next/server";
import {
  COOKIE_ACCESSO,
  COOKIE_REFRESH,
  DURATA_ACCESSO_S,
  DURATA_REFRESH_S,
  leggiJwt,
  opzioniCookie,
  ruotaRefresh,
} from "@/lib/server/auth/token";
import { ipRichiesta } from "@/lib/server/richiesta";

/**
 * Rinnovo silenzioso della sessione. Se il JWT di accesso è scaduto ma c'è un refresh token,
 * lo ruoto qui, prima che la pagina venga generata: così le Server Components trovano già il
 * cookie nuovo nella richiesta e il browser lo riceve nella risposta.
 */
export async function proxy(request: NextRequest) {
  const accesso = request.cookies.get(COOKIE_ACCESSO)?.value;
  const refresh = request.cookies.get(COOKIE_REFRESH)?.value;
  if (!refresh || (await leggiJwt(accesso, "accesso")) !== null) return NextResponse.next();

  const coppia = await ruotaRefresh(refresh, ipRichiesta(request.headers), request.headers.get("user-agent")).catch(
    (e) => {
      console.error("Rinnovo sessione non riuscito", e);
      return null;
    },
  );

  if (!coppia) {
    // refresh non valido (scaduto, revocato o già usato): tolgo i cookie e proseguo da ospite
    request.cookies.delete(COOKIE_ACCESSO);
    request.cookies.delete(COOKIE_REFRESH);
    const res = NextResponse.next({ request: { headers: request.headers } });
    res.cookies.delete(COOKIE_ACCESSO);
    res.cookies.delete(COOKIE_REFRESH);
    return res;
  }

  request.cookies.set(COOKIE_ACCESSO, coppia.accesso);
  request.cookies.set(COOKIE_REFRESH, coppia.refresh);
  const res = NextResponse.next({ request: { headers: request.headers } });
  res.cookies.set(COOKIE_ACCESSO, coppia.accesso, opzioniCookie(DURATA_ACCESSO_S));
  res.cookies.set(COOKIE_REFRESH, coppia.refresh, opzioniCookie(DURATA_REFRESH_S));
  return res;
}

export const config = {
  // niente proxy per file statici, immagini delle segnalazioni e risorse di Next
  matcher: ["/((?!_next/static|_next/image|api/allegati|icon.png|apple-icon.png|icone/|maplibre/|manifest.webmanifest|sw.js|offline.html).*)"],
};
