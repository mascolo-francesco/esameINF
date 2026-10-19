"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Marker, type Map as MappaLibre } from "maplibre-gl";
import { ArrowLeftIcon, ArrowRightIcon, CameraIcon, CameraPlusIcon, CheckIcon, CrosshairIcon, ImageIcon, MapPinIcon, PaperPlaneTiltIcon, SpinnerGapIcon, TrashIcon, WarningIcon } from "@phosphor-icons/react";
import { cercaSimili, infoPosizione, inviaNuovaSegnalazione, type InfoPosizione, type Simile } from "./azioni";
import { preparaFoto, type FotoPronta } from "@/lib/foto-client";
import { MappaBase } from "@/components/mappa/mappa-base";
import { MessaggioEsito } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface Categoria {
  id: number;
  nome: string;
  descrizione: string;
  colore: string;
}

type Fonte = "exif" | "gps" | "manuale";
interface Posizione {
  lat: number;
  lon: number;
  fonte: Fonte;
}

const PASSI = ["Foto", "Posizione", "Descrizione", "Conferma"] as const;
const MAX_FOTO = 5;

export function Procedura({ categorie }: { categorie: Categoria[] }) {
  const [passo, setPasso] = useState(0);
  const [foto, setFoto] = useState<FotoPronta[]>([]);
  const [posizione, setPosizione] = useState<Posizione | null>(null);
  const [info, setInfo] = useState<InfoPosizione | null | "fuori">(null);
  const [tipo, setTipo] = useState<"problema" | "proposta">("problema");
  const [titolo, setTitolo] = useState("");
  const [descrizione, setDescrizione] = useState("");
  const [indirizzo, setIndirizzo] = useState("");
  const [scelte, setScelte] = useState<number[]>([]);
  const [simili, setSimili] = useState<Simile[] | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [inCorso, avvia] = useTransition();
  const titoloPasso = useRef<HTMLHeadingElement>(null);
  const scegliPosizione = useCallback((p: Posizione) => {
    setInfo(null);
    setPosizione(p);
  }, []);

  // a ogni cambio di passo il focus va sul titolo, così chi usa un lettore di schermo sa dov'è
  useEffect(() => {
    titoloPasso.current?.focus();
  }, [passo]);

  // RF-14: quartiere e Municipio del punto scelto
  useEffect(() => {
    if (!posizione) return;
    let attuale = true;
    infoPosizione(posizione.lat, posizione.lon)
      .then((r) => attuale && setInfo(r ?? "fuori"))
      .catch(() => attuale && setInfo(null));
    return () => {
      attuale = false;
    };
  }, [posizione]);

  const exifConPosizione = foto.find((f) => f.exif.lat !== null && f.exif.lon !== null);

  function vaiA(n: number) {
    setErrore(null);
    setPasso(n);
  }

  function avanti() {
    const e = controllaPasso(passo);
    if (e) return setErrore(e);
    if (passo === 2 && posizione) {
      setSimili(null);
      cercaSimili(posizione.lat, posizione.lon, scelte).then(setSimili).catch(() => setSimili([]));
    }
    vaiA(passo + 1);
  }

  function controllaPasso(n: number): string | null {
    if (n === 0 && foto.length === 0) return "Aggiungi almeno una foto.";
    if (n === 1) {
      if (!posizione) return "Indica dove si trova il problema.";
      if (info === "fuori") return "Il punto è fuori dal Comune di Milano: spostalo dentro i confini.";
    }
    if (n === 2) {
      if (titolo.trim().length < 10) return "Il titolo deve avere almeno 10 caratteri.";
      if (descrizione.trim().length < 30) return "La descrizione deve avere almeno 30 caratteri.";
      if (scelte.length === 0) return "Scegli almeno una categoria.";
    }
    return null;
  }

  function invia() {
    if (!posizione) return;
    const fd = new FormData();
    foto.forEach((f) => fd.append("foto", f.blob, f.nome));
    fd.append("exif", JSON.stringify(foto.map((f) => f.exif)));
    fd.append("titolo", titolo);
    fd.append("descrizione", descrizione);
    fd.append("tipo", tipo);
    fd.append("indirizzo", indirizzo);
    fd.append("latitudine", String(posizione.lat));
    fd.append("longitudine", String(posizione.lon));
    fd.append("fonte", posizione.fonte);
    scelte.forEach((k) => fd.append("categorie", String(k)));
    setErrore(null);
    avvia(async () => {
      const r = await inviaNuovaSegnalazione(fd);
      if (!r.ok) setErrore(r.errore);
    });
  }

  return (
    <div className="grid gap-6">
      <ol className="grid grid-cols-4 gap-2" aria-label="Avanzamento">
        {PASSI.map((p, i) => (
          <li key={p} aria-current={i === passo ? "step" : undefined} className="grid gap-2">
            <span className={cn("h-1.5 transition-colors duration-300", i <= passo ? "bg-primary" : "bg-sunken")} aria-hidden />
            <span className={cn("flex items-center gap-1.5 text-sm", i === passo ? "font-semibold" : "text-muted-foreground")}>
              <span
                className={cn(
                  "grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-semibold tabular-nums",
                  i < passo ? "bg-primary text-primary-foreground" : i === passo ? "bg-foreground text-background" : "bg-muted",
                )}
                aria-hidden
              >
                {i < passo ? <CheckIcon weight="bold" className="size-3" /> : i + 1}
              </span>
              {/* sui telefoni si legge solo il nome del passo corrente: gli altri restano per i lettori di schermo */}
              <span className={cn(i !== passo && "max-sm:sr-only")}>
                <span className="sr-only">{i < passo ? "Completato: " : ""}</span>
                {p}
              </span>
            </span>
          </li>
        ))}
      </ol>

      <section aria-labelledby="titolo-passo" className="grid gap-4">
        <h2 id="titolo-passo" ref={titoloPasso} tabIndex={-1} className="text-xl font-semibold tracking-tight outline-none">
          Passo {passo + 1} di 4 · {PASSI[passo]}
        </h2>

        {passo === 0 && <PassoFoto foto={foto} setFoto={setFoto} setErrore={setErrore} />}

        {passo === 1 && (
          <PassoPosizione
            posizione={posizione}
            setPosizione={scegliPosizione}
            info={info}
            exif={exifConPosizione ? { lat: exifConPosizione.exif.lat!, lon: exifConPosizione.exif.lon! } : null}
            setErrore={setErrore}
          />
        )}

        {passo === 2 && (
          <div className="grid gap-5">
            <fieldset className="grid gap-2">
              <legend className="mb-1 text-sm font-medium">Che cosa vuoi segnalare?</legend>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["problema", "Un problema", "Qualcosa che non funziona o è rovinato"],
                    ["proposta", "Una proposta", "Un'idea per migliorare il quartiere"],
                  ] as const
                ).map(([v, t, d]) => (
                  <label
                    key={v}
                    className="flex min-w-44 flex-1 cursor-pointer flex-col gap-0.5 rounded-xl border bg-card p-4 text-sm shadow-card transition-[border-color,background-color] has-[:checked]:border-primary has-[:checked]:bg-tinta-50 has-[:checked]:ring-1 has-[:checked]:ring-primary has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50"
                  >
                    <input type="radio" name="tipo" value={v} checked={tipo === v} onChange={() => setTipo(v)} className="sr-only" />
                    <span className="font-semibold">{t}</span>
                    <span className="text-muted-foreground">{d}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="grid gap-1.5">
              <Label htmlFor="titolo">Titolo</Label>
              <Input id="titolo" value={titolo} maxLength={100} onChange={(e) => setTitolo(e.target.value)} aria-describedby="titolo-aiuto" />
              <p id="titolo-aiuto" className="text-xs text-muted-foreground">
                Da 10 a 100 caratteri · {titolo.trim().length}/100
              </p>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="descrizione">Descrizione</Label>
              <Textarea
                id="descrizione"
                value={descrizione}
                maxLength={2000}
                rows={5}
                onChange={(e) => setDescrizione(e.target.value)}
                aria-describedby="descrizione-aiuto"
              />
              <p id="descrizione-aiuto" className="text-xs text-muted-foreground">
                Spiega cosa succede e da quanto tempo. Da 30 a 2000 caratteri · {descrizione.trim().length}/2000
              </p>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="indirizzo">Indirizzo o punto di riferimento (facoltativo)</Label>
              <Input id="indirizzo" value={indirizzo} maxLength={255} onChange={(e) => setIndirizzo(e.target.value)} />
            </div>
            <fieldset className="grid gap-2">
              <legend className="mb-1 text-sm font-medium">Categorie (da 1 a 3)</legend>
              <div className="flex flex-wrap gap-2">
                {categorie.map((k) => {
                  const attiva = scelte.includes(k.id);
                  return (
                    <label
                      key={k.id}
                      title={k.descrizione}
                      className="flex min-h-10 cursor-pointer items-center gap-2 border bg-card px-3.5 py-2 text-sm transition-[border-color,background-color] has-[:checked]:border-primary has-[:checked]:bg-tinta-50 has-[:checked]:font-medium has-[:checked]:text-tinta-ink has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50 has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50"
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={attiva}
                        disabled={!attiva && scelte.length >= 3}
                        onChange={() => setScelte(attiva ? scelte.filter((x) => x !== k.id) : [...scelte, k.id])}
                      />
                      <span className="size-2.5 rounded-full" style={{ background: k.colore }} aria-hidden />
                      {k.nome}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          </div>
        )}

        {passo === 3 && posizione && (
          <Riepilogo
            foto={foto}
            info={info !== "fuori" ? info : null}
            tipo={tipo}
            titolo={titolo}
            descrizione={descrizione}
            indirizzo={indirizzo}
            categorie={categorie.filter((k) => scelte.includes(k.id))}
            simili={simili}
          />
        )}
      </section>

      <MessaggioEsito esito={errore ? { ok: false, errore } : null} />

      {/* sui telefoni i pulsanti restano attaccati sopra la barra in basso, sempre a portata di pollice */}
      <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 -mx-4 flex justify-between gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur-md sm:static sm:mx-0 sm:bg-transparent sm:px-0 sm:pt-4 sm:pb-0 sm:backdrop-blur-none">
        <Button variant="outline" size="lg" onClick={() => vaiA(passo - 1)} disabled={passo === 0 || inCorso}>
          <ArrowLeftIcon aria-hidden />
          Indietro
        </Button>
        {passo < 3 ? (
          <Button size="lg" onClick={avanti}>
            Avanti
            <ArrowRightIcon aria-hidden />
          </Button>
        ) : (
          <Button size="lg" onClick={invia} disabled={inCorso} aria-busy={inCorso}>
            {inCorso ? <SpinnerGapIcon className="animate-spin" aria-hidden /> : <PaperPlaneTiltIcon aria-hidden />}
            Invia la segnalazione
          </Button>
        )}
      </div>
    </div>
  );
}

function PassoFoto({
  foto,
  setFoto,
  setErrore,
}: {
  foto: FotoPronta[];
  setFoto: (f: FotoPronta[]) => void;
  setErrore: (e: string | null) => void;
}) {
  const [inCorso, setInCorso] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  async function aggiungi(lista: FileList | null) {
    if (!lista?.length) return;
    setErrore(null);
    const posti = MAX_FOTO - foto.length;
    const scelti = Array.from(lista).slice(0, posti);
    if (lista.length > posti) setErrore(`Puoi allegare al massimo ${MAX_FOTO} foto.`);
    setInCorso(true);
    const nuove: FotoPronta[] = [];
    for (const f of scelti) {
      try {
        nuove.push(await preparaFoto(f));
      } catch (e) {
        setErrore(e instanceof Error ? e.message : "Foto non valida.");
      }
    }
    setFoto([...foto, ...nuove]);
    setInCorso(false);
    if (input.current) input.current.value = "";
  }

  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">
        Da 1 a 5 foto (JPEG, PNG, WebP o HEIC). Se la foto contiene la posizione GPS, al passo successivo puoi usarla per indicare il punto. In
        pubblico compare una copia senza metadati.
      </p>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label="Foto scelte">
        {foto.map((f, i) => (
          <li key={f.id} className="relative overflow-hidden rounded-xl border shadow-card">
            {/* eslint-disable-next-line @next/next/no-img-element -- anteprima locale (blob:) */}
            <img src={f.anteprima} alt={`Foto ${i + 1}`} className="aspect-[4/3] w-full object-cover" />
            {f.exif.lat !== null && (
              <span className="absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded-md bg-black/70 px-1.5 py-0.5 text-xs font-medium text-white">
                <MapPinIcon weight="fill" className="size-3" aria-hidden /> GPS
              </span>
            )}
            <Button
              size="icon-sm"
              variant="secondary"
              className="absolute top-1.5 right-1.5 shadow-card"
              aria-label={`Rimuovi la foto ${i + 1}`}
              onClick={() => {
                URL.revokeObjectURL(f.anteprima);
                setFoto(foto.filter((x) => x.id !== f.id));
              }}
            >
              <TrashIcon aria-hidden />
            </Button>
          </li>
        ))}
        {foto.length < MAX_FOTO && (
          <li>
            <label className="flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-input bg-sunken/60 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:bg-tinta-50 hover:text-tinta-ink has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50">
              {inCorso ? <SpinnerGapIcon className="size-7 animate-spin" aria-hidden /> : <CameraPlusIcon weight="duotone" className="size-7" aria-hidden />}
              {inCorso ? "Preparazione delle foto in corso…" : "Aggiungi foto"}
              <input
                ref={input}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
                multiple
                className="sr-only"
                disabled={inCorso}
                onChange={(e) => aggiungi(e.target.files)}
              />
            </label>
          </li>
        )}
      </ul>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <CameraIcon className="size-4" aria-hidden /> Dal telefono puoi scattare la foto direttamente.
      </p>
    </div>
  );
}

function PassoPosizione({
  posizione,
  setPosizione,
  info,
  exif,
  setErrore,
}: {
  posizione: Posizione | null;
  setPosizione: (p: Posizione) => void;
  info: InfoPosizione | null | "fuori";
  exif: { lat: number; lon: number } | null;
  setErrore: (e: string | null) => void;
}) {
  const mappa = useRef<MappaLibre | null>(null);
  const marker = useRef<Marker | null>(null);
  const [cercoGps, setCercoGps] = useState(false);

  // il marker segue lo stato; se manca lo creo al primo punto scelto
  useEffect(() => {
    const m = mappa.current;
    if (!m || !posizione) return;
    if (!marker.current) {
      marker.current = new Marker({ draggable: true, color: "#1f6f5c" }).setLngLat([posizione.lon, posizione.lat]).addTo(m);
      marker.current.on("dragend", () => {
        const p = marker.current!.getLngLat();
        setPosizione({ lat: Number(p.lat.toFixed(6)), lon: Number(p.lng.toFixed(6)), fonte: "manuale" });
      });
    } else {
      marker.current.setLngLat([posizione.lon, posizione.lat]);
    }
    if (!m.getBounds().contains([posizione.lon, posizione.lat])) m.flyTo({ center: [posizione.lon, posizione.lat], zoom: 16 });
  }, [posizione, setPosizione]);

  function usaGps() {
    if (!navigator.geolocation) return setErrore("Il browser non permette di leggere la posizione.");
    setCercoGps(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setCercoGps(false);
        const nuova = { lat: Number(p.coords.latitude.toFixed(6)), lon: Number(p.coords.longitude.toFixed(6)), fonte: "gps" as const };
        setPosizione(nuova);
        mappa.current?.flyTo({ center: [nuova.lon, nuova.lat], zoom: 17 });
      },
      () => {
        setCercoGps(false);
        setErrore("Non riesco a leggere la posizione: controlla i permessi oppure tocca la mappa.");
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">Tocca la mappa nel punto esatto, oppure usa la posizione della foto o del telefono. Puoi trascinare il segnaposto.</p>
      <div className="flex flex-wrap gap-2">
        {exif && (
          <Button
            variant="outline"
            onClick={() => {
              const p = { lat: Number(exif.lat.toFixed(6)), lon: Number(exif.lon.toFixed(6)), fonte: "exif" as const };
              setPosizione(p);
              mappa.current?.flyTo({ center: [p.lon, p.lat], zoom: 17 });
            }}
          >
            <ImageIcon aria-hidden /> Usa la posizione della foto
          </Button>
        )}
        <Button variant="outline" onClick={usaGps} disabled={cercoGps}>
          {cercoGps ? <SpinnerGapIcon className="animate-spin" aria-hidden /> : <CrosshairIcon aria-hidden />}
          Usa la mia posizione
        </Button>
      </div>
      <MappaBase
        etichetta="Mappa per scegliere la posizione"
        className="h-80 sm:h-96"
        opzioni={posizione ? { center: [posizione.lon, posizione.lat], zoom: 16 } : undefined}
        onPronta={(m) => {
          mappa.current = m;
          m.getCanvas().style.cursor = "crosshair";
          m.on("click", (e) => setPosizione({ lat: Number(e.lngLat.lat.toFixed(6)), lon: Number(e.lngLat.lng.toFixed(6)), fonte: "manuale" }));
          if (posizione) setPosizione({ ...posizione }); // ricrea il marker dopo un ritorno a questo passo
          return () => {
            marker.current = null;
            mappa.current = null;
          };
        }}
      />
      <p aria-live="polite" className="text-sm">
        {!posizione && "Nessun punto scelto."}
        {posizione && info === null && "Ricerca del quartiere in corso…"}
        {posizione && info === "fuori" && (
          <span className="flex items-center gap-1.5 text-destructive">
            <WarningIcon weight="fill" className="size-4" aria-hidden /> Il punto è fuori dal Comune di Milano.
          </span>
        )}
        {posizione && info && info !== "fuori" && (
          <>
            Quartiere <strong>{info.quartiere}</strong> · {info.municipio}
          </>
        )}
      </p>
    </div>
  );
}

function Riepilogo({
  foto,
  info,
  tipo,
  titolo,
  descrizione,
  indirizzo,
  categorie,
  simili,
}: {
  foto: FotoPronta[];
  info: InfoPosizione | null;
  tipo: string;
  titolo: string;
  descrizione: string;
  indirizzo: string;
  categorie: Categoria[];
  simili: Simile[] | null;
}) {
  return (
    <div className="grid gap-5">
      {simili && simili.length > 0 && (
        <div className="grid gap-3 border border-avviso-bordo bg-avviso p-4 text-avviso-ink">
          <p className="flex items-center gap-2 font-semibold">
            <WarningIcon weight="fill" className="size-5" aria-hidden /> Qualcuno potrebbe averlo già segnalato
          </p>
          <p className="text-sm">
            Ci sono segnalazioni simili nelle vicinanze. Se descrivono lo stesso problema, sostieni quella esistente: una
            segnalazione doppia divide i sostegni.
          </p>
          <ul className="grid gap-2">
            {simili.map((s) => (
              <li key={s.codice}>
                <Link href={`/segnalazioni/${s.codice}`} target="_blank" className="flex items-center gap-3 rounded-md bg-white/70 p-2 text-sm hover:bg-white">
                  {s.miniatura && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.miniatura} alt="" className="size-12 rounded object-cover" />
                  )}
                  <span className="grid">
                    <span className="font-medium">{s.titolo}</span>
                    <span className="text-xs">
                      a {s.distanza} m · {s.sostegni} sostegni · si apre in una nuova scheda
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      <dl className="grid gap-x-6 gap-y-3 rounded-xl border bg-card p-5 text-sm shadow-card sm:grid-cols-[10rem_1fr]">
        <dt className="text-muted-foreground">Tipo</dt>
        <dd>{tipo === "proposta" ? "Proposta" : "Problema"}</dd>
        <dt className="text-muted-foreground">Titolo</dt>
        <dd className="font-medium">{titolo}</dd>
        <dt className="text-muted-foreground">Descrizione</dt>
        <dd className="whitespace-pre-line">{descrizione}</dd>
        <dt className="text-muted-foreground">Dove</dt>
        <dd>
          {indirizzo && <>{indirizzo} · </>}
          {info ? `${info.quartiere}, ${info.municipio}` : "—"}
        </dd>
        <dt className="text-muted-foreground">Categorie</dt>
        <dd>{categorie.map((k) => k.nome).join(", ")}</dd>
        <dt className="text-muted-foreground">Foto</dt>
        <dd className="flex flex-wrap gap-2">
          {foto.map((f, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={f.id} src={f.anteprima} alt={`Foto ${i + 1}`} className="size-16 rounded object-cover" />
          ))}
        </dd>
      </dl>
      <p className="text-sm text-muted-foreground">
        Dopo l&apos;invio un moderatore del comitato controlla la segnalazione prima di pubblicarla. Riceverai una notifica quando sarà pubblicata.
      </p>
    </div>
  );
}
