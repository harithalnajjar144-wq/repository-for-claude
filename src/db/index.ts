import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { pool?: Pool };

const pool =
  globalForDb.pool ??
  new Pool({
    connectionString: process.env.DATABASE_URL ?? "postgres://halali:halali@localhost:5432/halali",
    max: 10,
  });
if (process.env.NODE_ENV !== "production") globalForDb.pool = pool;

export const db = drizzle(pool, { schema });
export type DB = NodePgDatabase<typeof schema>;
// A transaction handle has the same query API as the db.
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
export { pool };
