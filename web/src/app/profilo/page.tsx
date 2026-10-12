import type { Metadata } from "next";
import { db } from "@/lib/server/db";
import { richiediUtente } from "@/lib/server/auth/sessione";
import { elencoQuartieri } from "@/lib/server/catalogo";
import { Pagina } from "@/components/pagina";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormProfilo, SezioneEliminaAccount, SezioneTotp } from "./sezioni";

export const metadata: Metadata = { title: "Profilo" };

export default async function PaginaProfilo() {
  const u = await richiediUtente(1, "/profilo");
  const p = await db.riga<{
    mostra_nome_reale: number;
    consenso_notifiche: number;
    consenso_addestramento_ia: number;
    data_registrazione: Date;
  }>(
    "SELECT mostra_nome_reale, consenso_notifiche, consenso_addestramento_ia, data_registrazione FROM utente WHERE id = ?",
    [u.id],
  );
  const quartieri = await elencoQuartieri();

  return (
    <Pagina titolo="Il tuo profilo" descrizione={`${u.nome} ${u.cognome} · ${u.email}`} className="max-w-2xl">
      <div className="grid gap-6">
        {u.stato === "sospeso" && (
          <p role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            Il tuo account è sospeso: puoi consultare il sito ma non pubblicare, sostenere o commentare.
          </p>
        )}
        <Card>
          <CardHeader>
            <CardTitle>Come appari in pubblico</CardTitle>
            <CardDescription>Nome, quartiere e preferenze.</CardDescription>
          </CardHeader>
          <CardContent>
            <FormProfilo
              quartieri={quartieri}
              valori={{
                nomeVisualizzato: u.nomeVisualizzato,
                mostraNomeReale: Boolean(p?.mostra_nome_reale),
                idQuartiere: u.idQuartiere,
                consensoNotifiche: Boolean(p?.consenso_notifiche),
                consensoIa: Boolean(p?.consenso_addestramento_ia),
              }}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Verifica in due passaggi</CardTitle>
            <CardDescription>
              Oltre alla password chiede un codice generato dal telefono. È obbligatoria per moderatori e amministratori.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SezioneTotp attiva={u.totpAttivo} staff={u.livello > 1} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>I tuoi dati</CardTitle>
            <CardDescription>Scarica una copia di profilo, segnalazioni, sostegni e commenti (formato JSON).</CardDescription>
          </CardHeader>
          <CardContent>
            <a href="/api/profilo/esporta" className="text-sm font-medium text-primary underline-offset-4 hover:underline" download>
              Scarica i tuoi dati
            </a>
          </CardContent>
        </Card>

        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle>Elimina l&apos;account</CardTitle>
            <CardDescription>
              L&apos;account si chiude subito. Entro 7 giorni nome, email e gli altri dati personali vengono cancellati; le
              segnalazioni restano pubbliche come &quot;Utente rimosso&quot;.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SezioneEliminaAccount />
          </CardContent>
        </Card>
      </div>
    </Pagina>
  );
}
