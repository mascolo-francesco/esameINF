import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, CircleCheck, MapPin, User } from "lucide-react";
import { utenteCorrente } from "@/lib/server/auth/sessione";
import { aggiornamenti, commenti, cronologia, dettaglioSegnalazione, relazioneUtente } from "@/lib/server/consultazione";
import { formattaData, formattaDataOra, formattaNumero } from "@/lib/formato";
import { BadgeCategoria, BadgeStato } from "@/components/stato";
import { MappaPunto } from "@/components/mappa/mappa-punto";
import { Galleria } from "./galleria";
import { AzioniSostegno, Condividi, FormAggiornamento, FormCommento, FormIntegrazione, PulsanteRitira, SegnalaAbuso } from "./interazioni";

export async function generateMetadata({ params }: PageProps<"/segnalazioni/[codice]">): Promise<Metadata> {
  const { codice } = await params;
  const s = await dettaglioSegnalazione(codice);
  if (!s || !s.pubblico) return { title: "Segnalazione" };
  const descrizione = s.descrizione.length > 180 ? `${s.descrizione.slice(0, 177)}…` : s.descrizione;
  // RF-41: anteprima per chi condivide il link
  return {
    title: s.titolo,
    description: descrizione,
    openGraph: { title: s.titolo, description: descrizione, type: "article", images: s.foto[0] ? [s.foto[0].pubblica] : [] },
  };
}

