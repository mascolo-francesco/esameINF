import Image from "next/image";
import Link from "next/link";
import { db } from "@/lib/server/db";
import { classifica } from "@/lib/server/consultazione";
import { elencoMunicipi, elencoQuartieri } from "@/lib/server/catalogo";
import { buttonVariants } from "@/components/ui/button";
import { formattaNumero } from "@/lib/formato";
import { cn } from "@/lib/utils";
import { FilaPassi, type Passo } from "./_home/fila-passi";
import { ListaSostenute } from "./_home/lista-sostenute";
import { SceltaMunicipio, type DatiMunicipio } from "./_home/municipi";

const filtriBase = { categoria: null, municipio: null, quartiere: null, tipo: null, stato: null, giorni: null, pagina: 1 };

// la miniatura è da 400 px: per le foto grandi uso la variante pubblica dello stesso allegato
const fotoGrande = (miniatura: string | null) => miniatura?.replace(/\/miniatura$/, "/pubblica") ?? null;

const PASSI: Passo[] = [
  {
    titolo: "Vedi qualcosa che non va",
    testo: "Un lampione spento, una buca, un'aula studio che manca. Scatti una foto e segni il punto sulla mappa.",
    foto: "/archivio/milano-piazza-della-vetra.jpg",
    didascalia: "Piazza della Vetra, 1953 circa",
  },
  {
    titolo: "Una persona la legge",
    testo: "Un moderatore del comitato controlla ogni segnalazione prima di pubblicarla: niente dati personali, niente insulti.",
    foto: "/archivio/milano.jpg",
    didascalia: "Milano, anni Cinquanta",
  },
  {
    titolo: "Tutti la vedono",
    testo: "Pubblicata, compare sulla mappa e in classifica con il suo codice. Chi è registrato può commentarla.",
    foto: "/archivio/milano-piazza-duomo.jpg",
    didascalia: "Piazza del Duomo, anni Cinquanta",
  },
  {
    titolo: "I vicini la sostengono",
    testo: "Ogni cittadino registrato può darle il suo sostegno. Quello di chi abita nello stesso municipio pesa di più.",
    foto: "/archivio/milano-navigli.jpg",
    didascalia: "I Navigli, anni Cinquanta",
  },
  {
    titolo: "Entra nel documento",
    testo: "Il comitato raccoglie le segnalazioni più sostenute nel documento programmatico, municipio per municipio.",
    foto: "/archivio/milano-periferia-2.jpg",
    didascalia: "Periferia, anni Cinquanta",
  },
  {
    titolo: "Arriva ai candidati",
    testo: "Il documento va a tutti i candidati sindaco, senza preferenze. Chi l'ha segnalata o sostenuta riceve una notifica.",
    foto: "/archivio/milano-periferia.jpg",
    didascalia: "Manifesti in periferia, anni Cinquanta",
  },
];

