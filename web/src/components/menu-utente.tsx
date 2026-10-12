"use client";

import Link from "next/link";
import { CircleUser } from "lucide-react";
import { esci } from "@/app/azioni/sessione";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { buttonVariants } from "@/components/ui/button";

export function MenuUtente({ nome, livello }: { nome: string; livello: number }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={buttonVariants({ variant: "outline", size: "sm" })} aria-label={`Menu di ${nome}`}>
        <CircleUser className="size-4" aria-hidden />
        <span className="hidden max-w-32 truncate sm:inline">{nome}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{nome}</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/profilo" />}>Profilo</DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/profilo/segnalazioni" />}>Le mie segnalazioni</DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/notifiche" />}>Notifiche</DropdownMenuItem>
        {livello >= 2 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href="/moderazione" />}>Moderazione</DropdownMenuItem>
          </>
        )}
        {livello >= 3 && <DropdownMenuItem render={<Link href="/admin" />}>Amministrazione</DropdownMenuItem>}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => esci()}>Esci</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
