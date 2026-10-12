"use client";

import { useRef, useState, useTransition } from "react";
import { Marker, type Map as MappaLibre } from "maplibre-gl";
import { toast } from "sonner";
import { chiudiAbusiSegnalazione, correggiCategorie, correggiPosizione, decidi, sanziona, unisci } from "../azioni";
import { Campo, CampoSelect, CampoTesto, MessaggioEsito, PulsanteInvio, useFormAzione } from "@/components/form";
import { MappaBase } from "@/components/mappa/mappa-base";
import { Button } from "@/components/ui/button";

type Decisione = "pubblica" | "integra" | "rifiuta" | "presa" | "riesame" | "riattiva";

// quali decisioni offrire in ogni stato (tabella 4.2 e transizioni ammesse)
const PER_STATO: Record<string, { d: Decisione; testo: string; motivazione: boolean; variante?: "destructive" | "outline" }[]> = {
  IN_REVISIONE: [
    { d: "pubblica", testo: "Approva e pubblica", motivazione: false },
    { d: "integra", testo: "Chiedi un'integrazione", motivazione: true, variante: "outline" },
    { d: "rifiuta", testo: "Rifiuta", motivazione: true, variante: "destructive" },
  ],
  PUBBLICATA: [{ d: "presa", testo: "Prendi in carico per il documento", motivazione: false, variante: "outline" }],
  RIFIUTATA: [{ d: "riesame", testo: "Riapri per un nuovo esame", motivazione: true, variante: "outline" }],
  ARCHIVIATA: [{ d: "riattiva", testo: "Riattiva", motivazione: false, variante: "outline" }],
};

