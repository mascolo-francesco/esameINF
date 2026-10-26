"use client";

import { useState, useTransition } from "react";
import { aggiornaProfilo, confermaTotp, disattivaTotp, eliminaAccount, preparaTotp, type DatiNuovoTotp } from "@/app/azioni/profilo";
import { Campo, CampoSelect, Casella, MessaggioEsito, PulsanteInvio, useFormAzione } from "@/components/form";
import { Button } from "@/components/ui/button";

interface Valori {
  nomeVisualizzato: string;
  mostraNomeReale: boolean;
  idQuartiere: number | null;
  consensoNotifiche: boolean;
  consensoIa: boolean;
}

export function FormProfilo({ quartieri, valori }: { quartieri: { id: number; nome: string }[]; valori: Valori }) {
  const { esito, onSubmit, inAttesa } = useFormAzione(aggiornaProfilo);
  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <MessaggioEsito esito={esito} />
      <Campo nome="nomeVisualizzato" etichetta="Nome visualizzato" defaultValue={valori.nomeVisualizzato} required esito={esito} />
      <Casella nome="mostraNomeReale" defaultChecked={valori.mostraNomeReale}>
        Mostra il mio nome e cognome al posto del nome visualizzato
      </Casella>
      <CampoSelect
        nome="idQuartiere"
        etichetta="Quartiere"
        defaultValue={valori.idQuartiere ?? ""}
        esito={esito}
        segnaposto="Scegli il quartiere…"
        opzioni={quartieri.map((q) => [q.id, q.nome] as const)}
      />
      <Casella nome="consensoNotifiche" defaultChecked={valori.consensoNotifiche}>
        Voglio ricevere notifiche sulle segnalazioni che seguo
      </Casella>
      <Casella nome="consensoIa" defaultChecked={valori.consensoIa}>
        Acconsento all&apos;uso anonimo delle mie segnalazioni per migliorare la classificazione automatica
      </Casella>
      <PulsanteInvio inAttesa={inAttesa} className="justify-self-start">
        Salva le modifiche
      </PulsanteInvio>
    </form>
  );
}

export function SezioneTotp({ attiva, staff }: { attiva: boolean; staff: boolean }) {
  const [nuovo, setNuovo] = useState<DatiNuovoTotp | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [inPreparazione, avvia] = useTransition();
  const conferma = useFormAzione(confermaTotp);
  const disattiva = useFormAzione(disattivaTotp);

  if (attiva) {
    if (staff) return <p className="text-sm">La verifica in due passaggi è attiva. Per il tuo ruolo è obbligatoria e non si può disattivare.</p>;
    return (
      <form onSubmit={disattiva.onSubmit} className="grid gap-3" noValidate>
        <MessaggioEsito esito={disattiva.esito} />
        <p className="text-sm">La verifica in due passaggi è attiva.</p>
        <Campo nome="password" etichetta="Password attuale" type="password" autoComplete="current-password" className="max-w-xs" />
        <PulsanteInvio inAttesa={disattiva.inAttesa} variant="outline" className="justify-self-start">
          Disattiva la verifica
        </PulsanteInvio>
      </form>
    );
  }

  if (conferma.esito?.ok) return <MessaggioEsito esito={conferma.esito} />;

  if (!nuovo)
    return (
      <div className="grid gap-3">
        {errore && <MessaggioEsito esito={{ ok: false, errore }} />}
        <Button
          className="justify-self-start"
          disabled={inPreparazione}
          onClick={() =>
            avvia(async () => {
              const r = await preparaTotp();
              if (r.ok && r.dati) setNuovo(r.dati);
              else if (!r.ok) setErrore(r.errore);
            })
          }
        >
          Attiva la verifica in due passaggi
        </Button>
      </div>
    );

  return (
    <form onSubmit={conferma.onSubmit} className="grid gap-4" noValidate>
      <MessaggioEsito esito={conferma.esito} />
      <ol className="grid list-decimal gap-1 pl-5 text-sm">
        <li>Apri un&apos;app di autenticazione (Google Authenticator, Authy, 1Password…).</li>
        <li>Inquadra il codice QR, oppure inserisci a mano il codice qui sotto.</li>
        <li>Scrivi il codice di 6 cifre che compare nell&apos;app.</li>
      </ol>
      <div
        className="size-44 rounded-lg border bg-white p-2 [&_svg]:size-full"
        role="img"
        aria-label="Codice QR per l'app di autenticazione"
        dangerouslySetInnerHTML={{ __html: nuovo.qrSvg }}
      />
      <p className="text-sm">
        Codice manuale: <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs break-all">{nuovo.segreto}</code>
      </p>
      <input type="hidden" name="segretoCifrato" value={nuovo.segretoCifrato} />
      <Campo nome="codice" etichetta="Codice di 6 cifre" inputMode="numeric" autoComplete="one-time-code" maxLength={7} className="max-w-40" esito={conferma.esito} />
      <PulsanteInvio inAttesa={conferma.inAttesa} className="justify-self-start">
        Conferma e attiva
      </PulsanteInvio>
    </form>
  );
}

export function SezioneEliminaAccount() {
  const { esito, onSubmit, inAttesa } = useFormAzione(eliminaAccount);
  return (
    <form onSubmit={onSubmit} className="grid gap-3" noValidate>
      <MessaggioEsito esito={esito} />
      <Campo nome="password" etichetta="Password" type="password" autoComplete="current-password" className="max-w-xs" />
      <Casella nome="conferma">Ho compreso che l&apos;operazione non si può annullare</Casella>
      <PulsanteInvio inAttesa={inAttesa} variant="destructive" className="justify-self-start">
        Elimina l&apos;account
      </PulsanteInvio>
    </form>
  );
}
