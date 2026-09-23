import { Pool, types, type QueryResultRow } from "pg";

// Return DATE columns as 'YYYY-MM-DD' strings instead of local-time JS Dates.
types.setTypeParser(1082, (v) => v);

const globalForPg = globalThis as unknown as { pgPool?: Pool };

export const pool =
  globalForPg.pgPool ?? new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });

if (process.env.NODE_ENV !== "production") globalForPg.pgPool = pool;

export async function query<T extends QueryResultRow>(text: string, params: unknown[] = []) {
  const res = await pool.query<T>(text, params);
  return res.rows;
}
