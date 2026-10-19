import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarBlankIcon, ChatCircleIcon, CheckCircleIcon, InfoIcon, MapPinIcon, UserIcon } from "@phosphor-icons/react/ssr";
import { utenteCorrente } from "@/lib/server/auth/sessione";
import { aggiornamenti, commenti, cronologia, dettaglioSegnalazione, relazioneUtente } from "@/lib/server/consultazione";
import { formattaData, formattaDataOra, formattaNumero } from "@/lib/formato";
import { BadgeCategoria, BadgeStato } from "@/components/stato";
import { MappaPunto } from "@/components/mappa/mappa-punto";
import { StatoVuoto } from "@/components/stato-vuoto";
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
    <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 pt-8 pb-12 sm:pt-10">
      {inviata && (
        <p role="status" className="flex items-start gap-3 rounded-xl border border-primary/30 bg-secondary p-4 text-sm text-secondary-foreground">
          <CheckCircleIcon weight="fill" className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
          Segnalazione inviata con il codice {s.codice}. Un moderatore la controllerà a breve: riceverai una notifica
          quando sarà pubblicata.
        </p>
      )}
      {s.statoCodice === "UNITA" && s.codicePrincipale && (
        <p role="status" className="flex items-start gap-3 rounded-xl border bg-sunken p-4 text-sm">
          <InfoIcon weight="fill" className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
          <span>
          Questa segnalazione è stata unita a{" "}
          <Link href={`/segnalazioni/${s.codicePrincipale}`} className="font-medium text-primary underline-offset-4 hover:underline">
            {s.codicePrincipale}
          </Link>
          , che descrive lo stesso problema. I sostegni sono stati spostati lì.
          </span>
        </p>
      )}

      {/* Ordine nel DOM: contenuto, colonna del sostegno, commenti. Su telefono il pulsante "Sostieni"
          arriva subito dopo la descrizione; da lg in su la colonna occupa entrambe le righe a destra. */}
      <div className="grid gap-8 lg:grid-cols-[1fr_20rem] lg:grid-rows-[auto_1fr]">
        <article className="grid min-w-0 content-start gap-6 lg:col-start-1 lg:row-start-1">
          <header className="grid gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <BadgeStato codice={s.statoCodice} nome={s.stato} />
              <span className="text-sm text-muted-foreground">
                {s.tipo === "proposta" ? "Proposta" : "Problema"} · <span className="font-mono text-xs">{s.codice}</span>
              </span>
            </div>
            <h1 className="text-3xl leading-tight font-semibold tracking-tight sm:text-4xl">{s.titolo}</h1>
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <li className="flex items-center gap-1.5">
                <MapPinIcon className="size-4 shrink-0" aria-hidden />
                {s.indirizzo ? `${s.indirizzo}, ` : ""}
                {s.quartiere} · {s.municipio}
              </li>
              <li className="flex items-center gap-1.5">
                <UserIcon className="size-4 shrink-0" aria-hidden />
                {s.autore}
              </li>
              {(s.dataPubblicazione ?? s.dataInvio) && (
                <li className="flex items-center gap-1.5">
                  <CalendarBlankIcon className="size-4 shrink-0" aria-hidden />
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
          <p className="max-w-prose text-lg leading-relaxed whitespace-pre-line">{s.descrizione}</p>
        </article>

        <aside className="grid content-start gap-6 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <div className="grid gap-4 rounded-2xl border bg-card p-5 shadow-raised">
            <div className="grid gap-1">
              <p className="flex items-baseline gap-2">
                <span className="text-4xl font-semibold tracking-tight tabular-nums">{s.sostegni}</span>
                <span className="text-muted-foreground">{s.sostegni === 1 ? "sostegno" : "sostegni"}</span>
              </p>
              {s.pubblico && <p className="text-sm text-muted-foreground">Punteggio di priorità {formattaNumero(s.punteggio, 2)}</p>}
            </div>
            <AzioniSostegno
              codice={s.codice}
              accesso={Boolean(u)}
              autore={autore}
              votabile={s.votabile}
              sostiene={rel.sostiene}
              segue={rel.segue}
            />
            {s.pubblico && <Condividi titolo={s.titolo} />}
            {((u && !autore && s.pubblico) || puoRitirare) && (
              <div className="grid gap-1 border-t pt-3">
                {u && !autore && s.pubblico && <SegnalaAbuso codice={s.codice} oggetto="segnalazione" idOggetto={s.id} />}
                {puoRitirare && <PulsanteRitira codice={s.codice} />}
              </div>
            )}
          </div>

          <MappaPunto lat={s.lat} lon={s.lon} colore={colore} className="h-56" />

          <section aria-labelledby="cronologia" className="grid gap-3">
            <h2 id="cronologia" className="text-lg font-semibold tracking-tight">
              Cronologia
            </h2>
            <ol className="ml-1.5 grid gap-4 border-l-2 pl-5">
              {passi.map((p, i) => (
                <li key={p.id} className="relative text-sm">
                  <span
                    className={`absolute top-1 -left-[1.69rem] size-3 rounded-full ring-4 ring-background ${i === passi.length - 1 ? "bg-primary" : "bg-border"}`}
                    aria-hidden
                  />
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

        <div className="grid min-w-0 content-start gap-6 lg:col-start-1 lg:row-start-2">
          {autore && s.statoCodice === "DA_INTEGRARE" && (
            <section className="grid gap-3 rounded-xl border border-orange-300 bg-orange-50 p-5" aria-labelledby="integra">
              <h2 id="integra" className="font-semibold text-orange-950">
                Il comitato ti chiede di integrare la segnalazione
              </h2>
              <p className="text-sm text-orange-950">{passi.at(-1)?.motivazione}</p>
              <FormIntegrazione codice={s.codice} titolo={s.titolo} descrizione={s.descrizione} />
            </section>
          )}

          {listaAggiornamenti.length > 0 && (
            <section className="grid gap-3" aria-labelledby="aggiornamenti">
              <h2 id="aggiornamenti" className="text-xl font-semibold tracking-tight">
                Aggiornamenti dell&apos;autore
              </h2>
              <ul className="grid gap-3">
                {listaAggiornamenti.map((a) => (
                  <li key={a.id} className="rounded-xl border-l-4 border-primary bg-secondary/50 p-4 text-sm">
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
              <h2 id="commenti" className="text-xl font-semibold tracking-tight">
                Commenti <span className="text-muted-foreground tabular-nums">({listaCommenti.length})</span>
              </h2>
              {listaCommenti.length === 0 && (
                <StatoVuoto icona={<ChatCircleIcon weight="duotone" />} titolo="Ancora nessun commento" className="py-8">
                  Aggiungi informazioni utili o una proposta nel campo qui sotto.
                </StatoVuoto>
              )}
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
        </div>

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
