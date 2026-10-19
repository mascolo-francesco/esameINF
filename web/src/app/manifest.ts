import type { MetadataRoute } from "next";

// RNF: web app installabile sulla schermata home del telefono
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "La Nostra Città, Il Nostro Futuro",
    short_name: "La Nostra Città",
    description: "Segnala i problemi del tuo quartiere e sostieni le proposte dei cittadini di Milano.",
    lang: "it",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f7f9fa",
    theme_color: "#1f3038",
    categories: ["social", "utilities"],
    icons: [
      { src: "/icone/icona-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icone/icona-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icone/icona-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Nuova segnalazione", url: "/nuova" },
      { name: "Mappa", url: "/mappa" },
    ],
  };
}
