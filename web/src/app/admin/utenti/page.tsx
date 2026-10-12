import type { Metadata } from "next";
import { db } from "@/lib/server/db";
import { LIVELLO, richiediUtente } from "@/lib/server/auth/sessione";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormRuolo } from "../moduli";

export const metadata: Metadata = { title: "Ruoli" };

export default async function Ruoli({ searchParams }: PageProps<"/admin/utenti">) {
  const io = await richiediUtente(LIVELLO.amministratore, "/admin/utenti");
  const { q } = await searchParams;
  const cerca = typeof q === "string" ? q.trim().slice(0, 100) : "";
  const righe = await db.righe<{ id: number; nome_visualizzato: string; email: string; id_ruolo: number; totp_attivo: number; stato_account: string }>(
    `SELECT id, nome_visualizzato, email, id_ruolo, totp_attivo, stato_account FROM utente
      WHERE anonimizzato_il IS NULL AND stato_account <> 'cancellato'
        AND (? = '' OR nome_visualizzato LIKE ? OR LOWER(email) LIKE ?)
      ORDER BY id_ruolo DESC, nome_visualizzato LIMIT 50`,
    [cerca, `%${cerca}%`, `%${cerca.toLowerCase()}%`],
  );
  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">
        Moderatori e amministratori devono avere la verifica in due passaggi attiva (RF-10): l&apos;utente la attiva dal proprio profilo.
      </p>
      <form method="get" className="flex max-w-md gap-2">
        <label htmlFor="q" className="sr-only">
          Cerca
        </label>
        <Input id="q" name="q" defaultValue={cerca} placeholder="Nome visualizzato o email" />
        <Button type="submit" variant="outline">
          Cerca
        </Button>
      </form>
      <div className="overflow-x-auto rounded-xl border bg-card shadow-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th scope="col" className="p-3 font-medium">Utente</th>
              <th scope="col" className="p-3 font-medium">2FA</th>
              <th scope="col" className="p-3 font-medium">Ruolo</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {righe.map((u) => (
              <tr key={u.id}>
                <td className="p-3">
                  <span className="font-medium">{u.nome_visualizzato}</span>
                  <br />
                  <span className="text-xs text-muted-foreground">
                    {u.email} · {u.stato_account}
                  </span>
                </td>
                <td className="p-3">{u.totp_attivo ? "Sì" : "No"}</td>
                <td className="p-3">{u.id === io.id ? <span className="text-muted-foreground">Tu</span> : <FormRuolo idUtente={u.id} idRuolo={u.id_ruolo} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
