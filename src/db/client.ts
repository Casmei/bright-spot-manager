import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

let db: PostgresJsDatabase<typeof schema> | undefined;

/* Server only: opens the connection pool on first use. */
export function getDb() {
  if (!db) {
    const url = process.env["DATABASE_URL"];
    if (!url) throw new Error("Banco de dados não configurado (DATABASE_URL)");
    db = drizzle(postgres(url), { schema });
  }
  return db;
}