export default async function Home({ searchParams }: PageProps<"/">) {
  const { account, municipio } = await searchParams;
  const [numeri, sostenute, municipi, quartieri, perMunicipio] = await Promise.all([
    db.riga<{ pubblicate: number; sostegni: number; cittadini: number }>(
      `SELECT (SELECT COUNT(*) FROM segnalazione s JOIN stato st ON st.codice = s.stato_corrente WHERE st.in_classifica) AS pubblicate,
              (SELECT COUNT(*) FROM sostegno) AS sostegni,
              (SELECT COUNT(*) FROM utente WHERE stato_account = 'attivo') AS cittadini`,
    ),
    classifica({ ...filtriBase, ordine: "sostenute" }),
    elencoMunicipi(),
    elencoQuartieri(),
    // per ogni municipio: quante segnalazioni sono in classifica e qual è la più sostenuta
    db.righe<{ id_municipio: number; n: number; codice_pubblico: string; titolo: string; num_sostegni: number; miniatura: string | null }>(
      `SELECT id_municipio, n, codice_pubblico, titolo, num_sostegni, miniatura
         FROM (SELECT v.id_municipio, v.codice_pubblico, v.titolo, v.num_sostegni, v.miniatura,
                      COUNT(*) OVER (PARTITION BY v.id_municipio) AS n,
                      ROW_NUMBER() OVER (PARTITION BY v.id_municipio ORDER BY v.punteggio_priorita DESC, v.num_sostegni DESC) AS rn
                 FROM v_classifica v) t
        WHERE rn = 1`,
    ),
  ]);

  const datiMunicipi: DatiMunicipio[] = municipi.map((m) => {
    const r = perMunicipio.find((x) => x.id_municipio === m.id);
    return {
      id: m.id,
      nome: m.nome,
      quartieri: quartieri.filter((q) => q.idMunicipio === m.id).map((q) => q.nome),
      pubbliche: r?.n ?? 0,
      prima: r ? { codice: r.codice_pubblico, titolo: r.titolo, sostegni: r.num_sostegni, foto: fotoGrande(r.miniatura) } : null,
    };
  });
  // senza scelta parto dal municipio con più segnalazioni, così la tavola non è vuota
  const piuAttivo = [...datiMunicipi].sort((a, b) => b.pubbliche - a.pubbliche)[0]?.id ?? 1;
  const scelto = Number(municipio) >= 1 && Number(municipio) <= 9 ? Number(municipio) : piuAttivo;

  const voci = sostenute.voci.slice(0, 6).map((v) => ({
    codice: v.codice,
    titolo: v.titolo,
    sostegni: v.sostegni,
    foto: fotoGrande(v.miniatura),
    luogo: `${v.quartiere}, ${v.municipio}`,
    stato: v.stato,
    categorie: v.categorie,
  }));

  return (
    <div className="grid grid-cols-1">
      {account === "eliminato" && (
        <p role="status" className="mx-auto w-full max-w-6xl px-4 py-4 text-step-body sm:px-8">
          Il tuo account è stato chiuso. I dati personali saranno cancellati entro 7 giorni.
        </p>
      )}

      {/* Il tabellone: un muro di manifesti a Milano, e sopra il nostro foglio */}
      <section aria-labelledby="titolo" className="relative isolate grid min-h-[calc(100svh-4rem)] place-items-center overflow-hidden px-4 py-10 sm:px-8 sm:py-20">
        <Image
          src="/archivio/milano-periferia.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="deriva -z-10 object-cover brightness-[0.55] grayscale"
        />
        <div className="grid w-full max-w-5xl gap-8 bg-carta p-5 sm:gap-10 sm:p-10 lg:w-[72%]">
          <h1 id="titolo" className="text-[clamp(2rem,-0.2rem+6.1vw,5.5rem)] leading-[0.95] tracking-tight">
            Milano, segnalata da chi ci vive.
          </h1>
          <ul className="grid gap-1 text-step-body leading-snug sm:grid-cols-3 sm:gap-6">
            <li>Elezioni comunali</li>
            <li>
              {municipi.length} municipi, {quartieri.length} quartieri
            </li>
            {numeri && <li className="tabular-nums">{formattaNumero(numeri.pubblicate)} segnalazioni pubbliche</li>}
          </ul>
          <p className="max-w-[44ch] text-step-lead leading-snug">
            Fotografa un problema del tuo quartiere o proponi un&apos;idea. Le segnalazioni più sostenute arrivano a tutti i candidati
            sindaco.
          </p>
          <div className="grid items-center gap-4 lg:grid-cols-3">
            <p className="order-3 text-step-small text-muted-foreground lg:order-1">Comitato civico La Nostra Città</p>
            <Link href="/nuova" className={cn(buttonVariants({ size: "lg" }), "premibile order-1 h-14 w-full px-6 text-step-body lg:order-2")}>
              Fai una segnalazione
            </Link>
            <Link href="/mappa" className="order-2 text-step-body underline underline-offset-4 hover:text-primary lg:order-3 lg:justify-self-end">
              Esplora la mappa
            </Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="percorso" className="py-24 sm:py-40">
        <FilaPassi passi={PASSI} />
      </section>

      {voci.length > 0 && (
        <section aria-labelledby="sostenute" className="bg-sunken px-4 py-24 sm:px-8 sm:py-40">
          <div className="mx-auto max-w-6xl">
            <ListaSostenute voci={voci} />
          </div>
        </section>
      )}

      <section aria-labelledby="municipio" className="scroll-mt-16 px-4 py-24 sm:px-8 sm:py-32">
        <div className="mx-auto max-w-6xl">
          <SceltaMunicipio municipi={datiMunicipi} iniziale={scelto} />
        </div>
      </section>

      {/* Lettera del comitato: un foglio con il bordo smerlato e una striscia da strappare */}
      <section aria-labelledby="perche" className="bg-sunken px-4 py-24 sm:px-8 sm:py-40">
        <article className="mx-auto grid max-w-[40rem] gap-6 bg-carta px-6 pt-10 pb-12 sm:px-14 sm:pt-14">
          <h2 id="perche" data-rivela className="text-step-head leading-[0.95] tracking-tight">
            Perché lo facciamo
          </h2>
          <div data-rivela style={{ "--ritardo": "80ms" } as React.CSSProperties} className="grid gap-5 text-step-body leading-relaxed">
            <p>
              Ci siamo conosciuti alle assemblee di quartiere. Ognuno arrivava con un elenco di cose che non andavano, e quasi
              nessuna arrivava a chi poteva sistemarle.
            </p>
            <p>
              Per queste elezioni facciamo il contrario: raccogliamo le segnalazioni di chi vive a Milano, le leggiamo una per una
              e le mettiamo in ordine di sostegno, municipio per municipio.
            </p>
            <p>
              Prima del voto consegniamo lo stesso documento a tutti i candidati sindaco. Non sosteniamo nessuna lista: chiediamo
              a ciascuno che cosa farà per le richieste più sostenute.
            </p>
          </div>
          <p data-rivela style={{ "--ritardo": "160ms" } as React.CSSProperties} className="grid">
            <span className="text-step-lead italic">Il comitato La Nostra Città</span>
            <span className="text-step-small text-muted-foreground">Comitato civico, Milano</span>
          </p>
        </article>
        <div className="bordo-smerlato-sotto mx-auto grid max-w-[40rem] gap-4 border-t-6 border-dotted border-sunken bg-carta px-6 pt-6 pb-12 sm:flex sm:items-center sm:justify-between sm:px-14">
          <p className="text-step-body">Per sostenere e commentare serve un account.</p>
          <Link href="/registrati" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "premibile w-full sm:w-auto")}>
            Registrati
          </Link>
        </div>
      </section>

      {/* La cartolina di risposta, appoggiata storta sul campo colorato */}
      <section aria-labelledby="invito" className="overflow-hidden bg-primary px-4 pt-24 text-primary-foreground sm:px-8 sm:pt-32">
        <div className="mx-auto grid max-w-6xl gap-12 sm:min-h-[60svh] sm:grid-cols-12 sm:items-end">
          <p data-rivela className="max-w-[24ch] text-step-lead leading-snug sm:col-span-4 sm:mb-16">
            Ogni segnalazione la legge una persona prima di essere pubblicata. Bastano una foto e due righe.
          </p>
          <div
            data-rivela
            style={{ "--ritardo": "120ms" } as React.CSSProperties}
            className="mx-auto -mb-16 grid aspect-[7/5] w-[90%] max-w-xl rotate-1 content-center justify-items-center gap-4 bg-carta p-8 text-center text-foreground sm:col-span-7 sm:col-start-6 sm:w-full sm:rotate-2 sm:p-12"
          >
            <h2 id="invito" className="text-step-head leading-[0.95] tracking-tight">
              Hai visto qualcosa?
            </h2>
            <p className="text-step-body">Fotografala, segna il punto sulla mappa, scrivi che cosa succede.</p>
            <Link
              href="/nuova"
              className="premibile mt-2 flex h-14 w-full items-center justify-center bg-foreground text-step-body text-background transition-[background-color,scale] duration-150 hover:bg-primary"
            >
              Fai una segnalazione
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
