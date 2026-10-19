"use client";

import { startTransition, useActionState, useId, type ComponentProps, type FormEvent, type ReactNode } from "react";
import { CheckCircleIcon, SpinnerGapIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
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

export function CampoSelect({
  nome,
  etichetta,
  esito,
  aiuto,
  className,
  children,
  ...select
}: CampoProps & Omit<ComponentProps<"select">, "size">) {
  return (
    <Contenitore nome={nome} etichetta={etichetta} esito={esito} aiuto={aiuto} className={className}>
      {(attr) => (
        <NativeSelect name={nome} {...attr} {...select}>
          {children}
        </NativeSelect>
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
          className="mt-0.5 size-5 shrink-0 accent-primary"
          aria-invalid={errore ? true : undefined}
          aria-describedby={errore ? `${id}-errore` : undefined}
          {...input}
        />
        <label htmlFor={id} className="text-sm leading-snug [&_a]:font-medium [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4">
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
        <WarningCircleIcon weight="fill" className="mt-0.5 size-4 shrink-0" aria-hidden />
        {esito.errore}
      </p>
    );
  if (esito.ok && esito.messaggio)
    return (
      <p role="status" className="flex items-start gap-2 bg-tinta-50 p-3 text-sm text-tinta-ink">
        <CheckCircleIcon weight="fill" className="mt-0.5 size-4 shrink-0" aria-hidden />
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
      {pending && <SpinnerGapIcon className="size-4 animate-spin" aria-hidden />}
      {children}
    </Button>
  );
}
