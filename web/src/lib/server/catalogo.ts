import "server-only";
import { cache } from "react";
import { db } from "./db";
import { nomeQuartiere } from "../formato";

export interface Quartiere {
  id: number;
  nome: string;
  idMunicipio: number;
}

export const elencoQuartieri = cache(async (): Promise<Quartiere[]> => {
  const righe = await db.righe<{ id: number; nome: string; id_municipio: number }>(
    "SELECT id, nome, id_municipio FROM quartiere WHERE attivo ORDER BY nome",
  );
  return righe.map((q) => ({ id: q.id, nome: nomeQuartiere(q.nome), idMunicipio: q.id_municipio }));
});

export const elencoMunicipi = cache(async () =>
  db.righe<{ id: number; nome: string }>("SELECT id, nome FROM municipio ORDER BY id"),
);

export interface Categoria {
  id: number;
  nome: string;
  descrizione: string;
  colore: string;
}

export const elencoCategorie = cache(async (soloAttive = true): Promise<Categoria[]> => {
  const righe = await db.righe<{ id: number; nome: string; descrizione: string; colore_mappa: string }>(
    `SELECT id, nome, descrizione, colore_mappa FROM categoria ${soloAttive ? "WHERE attiva" : ""} ORDER BY ordine, nome`,
  );
  return righe.map((k) => ({ id: k.id, nome: k.nome, descrizione: k.descrizione, colore: k.colore_mappa }));
});
