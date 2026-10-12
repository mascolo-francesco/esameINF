"use client";

import { startTransition, useActionState, useId, type ComponentProps, type FormEvent, type ReactNode } from "react";
import { CircleAlert, CircleCheck, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

export const classeSelect =
  "h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive";

export function CampoSelect({
  nome,
  etichetta,
  esito,
  aiuto,
  className,
  children,
  ...select
}: CampoProps & ComponentProps<"select">) {
  return (
    <Contenitore nome={nome} etichetta={etichetta} esito={esito} aiuto={aiuto} className={className}>
      {(attr) => (
        <select name={nome} className={classeSelect} {...attr} {...select}>
          {children}
        </select>
      )}
    </Contenitore>
  );
}

export function Casella({
  nome,
  esito,
  children,
  ...input
}: { nome: string; esito?: EsitoForm; children: ReactNode } & ComponentProps<"input">) {
  const id = useId();
  const errore = esito?.campi?.[nome];
  return (
    <div className="grid gap-1">
      <div className="flex items-start gap-2">
        <input
          id={id}
          type="checkbox"
          name={nome}
          className="mt-0.5 size-4 shrink-0 accent-primary"
          aria-invalid={errore ? true : undefined}
          aria-describedby={errore ? `${id}-errore` : undefined}
          {...input}
        />
        <label htmlFor={id} className="text-sm leading-snug">
          {children}
        </label>
      </div>
      {errore && (
        <p id={`${id}-errore`} className="pl-6 text-sm text-destructive">
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
      <p role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
        <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
        {esito.errore}
      </p>
    );
  if (esito.ok && esito.messaggio)
    return (
      <p role="status" className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm text-primary">
        <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
        {esito.messaggio}
      </p>
    );
  return null;
}

/**
 * Come useActionState, ma invia il form senza svuotarlo: React 19 resetta i form con action,
 * e dopo un errore di validazione l'utente perderebbe quello che ha scritto.
 */
export function useFormAzione<E extends EsitoForm>(azione: (prec: E | null, fd: FormData) => Promise<E>) {
  const [esito, esegui, inAttesa] = useActionState(azione, null);
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
    <Button type="submit" disabled={pending} aria-busy={pending} className={cn("h-9", className)} {...props}>
      {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
      {children}
    </Button>
  );
}
