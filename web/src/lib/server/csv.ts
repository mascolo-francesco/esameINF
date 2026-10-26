/**
 * Una cella del CSV con separatore ";". I testi dei cittadini che iniziano con = + - @ (o con un
 * tab o un a capo) Excel li eseguirebbe come formule: li faccio precedere da un apice, che li
 * lascia testo (CSV injection, OWASP). I numeri restano numeri.
 */
export function cellaCsv(v: unknown): string {
  if (v == null) return "";
  let s = String(v);
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[";\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}
