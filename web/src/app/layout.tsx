import type { Metadata, Viewport } from "next";
import { Geist_Mono, Public_Sans } from "next/font/google";
import { Intestazione } from "@/components/intestazione";
import { Toaster } from "@/components/ui/sonner";
import { RegistraServiceWorker } from "@/components/registra-sw";
import { BarraMobile } from "@/components/barra-mobile";
import "./globals.css";

const sans = Public_Sans({ variable: "--font-sans", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

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
  themeColor: "#1f6f5c",
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="it" className={`${sans.variable} ${mono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col pb-16 sm:pb-0">
        <a
          href="#contenuto"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
        >
          Vai al contenuto
        </a>
        <Intestazione />
        <main id="contenuto" className="flex flex-1 flex-col">
          {children}
        </main>
        <footer className="border-t py-6 text-center text-sm text-muted-foreground">
          <p>La Nostra Città, Il Nostro Futuro · progetto d&apos;esame, dati dimostrativi</p>
        </footer>
        <BarraMobile />
        <Toaster richColors position="top-center" />
        <RegistraServiceWorker />
      </body>
    </html>
  );
}
