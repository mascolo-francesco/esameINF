"use client";

import { useTransition } from "react";
import { segnaNotificheLette } from "./azioni";
import { Button } from "@/components/ui/button";

export function SegnaLette() {
  const [inCorso, avvia] = useTransition();
  return (
    <Button variant="outline" disabled={inCorso} onClick={() => avvia(() => segnaNotificheLette())}>
      Segna tutte come lette
    </Button>
  );
}