export function PannelloDecisioni({
  codice,
  stato,
  abusiAperti,
  senzaCategorie,
}: {
  codice: string;
  stato: string;
  abusiAperti: number;
  senzaCategorie: boolean;
}) {
  const [scelta, setScelta] = useState<Decisione | null>(null);
  const { esito, onSubmit, inAttesa } = useFormAzione(decidi, (r) => {
    if (r.ok) {
      toast.success(r.messaggio ?? "Fatto");
      setScelta(null);
    }
  });
  const [inChiusura, avvia] = useTransition();
  const opzioni = PER_STATO[stato] ?? [];
  const corrente = opzioni.find((o) => o.d === scelta);

  return (
    <div className="grid gap-3">
      <MessaggioEsito esito={esito?.ok ? null : esito} />
      {opzioni.length === 0 && <p className="text-sm text-muted-foreground">In questo stato non ci sono decisioni da prendere.</p>}
      {stato === "IN_REVISIONE" && senzaCategorie && (
        <p className="text-xs text-amber-800">Prima di pubblicare conferma almeno una categoria qui sotto.</p>
      )}
      {!corrente &&
        opzioni.map((o) =>
          o.motivazione ? (
            <Button key={o.d} variant={o.variante ?? "default"} className="h-9" onClick={() => setScelta(o.d)}>
              {o.testo}…
            </Button>
          ) : (
            <form key={o.d} onSubmit={onSubmit}>
              <input type="hidden" name="codice" value={codice} />
              <input type="hidden" name="decisione" value={o.d} />
              <PulsanteInvio inAttesa={inAttesa} variant={o.variante ?? "default"} className="w-full">
                {o.testo}
              </PulsanteInvio>
            </form>
          ),
        )}
      {corrente && (
        <form onSubmit={onSubmit} className="grid gap-3" noValidate>
          <input type="hidden" name="codice" value={codice} />
          <input type="hidden" name="decisione" value={corrente.d} />
          <CampoTesto
            nome="motivazione"
            etichetta={corrente.d === "integra" ? "Cosa deve aggiungere l'autore?" : "Motivazione (la vedrà l'autore)"}
            rows={3}
            maxLength={1000}
            autoFocus
            esito={esito}
          />
          <div className="flex gap-2">
            <PulsanteInvio inAttesa={inAttesa} variant={corrente.variante === "destructive" ? "destructive" : "default"}>
              {corrente.testo}
            </PulsanteInvio>
            <Button type="button" variant="ghost" className="h-9" onClick={() => setScelta(null)}>
              Annulla
            </Button>
          </div>
        </form>
      )}
      {abusiAperti > 0 && stato !== "IN_REVISIONE" && (
        <div className="grid gap-2 border-t pt-3">
          <p className="text-sm">
            {abusiAperti} segnalazioni di abuso aperte. Se il contenuto va bene, respingile; se no, accoglile e poi decidi.
          </p>
          <div className="flex gap-2">
            {(["respinta", "accolta"] as const).map((e) => (
              <Button
                key={e}
                size="sm"
                variant="outline"
                disabled={inChiusura}
                onClick={() =>
                  avvia(async () => {
                    const r = await chiudiAbusiSegnalazione(codice, e);
                    if (r.ok) toast.success(r.messaggio ?? "Fatto");
                    else toast.error(r.errore);
                  })
                }
              >
                {e === "respinta" ? "Respingi" : "Accogli"}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function FormCategorie({
  codice,
  categorie,
  scelte,
}: {
  codice: string;
  categorie: { id: number; nome: string; colore: string }[];
  scelte: number[];
}) {
  const { esito, onSubmit, inAttesa } = useFormAzione(correggiCategorie, (r) => r.ok && toast.success(r.messaggio ?? "Fatto"));
  return (
    <form onSubmit={onSubmit} className="grid gap-3" noValidate>
      <input type="hidden" name="codice" value={codice} />
      <MessaggioEsito esito={esito?.ok ? null : esito} />
      <fieldset className="grid gap-1.5">
        <legend className="sr-only">Categorie confermate</legend>
        {categorie.map((k) => (
          <label key={k.id} className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="categorie" value={k.id} defaultChecked={scelte.includes(k.id)} className="size-4 accent-primary" />
            <span className="size-2.5 rounded-full" style={{ background: k.colore }} aria-hidden />
            {k.nome}
          </label>
        ))}
      </fieldset>
      <PulsanteInvio inAttesa={inAttesa} variant="outline" className="justify-self-start">
        Salva le categorie
      </PulsanteInvio>
    </form>
  );
}

export function FormUnisci({ codice }: { codice: string }) {
  const { esito, onSubmit, inAttesa } = useFormAzione(unisci, (r) => r.ok && toast.success(r.messaggio ?? "Fatto"));
  return (
    <form onSubmit={onSubmit} className="grid gap-3" noValidate>
      <input type="hidden" name="codice" value={codice} />
      <MessaggioEsito esito={esito?.ok ? null : esito} />
      <Campo
        nome="principale"
        etichetta="Codice della segnalazione principale"
        placeholder="MI-2026-000001"
        aiuto="Questa diventa Unita: sostegni e follower passano alla principale."
        esito={esito}
      />
      <PulsanteInvio inAttesa={inAttesa} variant="outline" className="justify-self-start">
        Unisci
      </PulsanteInvio>
    </form>
  );
}

export function FormSanzione({ idUtente, nome }: { idUtente: number; nome: string }) {
  const [aperto, setAperto] = useState(false);
  const { esito, onSubmit, inAttesa } = useFormAzione(sanziona, (r) => {
    if (r.ok) {
      toast.success(r.messaggio ?? "Fatto");
      setAperto(false);
    }
  });
  if (!aperto)
    return (
      <Button variant="outline" size="sm" className="justify-self-start" onClick={() => setAperto(true)}>
        Sospendi o banna {nome}…
      </Button>
    );
  return (
    <form onSubmit={onSubmit} className="grid gap-3" noValidate>
      <input type="hidden" name="idUtente" value={idUtente} />
      <MessaggioEsito esito={esito?.ok ? null : esito} />
      <CampoSelect nome="tipo" etichetta="Provvedimento" defaultValue="sospensione" esito={esito}>
        <option value="sospensione">Sospensione temporanea</option>
        <option value="ban">Ban permanente</option>
      </CampoSelect>
      <Campo nome="giorni" etichetta="Durata della sospensione (giorni)" type="number" min={1} max={365} defaultValue={7} esito={esito} />
      <CampoTesto nome="motivazione" etichetta="Motivazione" rows={3} esito={esito} />
      <div className="flex gap-2">
        <PulsanteInvio inAttesa={inAttesa} variant="destructive">
          Conferma
        </PulsanteInvio>
        <Button type="button" variant="ghost" className="h-9" onClick={() => setAperto(false)}>
          Annulla
        </Button>
      </div>
    </form>
  );
}

export function CorreggiPosizione({ codice, lat, lon, modificabile }: { codice: string; lat: number; lon: number; modificabile: boolean }) {
  const [nuova, setNuova] = useState<{ lat: number; lon: number } | null>(null);
  const [inCorso, avvia] = useTransition();
  const marker = useRef<Marker | null>(null);

  return (
    <div className="grid gap-3">
      <MappaBase
        etichetta="Posizione della segnalazione"
        className="h-64"
        opzioni={{ center: [lon, lat], zoom: 16 }}
        onPronta={(m: MappaLibre) => {
          marker.current = new Marker({ draggable: modificabile, color: "#1f6f5c" }).setLngLat([lon, lat]).addTo(m);
          marker.current.on("dragend", () => {
            const p = marker.current!.getLngLat();
            setNuova({ lat: Number(p.lat.toFixed(6)), lon: Number(p.lng.toFixed(6)) });
          });
        }}
      />
      {modificabile && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {nuova ? (
            <>
              <Button
                size="sm"
                disabled={inCorso}
                onClick={() =>
                  avvia(async () => {
                    const r = await correggiPosizione(codice, nuova.lat, nuova.lon);
                    if (r.ok) {
                      toast.success(r.messaggio ?? "Fatto");
                      setNuova(null);
                    } else toast.error(r.errore);
                  })
                }
              >
                Salva la nuova posizione
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  marker.current?.setLngLat([lon, lat]);
                  setNuova(null);
                }}
              >
                Annulla
              </Button>
            </>
          ) : (
            <span className="text-muted-foreground">Trascina il segnaposto per correggere la posizione; il quartiere si ricalcola.</span>
          )}
        </div>
      )}
    </div>
  );
}
