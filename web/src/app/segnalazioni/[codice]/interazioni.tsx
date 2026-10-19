"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { BellRingingIcon, BellSlashIcon, FlagIcon, HeartBreakIcon, HeartIcon, ShareNetworkIcon, SpinnerGapIcon, TrashIcon } from "@phosphor-icons/react";
import {
  aggiungiAggiornamento,
  commenta,
  integraSegnalazione,
  ritiraSegnalazione,
  ritiraSostegno,
  segnalaAbuso,
  seguiSegnalazione,
  sostieni,
} from "./azioni";
import { Campo, CampoSelect, CampoTesto, MessaggioEsito, PulsanteInvio, useFormAzione } from "@/components/form";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Risposta = { ok: boolean; errore?: string; messaggio?: string };

function useAzioneRapida() {
  const [inCorso, avvia] = useTransition();
  const esegui = (fn: () => Promise<Risposta>) =>
    avvia(async () => {
      const r = await fn();
      if (r.ok) toast.success(r.messaggio ?? "Operazione completata.");
      else toast.error(r.errore ?? "Operazione non riuscita. Riprova.");
    });
  return { inCorso, esegui };
}

export function AzioniSostegno({
  codice,
  accesso,
  autore,
  votabile,
  sostiene,
  segue,
}: {
  codice: string;
  accesso: boolean;
  autore: boolean;
  votabile: boolean;
  sostiene: boolean;
  segue: boolean;
}) {
  const { inCorso, esegui } = useAzioneRapida();
  if (!accesso)
    return votabile ? (
      // il testo è lungo per la colonna laterale: va a capo invece di uscire dal pulsante
      <Link
        href={`/accedi?da=/segnalazioni/${codice}`}
        className={cn(buttonVariants({ size: "lg" }), "h-auto min-h-12 w-full py-2.5 text-center leading-snug text-balance whitespace-normal")}
      >
        <HeartIcon weight="bold" aria-hidden />
        Accedi per sostenere la segnalazione
      </Link>
    ) : null;
  return (
    <div className="grid gap-2">
      {votabile && !autore && (
        <Button
          size="lg"
          className="w-full"
          variant={sostiene ? "outline" : "default"}
          disabled={inCorso}
          aria-pressed={sostiene}
          onClick={() => esegui(() => (sostiene ? ritiraSostegno(codice) : sostieni(codice)))}
        >
          {inCorso ? (
            <SpinnerGapIcon className="animate-spin" aria-hidden />
          ) : sostiene ? (
            <HeartBreakIcon aria-hidden />
          ) : (
            <HeartIcon weight="fill" aria-hidden />
          )}
          {sostiene ? "Ritira il sostegno" : "Sostieni"}
        </Button>
      )}
      {autore && votabile && <p className="text-sm text-muted-foreground">Non puoi sostenere una tua segnalazione.</p>}
      <Button variant="outline" className="w-full" disabled={inCorso} aria-pressed={segue} onClick={() => esegui(() => seguiSegnalazione(codice, !segue))}>
        {segue ? <BellSlashIcon aria-hidden /> : <BellRingingIcon aria-hidden />}
        {segue ? "Smetti di seguire" : "Segui gli aggiornamenti"}
      </Button>
    </div>
  );
}

export function Condividi({ titolo }: { titolo: string }) {
  return (
    <Button
      variant="ghost"
      className="w-full"
      onClick={async () => {
        const url = window.location.href.split("?")[0];
        if (typeof navigator.share === "function") {
          await navigator.share({ title: titolo, url }).catch(() => {});
        } else {
          await navigator.clipboard.writeText(url);
          toast.success("Link copiato");
        }
      }}
    >
      <ShareNetworkIcon aria-hidden />
      Condividi
    </Button>
  );
}

const MOTIVI = [
  ["offensivo", "Linguaggio offensivo"],
  ["odio_discriminazione", "Odio o discriminazione"],
  ["spam", "Spam o pubblicità"],
  ["falso", "Informazione falsa"],
  ["fuori_tema", "Fuori tema"],
  ["dati_personali", "Contiene dati personali"],
  ["altro", "Altro"],
] as const;

