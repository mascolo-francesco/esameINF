"use client";

import { useState } from "react";
import { toast } from "sonner";
import { cambiaRuolo, creaDocumento, includiSegnalazione, salvaCandidato, salvaCategoria, salvaParametro } from "./azioni";
import { Campo, CampoTesto, Casella, MessaggioEsito, PulsanteInvio, useFormAzione, type EsitoForm } from "@/components/form";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";

const avvisa = (r: EsitoForm) => {
  if (r?.ok) toast.success(r.messaggio ?? "Fatto");
};

export function FormRuolo({ idUtente, idRuolo }: { idUtente: number; idRuolo: number }) {
  const { esito, onSubmit, inAttesa } = useFormAzione(cambiaRuolo, avvisa);
  return (
    <form onSubmit={onSubmit} className="grid gap-1">
      <div className="flex items-center gap-2">
        <input type="hidden" name="idUtente" value={idUtente} />
        <label className="sr-only" htmlFor={`ruolo-${idUtente}`}>
          Ruolo
        </label>
        <NativeSelect id={`ruolo-${idUtente}`} name="idRuolo" defaultValue={idRuolo} size="sm" className="w-44">
          <option value={1}>Cittadino</option>
          <option value={2}>Moderatore</option>
          <option value={3}>Amministratore</option>
        </NativeSelect>
        <PulsanteInvio inAttesa={inAttesa} size="sm" variant="outline">
          Salva
        </PulsanteInvio>
      </div>
      {esito && !esito.ok && <p className="text-xs text-destructive">{esito.errore}</p>}
    </form>
  );
}

interface Categoria {
  id: number;
  nome: string;
  descrizione: string;
  colore: string;
  ordine: number;
  attiva: boolean;
}

export function FormCategoria({ categoria }: { categoria?: Categoria }) {
  const [aperto, setAperto] = useState(!categoria);
  const { esito, onSubmit, inAttesa } = useFormAzione(salvaCategoria, (r) => {
    avvisa(r);
    if (r.ok && categoria) setAperto(false);
  });
  if (!aperto)
    return (
      <button type="button" className="text-sm font-medium text-primary underline-offset-4 hover:underline" onClick={() => setAperto(true)}>
        Modifica
      </button>
    );
  return (
    <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2" noValidate>
      {categoria && <input type="hidden" name="id" value={categoria.id} />}
      <MessaggioEsito esito={esito?.ok ? null : esito} />
      <Campo nome="nome" etichetta="Nome" defaultValue={categoria?.nome} esito={esito} className="sm:col-span-2" />
      <Campo nome="descrizione" etichetta="Descrizione" defaultValue={categoria?.descrizione} esito={esito} className="sm:col-span-2" />
      <Campo nome="colore" etichetta="Colore sulla mappa" type="color" defaultValue={categoria?.colore ?? "#64748B"} esito={esito} className="[&_input]:w-20" />
      <Campo nome="ordine" etichetta="Ordine" type="number" min={0} max={255} defaultValue={categoria?.ordine ?? 50} esito={esito} />
      <Casella nome="attiva" defaultChecked={categoria?.attiva ?? true}>
        Attiva (si può scegliere nelle nuove segnalazioni)
      </Casella>
      <PulsanteInvio inAttesa={inAttesa} className="justify-self-start sm:col-span-2">
        {categoria ? "Salva" : "Crea la categoria"}
      </PulsanteInvio>
    </form>
  );
}

export function FormParametro({ chiave, valore, min, max }: { chiave: string; valore: number; min: number; max: number }) {
  const { esito, onSubmit, inAttesa } = useFormAzione(salvaParametro, avvisa);
  return (
    <form onSubmit={onSubmit} className="grid gap-1">
      <div className="flex items-center gap-2">
        <input type="hidden" name="chiave" value={chiave} />
        <label className="sr-only" htmlFor={`p-${chiave}`}>
          Valore di {chiave}
        </label>
        <Input id={`p-${chiave}`} name="valore" type="number" step="any" min={min} max={max} defaultValue={valore} className="w-28" />
        <PulsanteInvio inAttesa={inAttesa} size="sm" variant="outline">
          Salva
        </PulsanteInvio>
      </div>
      {esito && !esito.ok && <p className="text-xs text-destructive">{esito.errore}</p>}
    </form>
  );
}

export function FormDocumento() {
  const { esito, onSubmit, inAttesa } = useFormAzione(creaDocumento);
  return (
    <form onSubmit={onSubmit} className="grid gap-3" noValidate>
      <MessaggioEsito esito={esito} />
      <Campo nome="titolo" etichetta="Titolo" defaultValue="Le priorità dei cittadini di Milano" esito={esito} />
      <CampoTesto nome="introduzione" etichetta="Introduzione (facoltativa)" rows={4} esito={esito} />
      <PulsanteInvio inAttesa={inAttesa} className="justify-self-start">
        Crea la bozza
      </PulsanteInvio>
    </form>
  );
}

export function FormIncludi({ idDocumento, idSegnalazione }: { idDocumento: number; idSegnalazione: number }) {
  const { esito, onSubmit, inAttesa } = useFormAzione(includiSegnalazione, avvisa);
  return (
    <form onSubmit={onSubmit} className="grid gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="idDocumento" value={idDocumento} />
        <input type="hidden" name="idSegnalazione" value={idSegnalazione} />
        <label className="sr-only" htmlFor={`nota-${idSegnalazione}`}>
          Nota del comitato
        </label>
        <Input id={`nota-${idSegnalazione}`} name="nota" placeholder="Nota del comitato (facoltativa)" className="min-w-48 flex-1" />
        <PulsanteInvio inAttesa={inAttesa} size="sm">
          Includi
        </PulsanteInvio>
      </div>
      {esito && !esito.ok && <p className="text-xs text-destructive">{esito.errore}</p>}
    </form>
  );
}

export function FormCandidato() {
  const { esito, onSubmit, inAttesa } = useFormAzione(salvaCandidato, avvisa);
  return (
    <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2" noValidate>
      <MessaggioEsito esito={esito?.ok ? null : esito} />
      <Campo nome="nome" etichetta="Nome" esito={esito} />
      <Campo nome="cognome" etichetta="Cognome" esito={esito} />
      <Campo nome="lista" etichetta="Lista o coalizione" esito={esito} />
      <Campo nome="email" etichetta="Email di contatto" type="email" esito={esito} />
      <PulsanteInvio inAttesa={inAttesa} variant="outline" className="justify-self-start">
        Aggiungi il candidato
      </PulsanteInvio>
    </form>
  );
}
