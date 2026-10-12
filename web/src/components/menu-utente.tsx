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

export function MenuUtente({ nome, livello, daLeggere }: { nome: string; livello: number; daLeggere: number }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={`${buttonVariants({ variant: "outline", size: "sm" })} relative`}
        aria-label={`Menu di ${nome}${daLeggere ? `, ${daLeggere} notifiche da leggere` : ""}`}
      >
        <CircleUser className="size-4" aria-hidden />
        {daLeggere > 0 && <span className="absolute -top-1 -right-1 size-2.5 rounded-full bg-destructive ring-2 ring-background" aria-hidden />}
        <span className="hidden max-w-32 truncate sm:inline">{nome}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{nome}</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/profilo" />}>Profilo</DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/profilo/segnalazioni" />}>Le mie segnalazioni</DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/notifiche" />}>
          Notifiche{daLeggere > 0 && <span className="ml-auto rounded-full bg-destructive px-1.5 text-xs text-white">{daLeggere}</span>}
        </DropdownMenuItem>
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
