import type { Metadata } from "next";
import type { ReactNode } from "react";
import {
  BellRingingIcon,
  CameraIcon,
  CheckCircleIcon,
  HeartIcon,
  HouseIcon,
  MagnifyingGlassIcon,
  MapPinIcon,
  MegaphoneIcon,
  PaperPlaneTiltIcon,
  ShieldCheckIcon,
  TrashIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react/ssr";
import { Pagina } from "@/components/pagina";
import { SchedaSegnalazione } from "@/components/scheda-segnalazione";
import { BadgeCategoria, BadgeStato } from "@/components/stato";
import { StatoVuoto } from "@/components/stato-vuoto";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Scelta } from "@/components/form";
import { Textarea } from "@/components/ui/textarea";

export const metadata: Metadata = {
  title: "Sistema di design",
  description: "Colori, tipografia e componenti dell'interfaccia, con i contrasti misurati.",
  robots: { index: false },
};

// contrasti calcolati sui valori oklch di globals.css (WCAG 2.2: 4,5:1 testo, 3:1 componenti)
const COLORI: { nome: string; token: string; esempio: string; contrasto: string }[] = [
  { nome: "Inchiostro", token: "--foreground", esempio: "bg-foreground", contrasto: "16,9:1 sullo sfondo" },
  { nome: "Testo secondario", token: "--muted-foreground", esempio: "bg-muted-foreground", contrasto: "6,8:1 sullo sfondo" },
  { nome: "Verde", token: "--primary", esempio: "bg-primary", contrasto: "7,1:1 sullo sfondo, 7,2:1 col testo bianco" },
  { nome: "Verde chiaro", token: "--secondary", esempio: "bg-secondary", contrasto: "11,6:1 col suo testo" },
  { nome: "Errore", token: "--destructive", esempio: "bg-destructive", contrasto: "5,6:1 sullo sfondo" },
  { nome: "Bordo dei campi", token: "--input", esempio: "bg-input", contrasto: "3,4:1 sul bianco" },
  { nome: "Carta", token: "--background", esempio: "bg-background", contrasto: "sfondo della pagina" },
  { nome: "Incasso", token: "--sunken", esempio: "bg-sunken", contrasto: "raggruppa filtri e pannelli" },
];

const ESEMPIO = {
  codice: "MI-2026-000001",
  titolo: "Buca profonda in via Padova all'altezza del civico 80",
  stato: "Pubblicata",
  statoCodice: "PUBBLICATA",
  quartiere: "Padova - Turro - Crescenzago",
  municipio: "Municipio 2",
  categorie: "Manutenzione stradale",
  colore: "#92400e",
  miniatura: null,
  sostegni: 6,
};

function Sezione({ id, titolo, descrizione, children }: { id: string; titolo: string; descrizione: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="grid gap-5 border-t pt-10">
      <div className="grid gap-1">
        <h2 id={id} className="text-2xl font-semibold tracking-tight">
          {titolo}
        </h2>
        <p className="max-w-prose text-muted-foreground">{descrizione}</p>
      </div>
      {children}
    </section>
  );
}

function Pannello({ titolo, children }: { titolo: string; children: ReactNode }) {
  return (
    <div className="grid content-start gap-4 rounded-2xl bg-sunken p-2 ring-1 ring-border">
      <p className="px-3 pt-2 text-sm font-medium text-muted-foreground">{titolo}</p>
      <div className="grid gap-4 rounded-xl bg-card p-5 shadow-card">{children}</div>
    </div>
  );
}

