"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/server/db";
import { richiediUtente } from "@/lib/server/auth/sessione";

export async function segnaNotificheLette(): Promise<void> {
  const u = await richiediUtente();
  await db.esegui("UPDATE notifica SET letta = TRUE WHERE id_utente = ? AND NOT letta", [u.id]);
  revalidatePath("/", "layout");
}
