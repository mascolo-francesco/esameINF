import Image from "next/image";
import Link from "next/link";

const VOCI = [
  ["/nuova", "Fai una segnalazione"],
  ["/mappa", "Mappa delle segnalazioni"],
  ["/classifica", "Classifica"],
  ["/privacy", "Informativa privacy"],
] as const;

/** Il retro della cartolina: un foglio con il bordo smerlato, appoggiato sulla lamiera del tabellone. */
export function PieDiPagina() {
  return (
    <footer className="mt-auto bg-lamiera px-4 pt-16 text-foreground sm:px-8 sm:pt-24">
      <div className="bordo-smerlato mx-auto grid max-w-5xl gap-10 bg-carta px-6 pt-14 pb-8 sm:grid-cols-2 sm:gap-12 sm:px-12 sm:pt-16">
        <div className="grid content-start gap-4">
          <p className="font-display text-step-lead leading-tight tracking-tight">Milano, prima del voto.</p>
          <p className="max-w-sm text-step-body leading-relaxed">
            Il comitato raccoglie le segnalazioni più sostenute nel documento programmatico e lo consegna a tutti i candidati
            sindaco, senza preferenze.
          </p>
        </div>
        <div className="relative grid content-start gap-6 sm:pr-28">
          <figure className="absolute top-0 right-0 hidden w-22 bg-carta p-1.5 outline-6 outline-carta outline-dotted sm:block">
            <Image
              src="/archivio/milano-piazza-della-vetra.jpg"
              alt="Piazza della Vetra, Milano, intorno al 1953"
              width={176}
              height={234}
              className="aspect-[3/4] w-full object-cover grayscale"
            />
          </figure>
          <nav aria-label="Piè di pagina">
            <ul className="grid gap-3 text-step-body">
              {VOCI.map(([href, testo]) => (
                <li key={href}>
                  <Link href={href} className="underline-offset-4 decoration-1 hover:text-primary hover:underline">
                    {testo}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <p className="border-t-6 border-dotted border-sunken pt-6 text-center text-step-small text-muted-foreground sm:col-span-2">
          La Nostra Città, Il Nostro Futuro · progetto d&apos;esame, dati dimostrativi ·{" "}
          <Link href="/crediti" className="underline underline-offset-4 hover:text-foreground">
            fotografie di Paolo Monti, Fondo BEIC, CC BY-SA 4.0
          </Link>
        </p>
      </div>
    </footer>
  );
}