export default async function PaginaSegnalazione({ params, searchParams }: PageProps<"/segnalazioni/[codice]">) {
  const { codice } = await params;
  const { inviata } = await searchParams;
  const [s, u] = await Promise.all([dettaglioSegnalazione(codice), utenteCorrente()]);
  if (!s) notFound();
  const autore = u?.id === s.idAutore;
  const staff = (u?.livello ?? 0) >= 2;
  if (!s.pubblico && !autore && !staff) notFound();

  const [passi, listaCommenti, listaAggiornamenti, rel] = await Promise.all([
    cronologia(s.id),
    s.pubblico ? commenti(s.id) : Promise.resolve([]),
    s.pubblico ? aggiornamenti(s.id) : Promise.resolve([]),
    u ? relazioneUtente(u.id, s.id) : Promise.resolve({ sostiene: false, segue: false }),
  ]);
  const colore = s.categorie[0]?.colore;
  const puoRitirare = autore && ["RICEVUTA", "DA_INTEGRARE", "PUBBLICATA"].includes(s.statoCodice);

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-8">
      {inviata && (
        <p role="status" className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm">
          <CircleCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          Segnalazione inviata con il codice {s.codice}. Un moderatore la controllerà a breve: riceverai una notifica
          quando sarà pubblicata.
        </p>
      )}
      {s.statoCodice === "UNITA" && s.codicePrincipale && (
        <p role="status" className="rounded-lg border bg-muted p-4 text-sm">
          Questa segnalazione è stata unita a{" "}
          <Link href={`/segnalazioni/${s.codicePrincipale}`} className="font-medium text-primary underline-offset-4 hover:underline">
            {s.codicePrincipale}
          </Link>
          , che descrive lo stesso problema. I sostegni sono stati spostati lì.
        </p>
      )}

      <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        <article className="grid min-w-0 content-start gap-6">
          <header className="grid gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <BadgeStato codice={s.statoCodice} nome={s.stato} />
              <span className="text-xs text-muted-foreground">{s.tipo === "proposta" ? "Proposta" : "Problema"} · {s.codice}</span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">{s.titolo}</h1>
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <li className="flex items-center gap-1.5">
                <MapPin className="size-4" aria-hidden />
                {s.indirizzo ? `${s.indirizzo}, ` : ""}
                {s.quartiere} · {s.municipio}
              </li>
              <li className="flex items-center gap-1.5">
                <User className="size-4" aria-hidden />
                {s.autore}
              </li>
              {(s.dataPubblicazione ?? s.dataInvio) && (
                <li className="flex items-center gap-1.5">
                  <CalendarDays className="size-4" aria-hidden />
                  {formattaData((s.dataPubblicazione ?? s.dataInvio)!)}
                </li>
              )}
            </ul>
            {s.categorie.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {s.categorie.map((k) => (
                  <BadgeCategoria key={k.id} nome={k.nome} colore={k.colore} />
                ))}
              </div>
            )}
          </header>

          <Galleria foto={s.foto} titolo={s.titolo} />
          <p className="leading-relaxed whitespace-pre-line">{s.descrizione}</p>

          {autore && s.statoCodice === "DA_INTEGRARE" && (
            <section className="grid gap-3 rounded-lg border border-orange-300 bg-orange-50 p-4" aria-labelledby="integra">
              <h2 id="integra" className="font-semibold text-orange-950">
                Il comitato ti chiede di integrare la segnalazione
              </h2>
              <p className="text-sm text-orange-950">{passi.at(-1)?.motivazione}</p>
              <FormIntegrazione codice={s.codice} titolo={s.titolo} descrizione={s.descrizione} />
            </section>
          )}

          {listaAggiornamenti.length > 0 && (
            <section className="grid gap-3" aria-labelledby="aggiornamenti">
              <h2 id="aggiornamenti" className="text-lg font-semibold">
                Aggiornamenti dell&apos;autore
              </h2>
              <ul className="grid gap-3">
                {listaAggiornamenti.map((a) => (
                  <li key={a.id} className="rounded-lg border-l-4 border-primary bg-muted/50 p-3 text-sm">
                    <p className="whitespace-pre-line">{a.testo}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{formattaDataOra(a.data)}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {autore && s.pubblico && s.votabile && <FormAggiornamento codice={s.codice} />}

          {s.pubblico && (
            <section className="grid gap-4" aria-labelledby="commenti">
              <h2 id="commenti" className="text-lg font-semibold">
                Commenti ({listaCommenti.length})
              </h2>
              {listaCommenti.length === 0 && <p className="text-sm text-muted-foreground">Ancora nessun commento.</p>}
              <ul className="grid gap-4">
                {listaCommenti.map((c) => (
                  <li key={c.id} className="grid gap-1 border-b pb-4 last:border-0">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="font-medium">{c.autore}</span>
                      <span className="flex items-center gap-2 text-xs text-muted-foreground">
                        {formattaDataOra(c.data)}
                        {u && u.id !== c.id_autore && <SegnalaAbuso codice={s.codice} oggetto="commento" idOggetto={c.id} piccolo />}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-line">{c.testo}</p>
                  </li>
                ))}
              </ul>
              {s.votabile &&
                (u ? (
                  <FormCommento codice={s.codice} />
                ) : (
                  <p className="text-sm">
                    <Link href={`/accedi?da=/segnalazioni/${s.codice}`} className="font-medium text-primary underline-offset-4 hover:underline">
                      Accedi
                    </Link>{" "}
                    per commentare.
                  </p>
                ))}
            </section>
          )}
        </article>

        <aside className="grid content-start gap-6">
          <div className="grid gap-3 rounded-lg border p-4">
            <p className="flex items-baseline gap-2">
              <span className="text-3xl font-semibold tabular-nums">{s.sostegni}</span>
              <span className="text-muted-foreground">{s.sostegni === 1 ? "sostegno" : "sostegni"}</span>
            </p>
            {s.pubblico && <p className="text-xs text-muted-foreground">Punteggio di priorità {formattaNumero(s.punteggio, 2)}</p>}
            <AzioniSostegno
              codice={s.codice}
              accesso={Boolean(u)}
              autore={autore}
              votabile={s.votabile}
              sostiene={rel.sostiene}
              segue={rel.segue}
            />
            {s.pubblico && <Condividi titolo={s.titolo} />}
            {u && !autore && s.pubblico && <SegnalaAbuso codice={s.codice} oggetto="segnalazione" idOggetto={s.id} />}
            {puoRitirare && <PulsanteRitira codice={s.codice} />}
          </div>

          <MappaPunto lat={s.lat} lon={s.lon} colore={colore} className="h-56" />

          <section aria-labelledby="cronologia" className="grid gap-3">
            <h2 id="cronologia" className="font-semibold">
              Cronologia
            </h2>
            <ol className="grid gap-3 border-l pl-4">
              {passi.map((p) => (
                <li key={p.id} className="relative text-sm">
                  <span className="absolute top-1.5 -left-[1.3rem] size-2 rounded-full bg-primary" aria-hidden />
                  <p className="font-medium">{p.a}</p>
                  <p className="text-xs text-muted-foreground">
                    {formattaDataOra(p.data)} · {ATTORI[p.attore] ?? p.attore}
                  </p>
                  {p.motivazione && <p className="mt-0.5 text-xs">{p.motivazione}</p>}
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </div>
  );
}

const ATTORI: Record<string, string> = {
  autore: "autore",
  sistema: "sistema",
  moderatore: "comitato",
  amministratore: "comitato",
};