export function SegnalaAbuso({
  codice,
  oggetto,
  idOggetto,
  piccolo,
}: {
  codice: string;
  oggetto: "segnalazione" | "commento" | "aggiornamento";
  idOggetto: number;
  piccolo?: boolean;
}) {
  const [aperto, setAperto] = useState(false);
  const { esito, onSubmit, inAttesa } = useFormAzione(segnalaAbuso, (r) => {
    if (r.ok) {
      toast.success(r.messaggio ?? "Segnalazione inviata");
      setAperto(false);
    }
  });
  return (
    <Dialog open={aperto} onOpenChange={setAperto}>
      <DialogTrigger
        className={
          piccolo
            ? "grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            : cn(buttonVariants({ variant: "ghost", size: "sm" }), "w-full justify-start text-muted-foreground")
        }
        aria-label={piccolo ? "Segnala questo commento ai moderatori" : undefined}
      >
        <FlagIcon className="size-4" aria-hidden />
        {!piccolo && "Segnala un abuso"}
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>Segnala ai moderatori</DialogTitle>
            <DialogDescription>
              Dopo tre segnalazioni da persone diverse il contenuto viene nascosto finché un moderatore non lo controlla.
            </DialogDescription>
          </DialogHeader>
          <input type="hidden" name="codice" value={codice} />
          <input type="hidden" name="oggetto" value={oggetto} />
          <input type="hidden" name="idOggetto" value={idOggetto} />
          <MessaggioEsito esito={esito?.ok ? null : esito} />
          <CampoSelect nome="motivo" etichetta="Motivo" defaultValue="" esito={esito}>
            <option value="" disabled>
              Scegli…
            </option>
            {MOTIVI.map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </CampoSelect>
          <CampoTesto nome="nota" etichetta="Nota (facoltativa)" maxLength={500} rows={3} esito={esito} />
          <DialogFooter>
            <PulsanteInvio inAttesa={inAttesa}>Invia ai moderatori</PulsanteInvio>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FormTesto({
  codice,
  azione,
  etichetta,
  pulsante,
}: {
  codice: string;
  azione: typeof commenta;
  etichetta: string;
  pulsante: string;
}) {
  const [chiave, setChiave] = useState(0);
  // dopo un invio riuscito svuoto il campo ricreandolo
  const { esito, onSubmit, inAttesa } = useFormAzione(azione, (r) => r.ok && setChiave((k) => k + 1));
  return (
    <form onSubmit={onSubmit} className="grid gap-3" noValidate>
      <input type="hidden" name="codice" value={codice} />
      <MessaggioEsito esito={esito} />
      <CampoTesto key={chiave} nome="testo" etichetta={etichetta} maxLength={1000} rows={3} required esito={esito} />
      <PulsanteInvio inAttesa={inAttesa} className="justify-self-start">
        {pulsante}
      </PulsanteInvio>
    </form>
  );
}

export const FormCommento = ({ codice }: { codice: string }) => (
  <FormTesto codice={codice} azione={commenta} etichetta="Il tuo commento" pulsante="Pubblica il commento" />
);

export const FormAggiornamento = ({ codice }: { codice: string }) => (
  <FormTesto codice={codice} azione={aggiungiAggiornamento} etichetta="Aggiornamento per chi segue la segnalazione" pulsante="Pubblica l'aggiornamento" />
);

export function FormIntegrazione({ codice, titolo, descrizione }: { codice: string; titolo: string; descrizione: string }) {
  const { esito, onSubmit, inAttesa } = useFormAzione(integraSegnalazione);
  return (
    <form onSubmit={onSubmit} className="grid gap-3" noValidate>
      <input type="hidden" name="codice" value={codice} />
      <MessaggioEsito esito={esito} />
      <Campo nome="titolo" etichetta="Titolo" defaultValue={titolo} maxLength={100} esito={esito} />
      <CampoTesto nome="descrizione" etichetta="Descrizione" defaultValue={descrizione} maxLength={2000} rows={5} esito={esito} />
      <PulsanteInvio inAttesa={inAttesa} className="justify-self-start">
        Invia l&apos;integrazione
      </PulsanteInvio>
    </form>
  );
}

export function PulsanteRitira({ codice }: { codice: string }) {
  const { inCorso, esegui } = useAzioneRapida();
  return (
    <Dialog>
      <DialogTrigger className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "w-full justify-start text-destructive hover:text-destructive")}>
        <TrashIcon aria-hidden />
        Ritira la segnalazione
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ritirare la segnalazione?</DialogTitle>
          <DialogDescription>Non sarà più visibile né votabile. L&apos;operazione non si può annullare.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="destructive" disabled={inCorso} onClick={() => esegui(() => ritiraSegnalazione(codice))}>
            Sì, ritirala
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
