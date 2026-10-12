import Link from "next/link";
import { ArrowRightIcon, BankIcon, CameraIcon, HeartIcon, MapTrifoldIcon, MegaphoneIcon, UsersThreeIcon } from "@phosphor-icons/react/ssr";
import { db } from "@/lib/server/db";
import { classifica } from "@/lib/server/consultazione";
import { SchedaSegnalazione } from "@/components/scheda-segnalazione";
import { StatoVuoto } from "@/components/stato-vuoto";
import { buttonVariants } from "@/components/ui/button";
import { formattaNumero } from "@/lib/formato";

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
    <div className="grid grid-cols-1 gap-14 pb-14">
      {account === "eliminato" && (
        <p role="status" className="mx-auto mt-6 w-full max-w-6xl px-4 text-sm">
          Il tuo account è stato chiuso. I dati personali saranno cancellati entro 7 giorni.
        </p>
      )}
      <section className="relative overflow-hidden border-b bg-[radial-gradient(60rem_30rem_at_15%_-10%,var(--secondary),transparent_70%)]">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-12 sm:py-16 lg:grid-cols-[1fr_22rem] lg:items-center">
          <div className="grid content-start gap-6">
            <p className="flex w-fit items-center gap-2 rounded-full border bg-card px-3 py-1 text-sm font-medium text-secondary-foreground shadow-card">
              <span className="size-2 rounded-full bg-primary" aria-hidden />
              Elezioni comunali di Milano
            </p>
            <h1 className="max-w-3xl text-4xl leading-[1.05] font-semibold tracking-tight sm:text-6xl">
              La città che vuoi, raccontata da chi ci vive.
            </h1>
            <p className="max-w-2xl text-lg text-muted-foreground">
              Fotografa un problema del tuo quartiere o proponi un&apos;idea. Le segnalazioni più sostenute finiscono nel
              documento che il comitato consegna a tutti i candidati sindaco.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/nuova" className={buttonVariants({ size: "lg" })}>
                <CameraIcon weight="bold" aria-hidden />
                Fai una segnalazione
              </Link>
              <Link href="/mappa" className={buttonVariants({ variant: "outline", size: "lg" })}>
                <MapTrifoldIcon aria-hidden />
                Esplora la mappa
              </Link>
            </div>
          </div>
          {numeri && (
            <dl className="grid grid-cols-3 gap-2 rounded-2xl bg-sunken p-2 ring-1 ring-border lg:grid-cols-1">
              {(
                [
                  ["Segnalazioni pubblicate", numeri.pubblicate, <MegaphoneIcon key="m" weight="duotone" aria-hidden />],
                  ["Sostegni dei cittadini", numeri.sostegni, <HeartIcon key="h" weight="duotone" aria-hidden />],
                  ["Cittadini iscritti", numeri.cittadini, <UsersThreeIcon key="u" weight="duotone" aria-hidden />],
                ] as const
              ).map(([t, n, icona]) => (
                <div key={t} className="grid gap-1 rounded-xl bg-card p-3 shadow-card sm:p-4">
                  <dt className="order-2 text-xs text-muted-foreground sm:text-sm lg:pl-13">{t}</dt>
                  {/* in un <dl> stanno solo dt e dd: l'icona va dentro il dd */}
                  <dd className="flex items-center gap-3">
                    <span className="hidden size-10 shrink-0 place-items-center rounded-lg bg-secondary text-primary lg:grid [&_svg]:size-5">
                      {icona}
                    </span>
                    <span className="text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">{formattaNumero(n)}</span>
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-6xl gap-6 px-4" aria-labelledby="come-funziona">
        <h2 id="come-funziona" className="text-2xl font-semibold tracking-tight">
          Come funziona
        </h2>
        <ol className="grid gap-6 sm:grid-cols-3 sm:gap-8">
          {(
            [
              [CameraIcon, "Segnala", "Una foto, il punto sulla mappa e due righe di descrizione. Un moderatore la controlla e la pubblica."],
              [HeartIcon, "Sostieni", "Ogni cittadino dà un sostegno alle segnalazioni che condivide. Chi abita nello stesso Municipio pesa un po' di più."],
              [BankIcon, "Arriva ai candidati", "Il comitato raccoglie le più sostenute nel documento programmatico e lo invia a tutti i candidati."],
            ] as const
          ).map(([Icona, t, d], i) => (
            <li key={t} className="relative grid grid-cols-[auto_1fr] content-start gap-x-4 gap-y-1 sm:grid-cols-1">
              {/* linea che collega i passi, solo da tablet in su */}
              {i < 2 && <span className="absolute top-6 left-14 hidden h-px w-[calc(100%-2rem)] bg-border sm:block" aria-hidden />}
              <span className="relative row-span-2 grid size-12 place-items-center rounded-xl bg-card text-primary shadow-card ring-1 ring-border sm:row-span-1 sm:mb-3">
                <Icona weight="duotone" className="size-6" aria-hidden />
              </span>
              <h3 className="font-semibold">
                <span className="text-muted-foreground tabular-nums">{i + 1}.</span> {t}
              </h3>
              <p className="text-sm text-muted-foreground">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-10 px-4 lg:grid-cols-2">
        {(
          [
            ["Più sostenute", sostenute.voci, "/classifica", "h-sostenute"],
            ["Di tendenza", tendenza.voci, "/classifica?ordine=tendenza", "h-tendenza"],
          ] as const
        ).map(([titolo, voci, link, id]) => (
          <section key={titolo} className="grid min-w-0 content-start gap-4" aria-labelledby={id}>
            <div className="flex items-baseline justify-between gap-4">
              <h2 id={id} className="text-2xl font-semibold tracking-tight">
                {titolo}
              </h2>
              <Link href={link} className="flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline">
                Tutta la classifica <ArrowRightIcon className="size-3.5" aria-hidden />
              </Link>
            </div>
            {voci.length === 0 ? (
              <StatoVuoto icona={<MegaphoneIcon weight="duotone" />} titolo="Ancora nessuna segnalazione pubblicata">
                Le prime compariranno qui appena un moderatore le approva.
              </StatoVuoto>
            ) : (
              <ol className="grid gap-3">
                {voci.slice(0, 5).map((v, i) => (
                  <li key={v.id}>
                    <SchedaSegnalazione s={v} posizione={i + 1} />
                  </li>
                ))}
              </ol>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
