"use client";

import { useEffect } from "react";

/** Registra il service worker solo in produzione: in sviluppo darebbe fastidio al ricaricamento. */
export function RegistraServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
