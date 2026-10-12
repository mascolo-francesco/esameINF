import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "@phosphor-icons/react/ssr";
import { db } from "@/lib/server/db";
import { LIVELLO, richiediUtente } from "@/lib/server/auth/sessione";
import { cronologia, dettaglioSegnalazione } from "@/lib/server/consultazione";
import { elencoCategorie } from "@/lib/server/catalogo";
import { formattaDataOra, formattaNumero } from "@/lib/formato";
import { BadgeCategoria, BadgeStato } from "@/components/stato";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CorreggiPosizione, FormCategorie, FormSanzione, FormUnisci, PannelloDecisioni } from "./pannelli";

export const metadata: Metadata = { title: "Revisione segnalazione" };

export default async function RevisioneSegnalazione({ params }: PageProps<"/moderazione/[codice]">) {
  const u = await richiediUtente(LIVELLO.moderatore, "/moderazione");
  const { codice } = await params;
  const s = await dettaglioSegnalazione(codice);
  if (!s) notFound();

  const [passi, categorie, foto, autore, abusi] = await Promise.all([
    cronologia(s.id),
    elencoCategorie(),
    // solo per lo staff: dati EXIF e originale (RNF-14)
    db.righe<{
      id: number;
      percorso_originale: string;
      percorso_miniatura: string;
      exif_latitudine: number | null;
      exif_longitudine: number | null;
      exif_data_scatto: Date | null;
      exif_dispositivo: string | null;
      distanza_m: number | null;
    }>(
      `SELECT a.id, a.percorso_originale, a.percorso_miniatura, a.exif_latitudine, a.exif_longitudine, a.exif_data_scatto,
              a.exif_dispositivo,
              IF(a.exif_latitudine IS NULL, NULL,
                 ROUND(ST_Distance_Sphere(s.posizione, ST_SRID(POINT(a.exif_longitudine, a.exif_latitudine), 4326)))) AS distanza_m
         FROM allegato a JOIN segnalazione s ON s.id = a.id_segnalazione
        WHERE a.id_segnalazione = ? ORDER BY a.ordine`,
      [s.id],
    ),
    db.riga<{ id: number; nome_visualizzato: string; stato_account: string; livello: number; segnalazioni: number; rifiutate: number }>(
      `SELECT u.id, u.nome_visualizzato, u.stato_account, r.livello,
              (SELECT COUNT(*) FROM segnalazione x WHERE x.id_autore = u.id AND x.stato_corrente <> 'BOZZA') AS segnalazioni,
              (SELECT COUNT(*) FROM segnalazione x WHERE x.id_autore = u.id AND x.stato_corrente = 'RIFIUTATA') AS rifiutate
         FROM utente u JOIN ruolo r ON r.id = u.id_ruolo WHERE u.id = ?`,
      [s.idAutore],
    ),
    db.righe<{ motivo: string; nota: string | null; data: Date; esito: string }>(
      "SELECT motivo, nota, data, esito FROM segnalazione_abuso WHERE id_segnalazione = ? ORDER BY data DESC",
      [s.id],
    ),
  ]);
  const abusiAperti = abusi.filter((a) => a.esito === "aperta").length;

  return (
    <div className="grid gap-6">
      <Link href="/moderazione" className="flex w-fit items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline">
        <ArrowLeftIcon className="size-4" aria-hidden />
        Torna alla coda
      </Link>
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="grid min-w-0 content-start gap-6">
          <header className="grid gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <BadgeStato codice={s.statoCodice} nome={s.stato} />
              <span className="font-mono text-xs text-muted-foreground">{s.codice}</span>
              <span className="text-xs text-muted-foreground">{s.tipo === "proposta" ? "Proposta" : "Problema"}</span>
              {s.pubblico && (
                <Link href={`/segnalazioni/${s.codice}`} className="text-xs text-primary underline-offset-4 hover:underline">
                  Vedi la pagina pubblica
                </Link>
              )}
            </div>
            <h2 className="text-2xl leading-tight font-semibold tracking-tight">{s.titolo}</h2>
            <p className="text-sm text-muted-foreground">
              {s.indirizzo ? `${s.indirizzo} · ` : ""}
              {s.quartiere} · {s.municipio}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {s.categorie.length ? (
                s.categorie.map((k) => <BadgeCategoria key={k.id} nome={k.nome} colore={k.colore} />)
              ) : (
                <span className="text-xs text-destructive">Nessuna categoria confermata</span>
              )}
            </div>
          </header>
          <p className="max-w-prose leading-relaxed whitespace-pre-line">{s.descrizione}</p>

          <section className="grid gap-3" aria-labelledby="foto">
            <h3 id="foto" className="font-semibold">
              Foto originali e metadati
            </h3>
            <ul className="grid gap-3 sm:grid-cols-2">
              {foto.map((f, i) => (
                <li key={f.id} className="grid gap-2 rounded-xl border bg-card p-2 text-xs shadow-card">
                  <a href={f.percorso_originale} target="_blank" rel="noopener">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={f.percorso_miniatura} alt={`Foto ${i + 1}`} className="aspect-[4/3] w-full rounded-lg object-cover" />
                  </a>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
                    <dt className="text-muted-foreground">Scatto</dt>
                    <dd>{f.exif_data_scatto ? formattaDataOra(f.exif_data_scatto) : "—"}</dd>
                    <dt className="text-muted-foreground">Dispositivo</dt>
                    <dd>{f.exif_dispositivo ?? "—"}</dd>
                    <dt className="text-muted-foreground">GPS foto</dt>
                    <dd>
                      {f.distanza_m === null ? (
                        "assente"
                      ) : (
                        <span className={f.distanza_m > 1000 ? "font-medium text-destructive" : undefined}>
                          a {formattaNumero(f.distanza_m)} m dal punto indicato
                        </span>
                      )}
                    </dd>
                  </dl>
                </li>
              ))}
            </ul>
          </section>

          <Card>
            <CardHeader>
              <CardTitle>Posizione</CardTitle>
            </CardHeader>
            <CardContent>
              <CorreggiPosizione codice={s.codice} lat={s.lat} lon={s.lon} modificabile={!s.finale} />
            </CardContent>
          </Card>

          <section className="grid gap-3" aria-labelledby="cronologia">
            <h3 id="cronologia" className="font-semibold">
              Cronologia
            </h3>
            <ol className="grid gap-2 text-sm">
              {passi.map((p) => (
                <li key={p.id} className="rounded-lg bg-sunken px-3 py-2 ring-1 ring-border">
                  <span className="font-medium">
                    {p.da} → {p.a}
                  </span>{" "}
                  <span className="text-xs text-muted-foreground">
                    {formattaDataOra(p.data)} · {p.attore}
                  </span>
                  {p.motivazione && <p className="text-xs">{p.motivazione}</p>}
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="grid content-start gap-4">
          <Card className="shadow-raised ring-primary/30">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Decisione</CardTitle>
            </CardHeader>
            <CardContent>
              <PannelloDecisioni codice={s.codice} stato={s.statoCodice} abusiAperti={abusiAperti} senzaCategorie={s.categorie.length === 0} />
            </CardContent>
          </Card>

          {abusi.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Segnalazioni di abuso</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="grid gap-2 text-sm">
                  {abusi.map((a, i) => (
                    <li key={i}>
                      <span className="font-medium">{a.motivo.replaceAll("_", " ")}</span>{" "}
                      <span className="text-xs text-muted-foreground">
                        {formattaDataOra(a.data)} · {a.esito}
                      </span>
                      {a.nota && <p className="text-xs">{a.nota}</p>}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {!s.finale && (
            <Card>
              <CardHeader>
                <CardTitle>Categorie</CardTitle>
              </CardHeader>
              <CardContent>
                <FormCategorie codice={s.codice} categorie={categorie} scelte={s.categorie.map((k) => k.id)} />
              </CardContent>
            </Card>
          )}

          {s.statoCodice === "PUBBLICATA" && (
            <Card>
              <CardHeader>
                <CardTitle>Duplicato</CardTitle>
              </CardHeader>
              <CardContent>
                <FormUnisci codice={s.codice} />
              </CardContent>
            </Card>
          )}

          {autore && (
            <Card>
              <CardHeader>
                <CardTitle>Autore</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm">
                <p>
                  <span className="font-medium">{autore.nome_visualizzato}</span> · account {autore.stato_account}
                  <br />
                  <span className="text-xs text-muted-foreground">
                    {autore.segnalazioni} segnalazioni inviate, {autore.rifiutate} rifiutate
                  </span>
                </p>
                {autore.livello < u.livello && autore.stato_account !== "cancellato" && (
                  <FormSanzione idUtente={autore.id} nome={autore.nome_visualizzato} />
                )}
              </CardContent>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}
