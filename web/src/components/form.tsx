"use client";

import { startTransition, useActionState, useId, useState, type ComponentProps, type FormEvent, type ReactNode } from "react";
import { CheckCircleIcon, SpinnerGapIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type EsitoForm = { ok: boolean; errore?: string; messaggio?: string; campi?: Record<string, string> } | null;

interface CampoProps {
  nome: string;
  etichetta: string;
  esito?: EsitoForm;
  aiuto?: ReactNode;
  className?: string;
}

/** Etichetta, controllo, suggerimento ed errore collegati con aria-describedby (RNF-25). */
function Contenitore({
  nome,
  etichetta,
  esito,
  aiuto,
  className,
  children,
}: CampoProps & { children: (attr: { id: string; "aria-describedby"?: string; "aria-invalid"?: boolean }) => ReactNode }) {
  const id = useId();
  const errore = esito?.campi?.[nome];
  const descrizione = [aiuto ? `${id}-aiuto` : null, errore ? `${id}-errore` : null].filter(Boolean).join(" ");
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={id}>{etichetta}</Label>
      {children({ id, "aria-describedby": descrizione || undefined, "aria-invalid": errore ? true : undefined })}
      {aiuto && (
        <p id={`${id}-aiuto`} className="text-xs text-muted-foreground">
          {aiuto}
        </p>
      )}
      {errore && (
        <p id={`${id}-errore`} className="text-sm text-destructive">
          {errore}
        </p>
      )}
    </div>
  );
}

export function Campo({ nome, etichetta, esito, aiuto, className, ...input }: CampoProps & ComponentProps<"input">) {
  return (
    <Contenitore nome={nome} etichetta={etichetta} esito={esito} aiuto={aiuto} className={className}>
      {(attr) => <Input name={nome} {...attr} {...input} />}
    </Contenitore>
  );
}

export function CampoTesto({ nome, etichetta, esito, aiuto, className, ...area }: CampoProps & ComponentProps<"textarea">) {
  return (
    <Contenitore nome={nome} etichetta={etichetta} esito={esito} aiuto={aiuto} className={className}>
      {(attr) => <Textarea name={nome} {...attr} {...area} />}
    </Contenitore>
  );
}

export type Opzione = readonly [valore: string | number, etichetta: string];

/**
 * Tendina del sito (Select di shadcn su Base UI) al posto di quella del browser.
 * Con `name` manda il valore insieme al form; "" vale come "nessuna scelta" e mostra il segnaposto.
 */
