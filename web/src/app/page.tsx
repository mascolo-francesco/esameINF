import Link from "next/link";
import { ArrowRight, Camera, Heart, Landmark } from "lucide-react";
import { db } from "@/lib/server/db";
import { classifica } from "@/lib/server/consultazione";
import { SchedaSegnalazione } from "@/components/scheda-segnalazione";
import { buttonVariants } from "@/components/ui/button";
import { formattaNumero } from "@/lib/formato";
import { cn } from "@/lib/utils";

const filtriBase = { categoria: null, municipio: null, quartiere: null, tipo: null, stato: null, giorni: null, pagina: 1 };

export default async function Home({ searchParams }: PageProps<"/">) {
  const { account } = await searchParams;
  const [numeri, sostenute, tendenza] = await Promise.all([
    db.riga<{ pubblicate: number; sostegni: number; cittadini: number }>(
      `SELECT (SELECT COUNT(*) FROM segnalazione s JOIN stato st ON st.codice = s.stato_corrente WHERE st.in_classifica) AS pubblicate,
              (SELECT COUNT(*) FROM sostegno) AS sostegni,
              (SELECT COUNT(*) FROM utente WHERE stato_account = 'attivo') AS cittadini`,
    ),
    classifica({ ...filtriBase, ordine: "sostenute" }),
    classifica({ ...filtriBase, ordine: "tendenza" }),
  ]);

  return (
    <div className="grid grid-cols-1 gap-12 pb-12">
      {account === "eliminato" && (
        <p role="status" className="mx-auto mt-6 w-full max-w-6xl px-4 text-sm">
          Il tuo account è stato chiuso. I dati personali saranno cancellati entro 7 giorni.
        </p>
      )}
      <section className="border-b bg-gradient-to-b from-secondary/60 to-background">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-6 px-4 py-12 sm:py-16">
          <p className="text-sm font-medium text-primary">Elezioni comunali di Milano</p>
          <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-balance sm:text-5xl">
            La città che vuoi, raccontata da chi ci vive.
          </h1>
          <p className="max-w-2xl text-lg text-muted-foreground">
            Fotografa un problema del tuo quartiere o proponi un&apos;idea. Le segnalazioni più sostenute finiscono nel
            documento che il comitato consegna a tutti i candidati sindaco.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/nuova" className={cn(buttonVariants({ size: "lg" }), "h-11 px-5 text-base")}>
              Fai una segnalazione
            </Link>
            <Link href="/mappa" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-11 px-5 text-base")}>
              Esplora la mappa
            </Link>
          </div>
          {numeri && (
            <dl className="mt-4 grid max-w-xl grid-cols-3 gap-4">
              {(
                [
                  ["Segnalazioni pubblicate", numeri.pubblicate],
                  ["Sostegni", numeri.sostegni],
                  ["Cittadini iscritti", numeri.cittadini],
                ] as const
              ).map(([t, n]) => (
                <div key={t} className="grid">
                  <dt className="order-2 text-xs text-muted-foreground sm:text-sm">{t}</dt>
                  <dd className="text-2xl font-semibold tabular-nums sm:text-3xl">{formattaNumero(n)}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-4 px-4 sm:grid-cols-3" aria-label="Come funziona">
        {(
          [
            [Camera, "1. Segnala", "Una foto, il punto sulla mappa e due righe di descrizione. Un moderatore la controlla e la pubblica."],
            [Heart, "2. Sostieni", "Ogni cittadino dà un sostegno alle segnalazioni che condivide. Chi abita nello stesso Municipio pesa un po' di più."],
            [Landmark, "3. Arriva ai candidati", "Il comitato raccoglie le più sostenute nel documento programmatico e lo invia a tutti i candidati."],
          ] as const
        ).map(([Icona, t, d]) => (
          <div key={t} className="grid content-start gap-2 rounded-lg border bg-card p-5">
            <Icona className="size-5 text-primary" aria-hidden />
            <h2 className="font-semibold">{t}</h2>
            <p className="text-sm text-muted-foreground">{d}</p>
          </div>
        ))}
      </section>

      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-10 px-4 lg:grid-cols-2">
        {(
          [
            ["Più sostenute", sostenute.voci, "/classifica"],
            ["Di tendenza", tendenza.voci, "/classifica?ordine=tendenza"],
          ] as const
        ).map(([titolo, voci, link]) => (
          <section key={titolo} className="grid min-w-0 content-start gap-4" aria-labelledby={`h-${link}`}>
            <div className="flex items-baseline justify-between">
              <h2 id={`h-${link}`} className="text-xl font-semibold">
                {titolo}
              </h2>
              <Link href={link} className="flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline">
                Tutta la classifica <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            </div>
            <ol className="grid gap-3">
              {voci.slice(0, 5).map((v, i) => (
                <li key={v.id}>
                  <SchedaSegnalazione s={v} posizione={i + 1} />
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </div>
  );
}
