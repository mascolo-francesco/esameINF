/** "LORETO - CASORETTO - NOLO" -> "Loreto - Casoretto - Nolo". I nomi dei NIL sono tutti maiuscoli. */
export function nomeQuartiere(nome: string): string {
  return nome
    .toLowerCase()
    .replace(/(^|[\s\-'(./])(\p{L})/gu, (_, sep: string, l: string) => sep + l.toUpperCase())
    .replace(/\bQ\.Re\b/g, "Q.re")
    .replace(/\bP\.Ta\b/g, "P.ta")
    // nei dati del Comune l'accento finale è un apostrofo: "Citta' Studi" -> "Città Studi"
    .replace(/([aeiou])'(?=$|[\s\-),.])/g, (_, v: string) => ({ a: "à", e: "è", i: "ì", o: "ò", u: "ù" })[v]!);
}

const dataOra = new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Rome" });
const data = new Intl.DateTimeFormat("it-IT", { dateStyle: "long", timeZone: "Europe/Rome" });

export const formattaDataOra = (d: Date | string) => dataOra.format(new Date(d));
export const formattaData = (d: Date | string) => data.format(new Date(d));

const relativo = new Intl.RelativeTimeFormat("it", { numeric: "auto" });

export function tempoFa(d: Date | string): string {
  const s = (new Date(d).getTime() - Date.now()) / 1000;
  const passi: [number, Intl.RelativeTimeFormatUnit][] = [
    [60, "second"],
    [60, "minute"],
    [24, "hour"],
    [30, "day"],
    [12, "month"],
  ];
  let v = s;
  for (const [n, unita] of passi) {
    if (Math.abs(v) < n) return relativo.format(Math.round(v), unita);
    v /= n;
  }
  return relativo.format(Math.round(v), "year");
}

export const formattaNumero = (n: number, cifre = 0) =>
  new Intl.NumberFormat("it-IT", { maximumFractionDigits: cifre, minimumFractionDigits: cifre }).format(n);
