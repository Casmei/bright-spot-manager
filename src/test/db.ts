/* Integration tests run against the dev Postgres, each inside a transaction that is rolled back. */
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";

const url = process.env["DATABASE_URL"];
const client = url ? postgres(url, { max: 1, onnotice: () => {} }) : null;

/* Tests are skipped when there is no database to talk to (e.g. CI without Docker). */
export const dbAvailable = client
  ? await client`select 1`.then(
      () => true,
      () => false,
    )
  : false;

const db = client ? drizzle(client, { schema }) : null;

export type TestDb = Parameters<Parameters<PostgresJsDatabase<typeof schema>["transaction"]>[0]>[0];

class Rollback extends Error {}

export async function withRollback(fn: (tx: TestDb) => Promise<void>) {
  if (!db) throw new Error("DATABASE_URL não definida");
  await db
    .transaction(async (tx) => {
      await fn(tx);
      throw new Rollback();
    })
    .catch((err: unknown) => {
      if (!(err instanceof Rollback)) throw err;
    });
}

export async function insertTestReport(tx: TestDb) {
  const [row] = await tx
    .insert(schema.reports)
    .values({
      type: "buraco",
      name: "Teste",
      whatsapp: "(33) 99999-0000",
      address: "Rua de Teste, 1 - Centro, Almenara - MG",
      lat: -16.18,
      lng: -40.69,
    })
    .returning({ id: schema.reports.id });
  if (!row) throw new Error("Falha ao inserir denúncia de teste");
  return row.id;
}

export async function closeTestDb() {
  await client?.end();
}
