import mysql, { type Pool, type PoolConnection, type RowDataPacket } from "mysql2/promise";
import { AIVEN_CA } from "./aiven-ca";
import { traduciErroreDb } from "./errori";

// Un solo pool per processo: in sviluppo Next ricarica i moduli, quindi lo tengo su globalThis.
const g = globalThis as unknown as { lncPool?: Pool };

function creaPool(): Pool {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL non impostata");
  const u = new URL(url);
  return mysql.createPool({
    host: u.hostname,
    port: Number(u.port || 3306),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.slice(1),
    ssl: { ca: AIVEN_CA },
    charset: "utf8mb4",
    timezone: "Z", // il server Aiven lavora in UTC
    decimalNumbers: true,
    connectionLimit: 5,
    maxIdle: 2,
    idleTimeout: 60_000,
    enableKeepAlive: true,
  });
}

export function pool(): Pool {
  g.lncPool ??= creaPool();
  return g.lncPool;
}

type Param = string | number | boolean | Date | Buffer | null;

/** Esecutore comune a pool e connessione in transazione. */
export interface Db {
  righe<T>(sql: string, params?: Param[]): Promise<T[]>;
  riga<T>(sql: string, params?: Param[]): Promise<T | null>;
  esegui(sql: string, params?: Param[]): Promise<{ insertId: number; affectedRows: number }>;
}

function esecutore(c: Pool | PoolConnection): Db {
  return {
    async righe<T>(sql: string, params: Param[] = []) {
      try {
        const [rows] = await c.execute<RowDataPacket[]>(sql, params);
        return rows as T[];
      } catch (e) {
        throw traduciErroreDb(e);
      }
    },
    async riga<T>(sql: string, params: Param[] = []) {
      const rows = await this.righe<T>(sql, params);
      return rows[0] ?? null;
    },
    async esegui(sql: string, params: Param[] = []) {
      try {
        const [r] = await c.execute(sql, params);
        const h = r as mysql.ResultSetHeader;
        return { insertId: h.insertId, affectedRows: h.affectedRows };
      } catch (e) {
        throw traduciErroreDb(e);
      }
    },
  };
}

/** Letture e scritture singole (che non toccano tabelle con audit). */
export const db: Db = {
  righe: (sql, params) => esecutore(pool()).righe(sql, params),
  riga: (sql, params) => esecutore(pool()).riga(sql, params),
  esegui: (sql, params) => esecutore(pool()).esegui(sql, params),
};

export interface Attore {
  idUtente: number | null;
  ip: string | null;
}

/**
 * Esegue fn in una transazione. Prima imposta @lnc_id_utente e @lnc_ip sulla stessa
 * connessione: i trigger li leggono per scrivere il registro di audit (RF-46).
 * Alla fine li azzera, così una connessione riusata dal pool non si porta dietro l'utente.
 */
export async function inTransazione<T>(attore: Attore, fn: (tx: Db) => Promise<T>): Promise<T> {
  const conn = await pool().getConnection();
  try {
    await conn.query("SET @lnc_id_utente = ?, @lnc_ip = ?", [attore.idUtente, attore.ip]);
    await conn.beginTransaction();
    const risultato = await fn(esecutore(conn));
    await conn.commit();
    return risultato;
  } catch (e) {
    await conn.rollback().catch(() => {});
    throw traduciErroreDb(e);
  } finally {
    await conn.query("SET @lnc_id_utente = NULL, @lnc_ip = NULL").catch(() => {});
    conn.release();
  }
}
