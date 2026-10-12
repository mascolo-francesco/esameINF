/** IP del client: su Vercel arriva come primo valore di x-forwarded-for. */
export function ipRichiesta(h: Headers): string | null {
  const xff = h.get("x-forwarded-for");
  const ip = xff?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
  return ip ? ip.slice(0, 45) : null;
}
