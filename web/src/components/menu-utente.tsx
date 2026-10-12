"use client";

import Link from "next/link";
import { BellIcon, ClipboardTextIcon, GaugeIcon, ShieldCheckIcon, SignOutIcon, UserCircleIcon, UserIcon } from "@phosphor-icons/react";
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
        <UserCircleIcon weight="duotone" className="size-5" aria-hidden />
        {daLeggere > 0 && <span className="absolute -top-1 -right-1 size-2.5 rounded-full bg-destructive ring-2 ring-background" aria-hidden />}
        <span className="hidden max-w-32 truncate sm:inline">{nome}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{nome}</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/profilo" />}>
          <UserIcon aria-hidden />
          Profilo
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/profilo/segnalazioni" />}>
          <ClipboardTextIcon aria-hidden />
          Le mie segnalazioni
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/notifiche" />}>
          <BellIcon aria-hidden />
          Notifiche
          {daLeggere > 0 && <span className="ml-auto rounded-full bg-destructive px-1.5 text-xs font-semibold text-white tabular-nums">{daLeggere}</span>}
        </DropdownMenuItem>
        {livello >= 2 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href="/moderazione" />}>
              <ShieldCheckIcon aria-hidden />
              Moderazione
            </DropdownMenuItem>
          </>
        )}
        {livello >= 3 && (
          <DropdownMenuItem render={<Link href="/admin" />}>
            <GaugeIcon aria-hidden />
            Amministrazione
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => esci()}>
          <SignOutIcon aria-hidden />
          Esci
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