export default function SistemaDesign() {
  return (
    <Pagina
      titolo="Sistema di design"
      descrizione="Le regole che tengono insieme l'interfaccia: pensata per il cittadino che segnala dal telefono e per il comitato che modera dal computer."
      className="grid gap-10"
    >
      <ul className="grid gap-3 sm:grid-cols-3">
        {(
          [
            ["Leggibile", "Testo almeno 16 px nei campi, contrasto AA misurato su ogni coppia di colori."],
            ["Facile da toccare", "Pulsanti da 40 px (48 px per le azioni principali), voci di menu da 40 px."],
            ["Calmo", "Animazioni sotto i 250 ms, solo dove spiegano qualcosa. Chi chiede meno movimento vede solo dissolvenze."],
          ] as const
        ).map(([t, d]) => (
          <li key={t} className="grid gap-1 rounded-xl border bg-card p-4 shadow-card">
            <p className="font-semibold">{t}</p>
            <p className="text-sm text-muted-foreground">{d}</p>
          </li>
        ))}
      </ul>

      <Sezione id="colori" titolo="Colori" descrizione="Un solo neutro caldo e un solo accento verde. Lo stato di una segnalazione non si affida mai al solo colore: c'è sempre il testo.">
        <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {COLORI.map((c) => (
            <li key={c.token} className="overflow-hidden rounded-xl border bg-card shadow-card">
              <div className={`h-16 border-b ${c.esempio}`} aria-hidden />
              <div className="grid gap-0.5 p-3 text-sm">
                <p className="font-semibold">{c.nome}</p>
                <p className="font-mono text-xs text-muted-foreground">{c.token}</p>
                <p className="text-xs text-muted-foreground">{c.contrasto}</p>
              </div>
            </li>
          ))}
        </ul>
      </Sezione>

      <Sezione id="tipografia" titolo="Tipografia" descrizione="Public Sans, il carattere nato per i servizi pubblici: cifre chiare, aperture larghe, buona resa anche piccolo.">
        <div className="grid gap-4 rounded-2xl border bg-card p-6 shadow-card">
          <p className="text-4xl leading-tight font-semibold tracking-tight sm:text-6xl">La città che vuoi</p>
          <p className="text-3xl font-semibold tracking-tight">Titolo di pagina · 30 px</p>
          <p className="text-xl font-semibold tracking-tight">Titolo di sezione · 20 px</p>
          <p className="max-w-prose text-lg leading-relaxed">
            Testo di lettura · 18 px. Da settimane c&apos;è una buca larga quasi un metro sulla corsia di destra: scooter e bici la
            evitano all&apos;ultimo.
          </p>
          <p className="text-sm text-muted-foreground">Testo secondario · 14 px, per date, quartieri e note.</p>
          <p className="text-3xl font-semibold tabular-nums">1.284 · 37 · 6,60</p>
        </div>
      </Sezione>

      <Sezione id="pulsanti" titolo="Pulsanti" descrizione="Un'azione principale per schermata. Alla pressione il pulsante si stringe del 3%: conferma che il tocco è arrivato.">
        <div className="grid gap-4 lg:grid-cols-2">
          <Pannello titolo="Varianti">
            <div className="flex flex-wrap gap-2">
              <Button>
                <CameraIcon weight="bold" aria-hidden />
                Fai una segnalazione
              </Button>
              <Button variant="outline">
                <BellRingingIcon aria-hidden />
                Segui
              </Button>
              <Button variant="secondary">Secondario</Button>
              <Button variant="ghost">Annulla</Button>
              <Button variant="destructive">
                <TrashIcon aria-hidden />
                Ritira
              </Button>
              <Button variant="link">Link</Button>
            </div>
          </Pannello>
          <Pannello titolo="Dimensioni e stati">
            <div className="flex flex-wrap items-center gap-2">
              <Button size="lg">
                <HeartIcon weight="fill" aria-hidden />
                Sostieni · 48 px
              </Button>
              <Button>Normale · 40 px</Button>
              <Button size="sm">Compatto · 36 px</Button>
              <Button disabled>Non disponibile</Button>
              <Button size="icon" variant="outline" aria-label="Cerca">
                <MagnifyingGlassIcon aria-hidden />
              </Button>
            </div>
          </Pannello>
        </div>
      </Sezione>

      <Sezione id="campi" titolo="Campi" descrizione="Etichetta sempre visibile sopra il campo, aiuto e errore collegati con aria-describedby. Il testo dei campi è a 16 px, così iOS non ingrandisce la pagina.">
        <Pannello titolo="Modulo">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="d-titolo">Titolo</Label>
              <Input id="d-titolo" defaultValue="Lampione abbattuto in via Lorenteggio" aria-describedby="d-titolo-aiuto" />
              <p id="d-titolo-aiuto" className="text-xs text-muted-foreground">
                Da 10 a 100 caratteri
              </p>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="d-quartiere">Quartiere</Label>
              <Scelta
                id="d-quartiere"
                defaultValue="lorenteggio"
                opzioni={[
                  ["lorenteggio", "Lorenteggio"],
                  ["bovisa", "Bovisa"],
                ]}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="d-email">Email</Label>
              <Input id="d-email" type="email" defaultValue="giulia@" aria-invalid aria-describedby="d-email-errore" />
              <p id="d-email-errore" className="flex items-center gap-1.5 text-sm text-destructive">
                <WarningCircleIcon weight="fill" className="size-4" aria-hidden />
                Scrivi un indirizzo email completo.
              </p>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="d-nota">Nota</Label>
              <Textarea id="d-nota" rows={2} placeholder="Facoltativa" />
            </div>
          </div>
        </Pannello>
      </Sezione>

      <Sezione id="stati" titolo="Stati e categorie" descrizione="Ogni stato ha sfondo, bordo, pallino e nome: si distingue anche in bianco e nero.">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["RICEVUTA", "Ricevuta"],
              ["IN_REVISIONE", "In revisione"],
              ["DA_INTEGRARE", "Da integrare"],
              ["RIFIUTATA", "Rifiutata"],
              ["PUBBLICATA", "Pubblicata"],
              ["PRESA_IN_CARICO", "Presa in carico"],
              ["INVIATA_CANDIDATI", "Inviata ai candidati"],
              ["UNITA", "Unita"],
              ["ARCHIVIATA", "Archiviata"],
            ] as const
          ).map(([c, n]) => (
            <BadgeStato key={c} codice={c} nome={n} />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <BadgeCategoria nome="Mobilità urbana" colore="#2563eb" />
          <BadgeCategoria nome="Manutenzione stradale" colore="#92400e" />
          <BadgeCategoria nome="Ambiente e verde" colore="#16a34a" />
        </div>
      </Sezione>

      <Sezione id="elenchi" titolo="Elenchi e stati vuoti" descrizione="La scheda tiene il titolo intero su due righe anche a 360 px; i sostegni scendono nella riga dei badge sui telefoni.">
        <div className="grid gap-4 lg:grid-cols-2">
          <SchedaSegnalazione s={ESEMPIO} posizione={1} />
          <StatoVuoto icona={<MegaphoneIcon weight="duotone" />} titolo="Ancora nessuna segnalazione">
            Le prime compariranno qui appena un moderatore le approva.
          </StatoVuoto>
        </div>
      </Sezione>

      <Sezione id="icone" titolo="Icone" descrizione="Phosphor, licenza MIT. Regular per le azioni, duotone per illustrare, fill per la voce attiva della navigazione.">
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {(
            [
              [HouseIcon, "Home"],
              [MapPinIcon, "Luogo"],
              [CameraIcon, "Foto"],
              [HeartIcon, "Sostegno"],
              [ShieldCheckIcon, "Moderazione"],
              [PaperPlaneTiltIcon, "Invio"],
            ] as const
          ).map(([Icona, nome]) => (
            <li key={nome} className="grid justify-items-center gap-2 rounded-xl border bg-card p-4 text-xs text-muted-foreground shadow-card">
              <span className="flex gap-2 text-foreground" aria-hidden>
                <Icona className="size-6" />
                <Icona weight="duotone" className="size-6 text-primary" />
                <Icona weight="fill" className="size-6 text-primary" />
              </span>
              {nome}
            </li>
          ))}
        </ul>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <CheckCircleIcon weight="fill" className="size-4 text-primary" aria-hidden />
          Le icone accanto a un testo sono decorative (aria-hidden); quelle da sole hanno un aria-label.
        </p>
      </Sezione>
    </Pagina>
  );
}
