import type { Metadata, Viewport } from "next";
import { Source_Serif_4, Young_Serif } from "next/font/google";
import { Intestazione } from "@/components/intestazione";
import { Toaster } from "@/components/ui/sonner";
import { RegistraServiceWorker } from "@/components/registra-sw";
import { BarraMobile } from "@/components/barra-mobile";
import { PieDiPagina } from "@/components/pie-di-pagina";
import { AttivaRivela } from "@/components/rivela";
import "./globals.css";

const titoli = Young_Serif({ variable: "--font-titoli", weight: "400", subsets: ["latin"] });
const testo = Source_Serif_4({ variable: "--font-testo", subsets: ["latin"], style: ["normal", "italic"] });

// URL assoluto del sito per le anteprime Open Graph (RF-41); su Vercel lo ricavo dal dominio di produzione
const sito =
  process.env.NEXT_PUBLIC_SITO ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(sito),
  title: { default: "La Nostra Città, Il Nostro Futuro", template: "%s · La Nostra Città" },
  description:
    "Segnala i problemi del tuo quartiere, sostieni le proposte degli altri cittadini e aiuta il comitato a scrivere il documento per i candidati sindaco di Milano.",
  applicationName: "La Nostra Città",
  appleWebApp: { capable: true, title: "La Nostra Città", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#1f3038",
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="it" suppressHydrationWarning className={`${titoli.variable} ${testo.variable} h-full antialiased`}>
      <head>
        {/* segnala al CSS che gli script girano: solo allora le entrate partono da nascoste */}
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
      </head>
      <body className="flex min-h-full flex-col pb-[calc(4rem+env(safe-area-inset-bottom))] sm:pb-0">
        <a
          href="#contenuto"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-3 focus:text-primary-foreground"
        >
          Vai al contenuto
        </a>
        <Intestazione />
        <main id="contenuto" className="flex flex-1 flex-col">
          {children}
        </main>
        <PieDiPagina />
        <BarraMobile />
        <Toaster richColors position="top-center" />
        <RegistraServiceWorker />
        <AttivaRivela />
      </body>
    </html>
  );
}