export function Scelta({
  name,
  opzioni,
  defaultValue,
  segnaposto,
  onValueChange,
  size,
  disabled,
  required,
  className,
  ...trigger
}: {
  name?: string;
  opzioni: readonly Opzione[];
  defaultValue?: string | number | null;
  segnaposto?: string;
  onValueChange?: (valore: string) => void;
  size?: "sm" | "default";
  disabled?: boolean;
  required?: boolean;
  className?: string;
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  "aria-label"?: string;
}) {
  const voci = opzioni.map(([v, t]) => ({ value: String(v), label: t }));
  const iniziale = defaultValue == null || defaultValue === "" ? null : String(defaultValue);
  return (
    <Select
      name={name}
      items={voci}
      defaultValue={iniziale}
      onValueChange={(v) => onValueChange?.((v as string | null) ?? "")}
      disabled={disabled}
      required={required}
    >
      <SelectTrigger size={size} className={className} {...trigger}>
        <SelectValue placeholder={segnaposto ?? "Scegli…"} />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false}>
        {voci.map((v) => (
          <SelectItem key={v.value} value={v.value}>
            {v.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function CampoSelect({
  nome,
  etichetta,
  esito,
  aiuto,
  className,
  ...scelta
}: CampoProps & Omit<ComponentProps<typeof Scelta>, "name" | "className">) {
  return (
    <Contenitore nome={nome} etichetta={etichetta} esito={esito} aiuto={aiuto} className={className}>
      {(attr) => <Scelta name={nome} {...attr} {...scelta} />}
    </Contenitore>
  );
}

const MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];

/**
 * Data in tre tendine (giorno, mese, anno) al posto del calendario del browser: per una data di nascita
 * si fa prima che sfogliare i mesi all'indietro. Il form riceve un solo campo nascosto in formato AAAA-MM-GG.
 * I giorni seguono il mese e gli anni bisestili; gli anni partono da `etaMinima` anni fa.
 */
export function CampoData({
  nome,
  etichetta,
  esito,
  aiuto,
  className,
  etaMinima = 0,
  anni = 100,
}: CampoProps & { etaMinima?: number; anni?: number }) {
  const id = useId();
  const errore = esito?.campi?.[nome];
  const [giorno, setGiorno] = useState("");
  const [mese, setMese] = useState("");
  const [anno, setAnno] = useState("");
  const ultimo = new Date().getFullYear() - etaMinima;
  const giorniNelMese = mese ? new Date(Number(anno || 2000), Number(mese), 0).getDate() : 31;
  const valore = giorno && mese && anno && Number(giorno) <= giorniNelMese ? `${anno}-${mese.padStart(2, "0")}-${giorno.padStart(2, "0")}` : "";
  const descrizione = [aiuto ? `${id}-aiuto` : null, errore ? `${id}-errore` : null].filter(Boolean).join(" ") || undefined;
  const comuni = { size: "default" as const, "aria-invalid": errore ? true : undefined, "aria-describedby": descrizione };

  return (
    <fieldset className={cn("grid gap-1.5", className)}>
      <legend className="mb-1.5 text-sm font-medium">{etichetta}</legend>
      <input type="hidden" name={nome} value={valore} />
      <div className="grid grid-cols-[6rem_1fr_6.5rem] gap-2">
        <Scelta
          aria-label="Giorno"
          segnaposto="Giorno"
          opzioni={Array.from({ length: giorniNelMese }, (_, i) => [String(i + 1), String(i + 1)] as const)}
          onValueChange={setGiorno}
          {...comuni}
        />
        <Scelta aria-label="Mese" segnaposto="Mese" opzioni={MESI.map((m, i) => [String(i + 1), m] as const)} onValueChange={setMese} {...comuni} />
        <Scelta
          aria-label="Anno"
          segnaposto="Anno"
          opzioni={Array.from({ length: anni }, (_, i) => [String(ultimo - i), String(ultimo - i)] as const)}
          onValueChange={setAnno}
          {...comuni}
        />
      </div>
      {aiuto && (
        <p id={`${id}-aiuto`} className="text-xs text-muted-foreground">
          {aiuto}
        </p>
      )}
      {errore && (
        <p id={`${id}-errore`} className="text-sm text-destructive">
          {errore}
        </p>
      )}
    </fieldset>
  );
}

export function Casella({
  nome,
  esito,
  children,
  value = "on",
  defaultChecked,
  required,
}: { nome: string; esito?: EsitoForm; children: ReactNode; value?: string; defaultChecked?: boolean; required?: boolean }) {
  const id = useId();
  const errore = esito?.campi?.[nome];
  return (
    <div className="grid gap-1">
      <div className="flex items-start gap-2">
        <Checkbox
          id={id}
          name={nome}
          value={value}
          defaultChecked={defaultChecked}
          required={required}
          className="mt-0.5"
          // Base UI sposta l'id sull'input nascosto: senza questo il controllo che riceve il
          // focus resterebbe senza nome per i lettori di schermo
          aria-labelledby={`${id}-etichetta`}
          aria-invalid={errore ? true : undefined}
          aria-describedby={errore ? `${id}-errore` : undefined}
        />
        <label id={`${id}-etichetta`} htmlFor={id} className="text-sm leading-snug [&_a]:font-medium [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4">
          {children}
        </label>
      </div>
      {errore && (
        <p id={`${id}-errore`} className="pl-7 text-sm text-destructive">
          {errore}
        </p>
      )}
    </div>
  );
}

export function MessaggioEsito({ esito }: { esito: EsitoForm }) {
  if (!esito) return null;
  if (!esito.ok && esito.errore)
    return (
      <p role="alert" className="flex items-start gap-2 bg-negativo p-3 text-sm text-negativo-ink">
        <WarningCircleIcon weight="bold" className="mt-0.5 size-4 shrink-0" aria-hidden />
        {esito.errore}
      </p>
    );
  if (esito.ok && esito.messaggio)
    return (
      <p role="status" className="flex items-start gap-2 bg-tinta-50 p-3 text-sm text-tinta-ink">
        <CheckCircleIcon weight="bold" className="mt-0.5 size-4 shrink-0" aria-hidden />
        {esito.messaggio}
      </p>
    );
  return null;
}

/**
 * Come useActionState, ma invia il form senza svuotarlo: React 19 resetta i form con action,
 * e dopo un errore di validazione l'utente perderebbe quello che ha scritto.
 */
export function useFormAzione<E extends EsitoForm>(
  azione: (prec: E | null, fd: FormData) => Promise<E>,
  dopo?: (esito: E) => void,
) {
  const [esito, esegui, inAttesa] = useActionState(async (prec: E | null, fd: FormData) => {
    const r = await azione(prec, fd);
    dopo?.(r);
    return r;
  }, null);
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => esegui(fd));
  };
  return { esito, onSubmit, inAttesa };
}

export function PulsanteInvio({
  children,
  className,
  inAttesa: pending = false,
  ...props
}: ComponentProps<typeof Button> & { inAttesa?: boolean }) {
  return (
    <Button type="submit" disabled={pending} aria-busy={pending} className={className} {...props}>
      {pending && <SpinnerGapIcon weight="bold" className="size-4 animate-spin" aria-hidden />}
      {children}
    </Button>
  );
}
