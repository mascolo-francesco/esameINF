import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/server/db";
import { LIVELLO, richiediUtente } from "@/lib/server/auth/sessione";
import { formattaDataOra } from "@/lib/formato";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = { title: "Registro di audit" };

const PER_PAGINA = 50;

const json = (v: unknown) => (v == null ? "" : typeof v === "string" ? v : JSON.stringify(v));

type Valori = Record<string, unknown>;
const oggetto = (v: unknown): Valori | null => {
  const o = typeof v === "string" ? (() => { try { return JSON.parse(v); } catch { return null; } })() : v;
  return o && typeof o === "object" && !Array.isArray(o) ? (o as Valori) : null;
};
// "PRESA_IN_CARICO" diventa "presa in carico"; i valori vuoti un trattino
const leggibile = (v: unknown) =>
  v == null || v === ""
    ? "—"
    : typeof v === "string"
      ? /^[A-Z_]+$/.test(v)
        ? v.replaceAll("_", " ").toLowerCase()
        : v
      : JSON.stringify(v);

/** Prima e dopo come elenco dei soli campi cambiati, uno per riga: "stato: pubblicata → presa in carico". */
function Modifiche({ prima, dopo }: { prima: unknown; dopo: unknown }) {
  const p = oggetto(prima);
  const d = oggetto(dopo);
  if ((prima != null && !p) || (dopo != null && !d)) {
    return <>{json(prima)} {prima != null && dopo != null && "→"} {json(dopo)}</>;
  }
  const campi = [...new Set([...Object.keys(p ?? {}), ...Object.keys(d ?? {})])].filter(
    (k) => JSON.stringify(p?.[k] ?? null) !== JSON.stringify(d?.[k] ?? null),
  );
  if (campi.length === 0) return <>—</>;
  return (
    <ul className="grid gap-1">
      {campi.map((k) => (
        <li key={k}>
          <span className="text-foreground">{k.replaceAll("_", " ")}</span>:{" "}
          {p?.[k] != null && <>{leggibile(p[k])} → </>}
          {d ? leggibile(d[k]) : "eliminato"}
        </li>
      ))}
    </ul>
  );
}

// RF-46: query registro_audit (in sola lettura: i trigger impediscono modifiche e cancellazioni)
export default async function Audit({ searchParams }: PageProps<"/admin/audit">) {
  await richiediUtente(LIVELLO.amministratore, "/admin/audit");
  const { pagina: p } = await searchParams;
  const pagina = Math.max(1, Math.min(1000, Number(p) || 1));
  const righe = await db.righe<{
    id: number;
    data_ora: Date;
    azione: string;
    tipo_oggetto: string;
    id_oggetto: string;
    valori_prima: unknown;
    valori_dopo: unknown;
    indirizzo_ip: string | null;
    utente: string | null;
  }>(
    `SELECT a.id, a.data_ora, a.azione, a.tipo_oggetto, a.id_oggetto, a.valori_prima, a.valori_dopo, a.indirizzo_ip,
            u.nome_visualizzato AS utente
       FROM audit_log a LEFT JOIN utente u ON u.id = a.id_utente
      ORDER BY a.id DESC LIMIT ? OFFSET ?`,
    [String(PER_PAGINA + 1), String((pagina - 1) * PER_PAGINA)],
  );
  const altre = righe.length > PER_PAGINA;
  return (
    <div className="grid gap-4">
      {/* sui telefoni la tabella scorre: con tabIndex si può scorrere anche da tastiera */}
      <div className="overflow-x-auto rounded-xl border bg-card shadow-card" tabIndex={0} role="region" aria-label="Registro di audit">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th scope="col" className="p-2 font-medium">Quando</th>
              <th scope="col" className="p-2 font-medium">Chi</th>
              <th scope="col" className="p-2 font-medium">Azione</th>
              <th scope="col" className="p-2 font-medium">Oggetto</th>
              <th scope="col" className="p-2 font-medium">Prima → dopo</th>
            </tr>
          </thead>
          <tbody className="divide-y align-top">
            {righe.slice(0, PER_PAGINA).map((r) => (
              <tr key={r.id}>
                <td className="p-2 whitespace-nowrap">{formattaDataOra(r.data_ora)}</td>
                <td className="p-2">
                  {r.utente ?? "sistema"}
                  {r.indirizzo_ip && <span className="block font-mono text-xs text-muted-foreground">{r.indirizzo_ip}</span>}
                </td>
                <td className="p-2">{r.azione.replaceAll("_", " ")}</td>
                <td className="p-2 text-xs">
                  {r.tipo_oggetto.replaceAll("_", " ")} {r.id_oggetto}
                </td>
                <td className="max-w-md p-2 text-xs break-words text-muted-foreground">
                  <Modifiche prima={r.valori_prima} dopo={r.valori_dopo} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <nav aria-label="Pagine" className="flex justify-between">
        {pagina > 1 ? (
          <Link href={`/admin/audit?pagina=${pagina - 1}`} className={buttonVariants({ variant: "outline" })}>
            ← Più recenti
          </Link>
        ) : (
          <span />
        )}
        {altre && (
          <Link href={`/admin/audit?pagina=${pagina + 1}`} className={buttonVariants({ variant: "outline" })}>
            Meno recenti →
          </Link>
        )}
      </nav>
    </div>
  );
}
