# "Me afeta também" — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Um botão "Me afeta também" em cada denúncia (card da lista e modal), sem login, com um contador de pessoas afetadas que também aparece na mensagem do WhatsApp.

**Architecture:** Uma tabela `report_affected` (PK `report_id, voter_id`) guarda uma marca por visitante anônimo. O visitante é identificado por um cookie `httpOnly` gerado pelo servidor, e um hash HMAC do IP impõe um limite brando por rede. A regra de negócio fica em funções que recebem o `db` (testáveis contra o Postgres), e as server functions só cuidam de cookie, IP e validação. O loader da lista já devolve a contagem e o "já marquei", e um provider React sincroniza card e modal com atualização otimista.

**Tech Stack:** TanStack Start 1.168 (server functions, `@tanstack/react-start/server`), Drizzle ORM 0.45 + postgres.js, Postgres 17, zod 3, React 19, Tailwind 4, lucide-react, Vitest (novo), Bun 1.3.

**Spec:** `docs/superpowers/specs/2026-09-24-me-afeta-tambem-design.md`

## Global Constraints

- Identificadores em inglês, textos da interface em português com acentuação correta.
- Cookie: nome `vigia_voter`, UUID, `httpOnly`, `SameSite=Lax`, `Secure` só com `NODE_ENV=production`, `path=/`, `maxAge` de 1 ano. Criado só quando a pessoa marca ou denuncia.
- `ip_hash = HMAC-SHA256(ip, AFFECTED_IP_SECRET)` em hex. O IP em claro nunca é gravado nem registrado no log.
- IP do cliente: **último** item não vazio de `X-Forwarded-For`, senão o IP da conexão, senão `"unknown"`.
- `AFFECTED_IP_SECRET`: obrigatória com `NODE_ENV=production`, fora disso o padrão é `"dev-secret"`. `AFFECTED_MAX_PER_IP`: inteiro positivo, padrão `3`.
- Nome e WhatsApp do autor nunca entram em consultas públicas.
- `setAffected` recebe o estado **desejado** (`affected: boolean`), nunca um toggle.
- A frase no WhatsApp só aparece com `affectedCount >= 2`.
- Verificação de cada tarefa: `bun run test`, `bun run lint` e `bunx tsc --noEmit` passando.
- O Postgres de desenvolvimento precisa estar no ar para os testes de integração: `docker compose -f docker-compose.dev.yml up -d` (porta 5433, `DATABASE_URL` no `.env`).

## Review Focus

- `X-Forwarded-For` forjado pelo cliente (`"1.2.3.4, <ip real>"`) → o limite usa o IP real (último item), não o forjado. Coberto na Task 2.
- Desmarcar depois de a rede atingir o limite → sempre funciona, e o número cai. Coberto na Task 3.
- Cookie `vigia_voter` adulterado (`"abc"`, `"'; drop"`) → tratado como ausente, sem erro 500 e sem ser passado à consulta. Coberto nas Tasks 2 e 4.
- Denúncia com 0 marcas numa lista em que outras têm marcas → aparece com `0`/`false`, não some do `LEFT JOIN`. Coberto na Task 4.
- Resposta de um clique antigo chegando depois de um clique novo → ignorada, e o botão fica no estado do último clique. Garantido pelo número de sequência na Task 6 e checado no roteiro manual da Task 7.

---

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `vitest.config.ts` (novo) | Runner de testes: alias `@`, carrega `.env` |
| `src/test/db.ts` (novo) | Conexão de teste, `withRollback`, `insertTestReport`, `dbAvailable` |
| `src/db/schema.ts` | + tabela `reportAffected` |
| `drizzle/0001_*.sql` (gerado) | Migração da tabela |
| `src/lib/voter.ts` (novo) | Funções puras: `parseVoterId`, `pickClientIp`, `ipSecret`, `hashIp`, `maxPerIp`, `VOTER_COOKIE` |
| `src/lib/voter-request.ts` (novo) | Ligado ao request: `readVoterId`, `ensureVoterId`, `requestIpHash` |
| `src/lib/affected.ts` (novo) | Regra de negócio com `db`: `markAffected`, `unmarkAffected`, `insertAuthorMark`, `affectedSummary`, erros |
| `src/lib/public-reports.ts` (novo) | `selectPublicReports(db, voterId)`: lista pública com contagem |
| `src/lib/affected.functions.ts` (novo) | Server function `setAffected` |
| `src/lib/reports.functions.ts` | `createReport` insere a marca do autor, e `listPublicReports` usa `selectPublicReports` |
| `src/lib/reports.ts` | Tipo `PublicReport` + textos (`affectedPeople`, `affectedSentence`, `affectedAriaLabel`, `shareMessage`) e mensagens de erro |
| `src/lib/use-affected.tsx` (novo) | `AffectedProvider` + `useAffected` (otimista, sequência) |
| `src/components/AffectedButton.tsx` (novo) | Botão nas variantes `compact` e `full` |
| `src/routes/denuncias.tsx` | Provider, card reorganizado com o botão |
| `src/components/ReportDialog.tsx` | Botão `full` + contagem no WhatsApp |
| `scripts/seed.ts` | Afetados de exemplo |
| `.env.example`, `docker-compose.yml`, `docs/deploy-coolify.md` | Novas variáveis |

---

### Task 1: Vitest + tabela `report_affected`

**Files:**
- Create: `vitest.config.ts`
- Create: `src/test/db.ts`
- Create: `src/db/schema.test.ts`
- Modify: `src/db/schema.ts`
- Modify: `package.json` (script `test`, dev dependency `vitest`)
- Generated: `drizzle/0001_*.sql`, `drizzle/meta/*`

**Interfaces:**
- Produces:
  - `reportAffected` (tabela Drizzle) com colunas `reportId`, `voterId`, `ipHash`, `createdAt`.
  - `src/test/db.ts`: `dbAvailable: boolean`, `withRollback(fn: (tx: TestDb) => Promise<void>): Promise<void>`, `insertTestReport(tx: TestDb): Promise<string>` (devolve o `id`), `closeTestDb(): Promise<void>`, `type TestDb`.

- [ ] **Step 1: Instalar o Vitest e criar o script**

Run: `bun add -d vitest`

Em `package.json`, dentro de `"scripts"`, adicione depois de `"format"`:

```json
    "test": "vitest run",
```

- [ ] **Step 2: Criar `vitest.config.ts`**

```ts
import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // DATABASE_URL for the integration tests comes from .env, like the db:* scripts
    env: loadEnv("test", process.cwd(), ""),
  },
});
```

- [ ] **Step 3: Criar o helper `src/test/db.ts`**

```ts
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
```

- [ ] **Step 4: Escrever o teste da tabela (vai falhar)**

`src/db/schema.test.ts`:

```ts
import { afterAll, describe, expect, it } from "vitest";
import { count, eq } from "drizzle-orm";
import { reportAffected, reports } from "@/db/schema";
import { closeTestDb, dbAvailable, insertTestReport, withRollback } from "@/test/db";

afterAll(closeTestDb);

describe.skipIf(!dbAvailable)("report_affected", () => {
  it("accepts one mark per voter per report", async () => {
    await withRollback(async (tx) => {
      const reportId = await insertTestReport(tx);
      const voterId = crypto.randomUUID();
      await tx.insert(reportAffected).values({ reportId, voterId, ipHash: "h" });
      await tx.insert(reportAffected).values({ reportId, voterId, ipHash: "h" }).onConflictDoNothing();
      const [row] = await tx
        .select({ total: count() })
        .from(reportAffected)
        .where(eq(reportAffected.reportId, reportId));
      expect(row?.total).toBe(1);
    });
  });

  it("drops the marks when the report is deleted", async () => {
    await withRollback(async (tx) => {
      const reportId = await insertTestReport(tx);
      await tx.insert(reportAffected).values({ reportId, voterId: crypto.randomUUID(), ipHash: "h" });
      await tx.delete(reports).where(eq(reports.id, reportId));
      const [row] = await tx
        .select({ total: count() })
        .from(reportAffected)
        .where(eq(reportAffected.reportId, reportId));
      expect(row?.total).toBe(0);
    });
  });
});
```

- [ ] **Step 5: Rodar e ver falhar**

Run: `docker compose -f docker-compose.dev.yml up -d && bun run test`
Expected: FAIL. O TypeScript/Vitest acusa que `reportAffected` não é exportado por `@/db/schema`.

- [ ] **Step 6: Adicionar a tabela em `src/db/schema.ts`**

Troque o import do `drizzle-orm/pg-core` por:

```ts
import {
  customType,
  doublePrecision,
  index,
  integer,
  pgSequence,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
```

E acrescente no fim do arquivo:

```ts
/* "Me afeta também": one mark per anonymous visitor (cookie) per report. The IP is only kept as an HMAC. */
export const reportAffected = pgTable(
  "report_affected",
  {
    reportId: uuid("report_id")
      .notNull()
      .references(() => reports.id, { onDelete: "cascade" }),
    voterId: uuid("voter_id").notNull(),
    ipHash: text("ip_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.reportId, t.voterId] }), index().on(t.reportId, t.ipHash)],
);
```

- [ ] **Step 7: Gerar e aplicar a migração**

Run: `bun run db:generate && bun run db:migrate`
Expected: surge `drizzle/0001_<nome>.sql` com `CREATE TABLE "report_affected"`, `PRIMARY KEY("report_id","voter_id")`, a FK `ON DELETE cascade` e o `CREATE INDEX`. O migrate imprime `Migrations aplicadas.`

- [ ] **Step 8: Rodar e ver passar**

Run: `bun run test && bun run lint && bunx tsc --noEmit`
Expected: 2 testes PASS, e lint e tsc limpos.

- [ ] **Step 9: Commit**

```bash
git add package.json bun.lock vitest.config.ts src/test/db.ts src/db/schema.ts src/db/schema.test.ts drizzle
git commit -m "Tabela report_affected e Vitest com testes contra o Postgres de desenvolvimento"
```

---

### Task 2: Identidade do visitante e hash do IP

**Files:**
- Create: `src/lib/voter.ts`
- Create: `src/lib/voter.test.ts`
- Create: `src/lib/voter-request.ts`
- Modify: `.env.example`, `docker-compose.yml`, `docs/deploy-coolify.md`

**Interfaces:**
- Produces (`src/lib/voter.ts`, puro):
  - `VOTER_COOKIE = "vigia_voter"`
  - `parseVoterId(value: string | undefined): string | null`
  - `pickClientIp(forwardedFor: string | undefined, socketIp: string | undefined): string`
  - `ipSecret(env: Record<string, string | undefined>): string` (lança em produção sem segredo)
  - `hashIp(ip: string, secret: string): string` (hex de 64 caracteres)
  - `maxPerIp(env: Record<string, string | undefined>): number`
- Produces (`src/lib/voter-request.ts`, só no servidor, dentro de handlers):
  - `readVoterId(): string | null`
  - `ensureVoterId(): string`
  - `requestIpHash(): string`

- [ ] **Step 1: Escrever os testes (vão falhar)**

`src/lib/voter.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { hashIp, ipSecret, maxPerIp, parseVoterId, pickClientIp } from "@/lib/voter";

describe("parseVoterId", () => {
  it("accepts a UUID and normalises it to lower case", () => {
    expect(parseVoterId("3F2504E0-4F89-41D3-9A0C-0305E82C3301")).toBe(
      "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
    );
  });

  it.each([undefined, "", "abc", "'; drop table reports; --", "3f2504e0-4f89-41d3-9a0c"])(
    "treats %j as no visitor",
    (value) => {
      expect(parseVoterId(value)).toBeNull();
    },
  );
});

describe("pickClientIp", () => {
  it("uses the last X-Forwarded-For entry, the one our proxy appended", () => {
    expect(pickClientIp("1.2.3.4, 200.10.20.30", "10.0.0.2")).toBe("200.10.20.30");
  });

  it("ignores blanks and spaces", () => {
    expect(pickClientIp(" 200.10.20.30 , ", "10.0.0.2")).toBe("200.10.20.30");
  });

  it("falls back to the connection address without the header", () => {
    expect(pickClientIp(undefined, "10.0.0.2")).toBe("10.0.0.2");
    expect(pickClientIp("", "10.0.0.2")).toBe("10.0.0.2");
  });

  it("returns 'unknown' when nothing is available", () => {
    expect(pickClientIp(undefined, undefined)).toBe("unknown");
  });
});

describe("hashIp", () => {
  it("is deterministic and never contains the IP", () => {
    const hash = hashIp("200.10.20.30", "s1");
    expect(hash).toBe(hashIp("200.10.20.30", "s1"));
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain("200");
  });

  it("changes with the secret", () => {
    expect(hashIp("200.10.20.30", "s1")).not.toBe(hashIp("200.10.20.30", "s2"));
  });
});

describe("ipSecret", () => {
  it("uses the configured secret", () => {
    expect(ipSecret({ AFFECTED_IP_SECRET: "abc", NODE_ENV: "production" })).toBe("abc");
  });

  it("has a default outside production", () => {
    expect(ipSecret({ NODE_ENV: "development" })).toBe("dev-secret");
  });

  it("refuses to run in production without a secret", () => {
    expect(() => ipSecret({ NODE_ENV: "production" })).toThrow(/AFFECTED_IP_SECRET/);
  });
});

describe("maxPerIp", () => {
  it("defaults to 3", () => {
    expect(maxPerIp({})).toBe(3);
  });

  it("reads a positive integer", () => {
    expect(maxPerIp({ AFFECTED_MAX_PER_IP: "5" })).toBe(5);
  });

  it.each(["0", "-2", "abc", "2.5", ""])("ignores the invalid value %j", (value) => {
    expect(maxPerIp({ AFFECTED_MAX_PER_IP: value })).toBe(3);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `bun run test src/lib/voter.test.ts`
Expected: FAIL com "Failed to resolve import "@/lib/voter"".

- [ ] **Step 3: Implementar `src/lib/voter.ts`**

```ts
/* Anonymous visitor identity for "Me afeta também". Pure helpers: no request access here. */
import { createHmac } from "node:crypto";

export const VOTER_COOKIE = "vigia_voter";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_MAX_PER_IP = 3;

type Env = Record<string, string | undefined>;

/* A tampered cookie is just "no visitor": it never reaches a query. */
export function parseVoterId(value: string | undefined) {
  return value && UUID_PATTERN.test(value) ? value.toLowerCase() : null;
}

/* Coolify's proxy appends the real address, so the last entry is the trustworthy one. */
export function pickClientIp(forwardedFor: string | undefined, socketIp: string | undefined) {
  const entries = (forwardedFor ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  return entries.at(-1) ?? socketIp ?? "unknown";
}

export function ipSecret(env: Env) {
  const secret = env["AFFECTED_IP_SECRET"];
  if (secret) return secret;
  if (env["NODE_ENV"] === "production") throw new Error("AFFECTED_IP_SECRET não configurado");
  return "dev-secret";
}

/* Keyed hash: a plain sha256 of an IPv4 could be reversed by trying every address. */
export function hashIp(ip: string, secret: string) {
  return createHmac("sha256", secret).update(ip).digest("hex");
}

export function maxPerIp(env: Env) {
  const value = Number(env["AFFECTED_MAX_PER_IP"]);
  return Number.isInteger(value) && value > 0 ? value : DEFAULT_MAX_PER_IP;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `bun run test src/lib/voter.test.ts`
Expected: PASS em todos.

- [ ] **Step 5: Implementar `src/lib/voter-request.ts`**

É um código fino sobre a API do request, sem teste unitário: ele é exercitado pelo roteiro manual da Task 7.

```ts
/* Request-bound side of the visitor identity. Only call inside server function handlers. */
import {
  getCookie,
  getRequestHeader,
  getRequestIP,
  setCookie,
} from "@tanstack/react-start/server";
import { VOTER_COOKIE, hashIp, ipSecret, parseVoterId, pickClientIp } from "@/lib/voter";

const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365;

export function readVoterId() {
  return parseVoterId(getCookie(VOTER_COOKIE));
}

/* Created on the first action, never on a plain visit; each action renews it for a year. */
export function ensureVoterId() {
  const voterId = readVoterId() ?? crypto.randomUUID();
  setCookie(VOTER_COOKIE, voterId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env["NODE_ENV"] === "production",
    path: "/",
    maxAge: ONE_YEAR_IN_SECONDS,
  });
  return voterId;
}

export function requestIpHash() {
  const ip = pickClientIp(getRequestHeader("x-forwarded-for"), getRequestIP());
  return hashIp(ip, ipSecret(process.env));
}
```

- [ ] **Step 6: Documentar as variáveis**

Em `.env.example`, acrescente no fim:

```
# "Me afeta também": segredo do hash do IP (obrigatório em produção) e limite de marcas por rede em cada denúncia
AFFECTED_IP_SECRET=
AFFECTED_MAX_PER_IP=3
```

Em `docker-compose.yml`, no `environment` do serviço `app`, depois de `GOOGLE_MAPS_API_KEY`:

```yaml
      AFFECTED_IP_SECRET: ${AFFECTED_IP_SECRET:?defina AFFECTED_IP_SECRET}
      AFFECTED_MAX_PER_IP: ${AFFECTED_MAX_PER_IP:-3}
```

Em `docs/deploy-coolify.md`, na tabela da seção "Rodar tudo localmente como em produção", depois da linha `GOOGLE_MAPS_API_KEY`:

```
| `AFFECTED_IP_SECRET` | runtime (obrigatória) | segredo do hash do IP no "Me afeta também". Gere com `openssl rand -hex 32`; trocar só zera o limite por rede |
| `AFFECTED_MAX_PER_IP` | runtime (opcional) | quantas pessoas da mesma rede podem marcar a mesma denúncia (padrão 3) |
```

E, na tabela do passo "2. App → Environment Variables", depois da linha `GOOGLE_MAPS_API_KEY`:

```
   | `AFFECTED_IP_SECRET` | runtime | `openssl rand -hex 32` |
   | `AFFECTED_MAX_PER_IP` | runtime (opcional) | padrão `3` |
```

- [ ] **Step 7: Verificar e fazer o commit**

Run: `bun run test && bun run lint && bunx tsc --noEmit`
Expected: tudo verde.

```bash
git add src/lib/voter.ts src/lib/voter.test.ts src/lib/voter-request.ts .env.example docker-compose.yml docs/deploy-coolify.md
git commit -m "Identidade anônima por cookie e hash HMAC do IP para o \"Me afeta também\""
```

---

### Task 3: Regra de negócio das marcas

**Files:**
- Create: `src/lib/affected.ts`
- Create: `src/lib/affected.test.ts`

**Interfaces:**
- Consumes: `reportAffected`, `reports` (Task 1); `withRollback`, `insertTestReport`, `dbAvailable`, `closeTestDb` (Task 1).
- Produces:
  - `type Db = PgDatabase<PostgresJsQueryResultHKT, typeof schema>` (aceita tanto `getDb()` quanto uma transação)
  - `class AffectedLimitError extends Error`, `class ReportNotFoundError extends Error`
  - `markAffected(db: Db, mark: { reportId: string; voterId: string; ipHash: string; maxPerIp: number }): Promise<void>`
  - `unmarkAffected(db: Db, mark: { reportId: string; voterId: string }): Promise<void>`
  - `insertAuthorMark(db: Db, mark: { reportId: string; voterId: string; ipHash: string }): Promise<void>`
  - `affectedSummary(db: Db, query: { reportId: string; voterId: string | null }): Promise<{ affectedCount: number; affectedByMe: boolean }>`

- [ ] **Step 1: Escrever os testes (vão falhar)**

`src/lib/affected.test.ts`:

```ts
import { afterAll, describe, expect, it } from "vitest";
import {
  AffectedLimitError,
  ReportNotFoundError,
  affectedSummary,
  insertAuthorMark,
  markAffected,
  unmarkAffected,
} from "@/lib/affected";
import { closeTestDb, dbAvailable, insertTestReport, withRollback } from "@/test/db";

afterAll(closeTestDb);

const voter = () => crypto.randomUUID();

describe.skipIf(!dbAvailable)("affected marks", () => {
  it("counts the same visitor once", async () => {
    await withRollback(async (tx) => {
      const reportId = await insertTestReport(tx);
      const voterId = voter();
      await markAffected(tx, { reportId, voterId, ipHash: "net-a", maxPerIp: 3 });
      await markAffected(tx, { reportId, voterId, ipHash: "net-a", maxPerIp: 3 });
      expect(await affectedSummary(tx, { reportId, voterId })).toEqual({
        affectedCount: 1,
        affectedByMe: true,
      });
    });
  });

  it("unmarks back to zero", async () => {
    await withRollback(async (tx) => {
      const reportId = await insertTestReport(tx);
      const voterId = voter();
      await markAffected(tx, { reportId, voterId, ipHash: "net-a", maxPerIp: 3 });
      await unmarkAffected(tx, { reportId, voterId });
      expect(await affectedSummary(tx, { reportId, voterId })).toEqual({
        affectedCount: 0,
        affectedByMe: false,
      });
    });
  });

  it("refuses a new visitor once the network reached the limit", async () => {
    await withRollback(async (tx) => {
      const reportId = await insertTestReport(tx);
      for (let i = 0; i < 3; i++) {
        await markAffected(tx, { reportId, voterId: voter(), ipHash: "net-a", maxPerIp: 3 });
      }
      await expect(
        markAffected(tx, { reportId, voterId: voter(), ipHash: "net-a", maxPerIp: 3 }),
      ).rejects.toBeInstanceOf(AffectedLimitError);
      // Another network is not affected by that limit
      await markAffected(tx, { reportId, voterId: voter(), ipHash: "net-b", maxPerIp: 3 });
      expect((await affectedSummary(tx, { reportId, voterId: null })).affectedCount).toBe(4);
    });
  });

  it("lets a visitor who already marked mark again at the limit (no-op)", async () => {
    await withRollback(async (tx) => {
      const reportId = await insertTestReport(tx);
      const first = voter();
      await markAffected(tx, { reportId, voterId: first, ipHash: "net-a", maxPerIp: 1 });
      await expect(
        markAffected(tx, { reportId, voterId: first, ipHash: "net-a", maxPerIp: 1 }),
      ).resolves.toBeUndefined();
    });
  });

  it("always lets someone unmark, even at the limit", async () => {
    await withRollback(async (tx) => {
      const reportId = await insertTestReport(tx);
      const voters = [voter(), voter(), voter()];
      for (const voterId of voters) {
        await markAffected(tx, { reportId, voterId, ipHash: "net-a", maxPerIp: 3 });
      }
      await unmarkAffected(tx, { reportId, voterId: voters[0]! });
      expect((await affectedSummary(tx, { reportId, voterId: null })).affectedCount).toBe(2);
    });
  });

  it("reports a missing report", async () => {
    await withRollback(async (tx) => {
      await expect(
        markAffected(tx, {
          reportId: crypto.randomUUID(),
          voterId: voter(),
          ipHash: "net-a",
          maxPerIp: 3,
        }),
      ).rejects.toBeInstanceOf(ReportNotFoundError);
    });
  });

  it("summarises without a visitor", async () => {
    await withRollback(async (tx) => {
      const reportId = await insertTestReport(tx);
      await markAffected(tx, { reportId, voterId: voter(), ipHash: "net-a", maxPerIp: 3 });
      expect(await affectedSummary(tx, { reportId, voterId: null })).toEqual({
        affectedCount: 1,
        affectedByMe: false,
      });
      expect(await affectedSummary(tx, { reportId, voterId: voter() })).toEqual({
        affectedCount: 1,
        affectedByMe: false,
      });
    });
  });

  it("inserts the author's mark ignoring the limit, and it counts for others", async () => {
    await withRollback(async (tx) => {
      const reportId = await insertTestReport(tx);
      await markAffected(tx, { reportId, voterId: voter(), ipHash: "net-a", maxPerIp: 1 });
      const author = voter();
      await insertAuthorMark(tx, { reportId, voterId: author, ipHash: "net-a" });
      expect(await affectedSummary(tx, { reportId, voterId: author })).toEqual({
        affectedCount: 2,
        affectedByMe: true,
      });
    });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `bun run test src/lib/affected.test.ts`
Expected: FAIL com "Failed to resolve import "@/lib/affected"".

- [ ] **Step 3: Implementar `src/lib/affected.ts`**

```ts
/* "Me afeta também" rules. Takes the db (or a transaction) so it can be tested without HTTP. */
import { and, count, eq, sql } from "drizzle-orm";
import type { PgDatabase } from "drizzle-orm/pg-core";
import type { PostgresJsQueryResultHKT } from "drizzle-orm/postgres-js";
import * as schema from "@/db/schema";
import { reportAffected, reports } from "@/db/schema";

export type Db = PgDatabase<PostgresJsQueryResultHKT, typeof schema>;

export class AffectedLimitError extends Error {
  constructor() {
    super("Limite de marcações por rede atingido");
    this.name = "AffectedLimitError";
  }
}

export class ReportNotFoundError extends Error {
  constructor() {
    super("Denúncia não encontrada");
    this.name = "ReportNotFoundError";
  }
}

type Mark = { reportId: string; voterId: string };

function sameMark(mark: Mark) {
  return and(eq(reportAffected.reportId, mark.reportId), eq(reportAffected.voterId, mark.voterId));
}

/* Check-then-insert is not atomic: two clicks from one network at once may pass the limit by one. That is fine for a soft limit. */
export async function markAffected(db: Db, mark: Mark & { ipHash: string; maxPerIp: number }) {
  const [report] = await db
    .select({ id: reports.id })
    .from(reports)
    .where(eq(reports.id, mark.reportId));
  if (!report) throw new ReportNotFoundError();

  const [existing] = await db
    .select({ voterId: reportAffected.voterId })
    .from(reportAffected)
    .where(sameMark(mark));
  if (existing) return;

  const [sameNetwork] = await db
    .select({ total: count() })
    .from(reportAffected)
    .where(and(eq(reportAffected.reportId, mark.reportId), eq(reportAffected.ipHash, mark.ipHash)));
  if ((sameNetwork?.total ?? 0) >= mark.maxPerIp) throw new AffectedLimitError();

  await db
    .insert(reportAffected)
    .values({ reportId: mark.reportId, voterId: mark.voterId, ipHash: mark.ipHash })
    .onConflictDoNothing();
}

export async function unmarkAffected(db: Db, mark: Mark) {
  await db.delete(reportAffected).where(sameMark(mark));
}

/* Whoever reports the problem is the first person affected; the network limit does not apply to them. */
export async function insertAuthorMark(db: Db, mark: Mark & { ipHash: string }) {
  await db
    .insert(reportAffected)
    .values({ reportId: mark.reportId, voterId: mark.voterId, ipHash: mark.ipHash })
    .onConflictDoNothing();
}

export async function affectedSummary(
  db: Db,
  query: { reportId: string; voterId: string | null },
) {
  const byMe = query.voterId
    ? sql<boolean>`coalesce(bool_or(${reportAffected.voterId} = ${query.voterId}::uuid), false)`
    : sql<boolean>`false`;
  const [row] = await db
    .select({ affectedCount: count(), affectedByMe: byMe })
    .from(reportAffected)
    .where(eq(reportAffected.reportId, query.reportId));
  return { affectedCount: row?.affectedCount ?? 0, affectedByMe: row?.affectedByMe ?? false };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `bun run test && bun run lint && bunx tsc --noEmit`
Expected: tudo PASS. A transação de teste (`TestDb`) é um `PgTransaction`, que estende `PgDatabase`, então ela é atribuível a `Db`. Se o `tsc` discordar, ajuste `TestDb` em `src/test/db.ts` para `Db` (importado de `@/lib/affected`) em vez de mudar a assinatura de `Db`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/affected.ts src/lib/affected.test.ts
git commit -m "Regras do \"Me afeta também\": marca única por visitante e limite brando por rede"
```

---

### Task 4: Lista pública com contagem, marca do autor e `setAffected`

**Files:**
- Create: `src/lib/public-reports.ts`
- Create: `src/lib/public-reports.test.ts`
- Create: `src/lib/affected.functions.ts`
- Modify: `src/lib/reports.ts` (tipo `PublicReport` e mensagens)
- Modify: `src/lib/reports.functions.ts`
- Modify: `scripts/seed.ts`

**Interfaces:**
- Consumes: `Db`, `markAffected`, `unmarkAffected`, `insertAuthorMark`, `affectedSummary`, `AffectedLimitError`, `ReportNotFoundError` (Task 3); `readVoterId`, `ensureVoterId`, `requestIpHash` (Task 2); `maxPerIp` (Task 2).
- Produces:
  - `PublicReport` ganha `affectedCount: number; affectedByMe: boolean`.
  - `selectPublicReports(db: Db, voterId: string | null): Promise<PublicReport[]>`
  - `AFFECTED_LIMIT_MESSAGE`, `AFFECTED_NOT_FOUND_MESSAGE`, `AFFECTED_ERROR_MESSAGE` (strings, em `src/lib/reports.ts`)
  - `type SetAffectedResult = { ok: true; affectedCount: number; affectedByMe: boolean } | { ok: false; message: string }`
  - `setAffected` (server function, `POST`), entrada `{ reportId: string; affected: boolean }`, saída `SetAffectedResult`.

- [ ] **Step 1: Estender o tipo e as mensagens em `src/lib/reports.ts`**

No tipo `PublicReport`, depois de `photoUrl: string;`:

```ts
  /* "Me afeta também": how many people marked it, and whether this visitor did. */
  affectedCount: number;
  affectedByMe: boolean;
```

E acrescente depois de `photoUrl()`, no fim do arquivo:

```ts
export const AFFECTED_LIMIT_MESSAGE =
  "Muitas pessoas já marcaram esta denúncia a partir da mesma rede. Tente mais tarde por outra conexão.";
export const AFFECTED_NOT_FOUND_MESSAGE = "Denúncia não encontrada.";
export const AFFECTED_ERROR_MESSAGE = "Não foi possível registrar agora. Tente de novo.";
```

- [ ] **Step 2: Escrever o teste da lista (vai falhar)**

`src/lib/public-reports.test.ts`:

```ts
import { afterAll, describe, expect, it } from "vitest";
import { insertAuthorMark } from "@/lib/affected";
import { selectPublicReports } from "@/lib/public-reports";
import { closeTestDb, dbAvailable, insertTestReport, withRollback } from "@/test/db";

afterAll(closeTestDb);

describe.skipIf(!dbAvailable)("selectPublicReports", () => {
  it("counts marks per report and flags the visitor's own", async () => {
    await withRollback(async (tx) => {
      const marked = await insertTestReport(tx);
      const empty = await insertTestReport(tx);
      const me = crypto.randomUUID();
      await insertAuthorMark(tx, { reportId: marked, voterId: me, ipHash: "a" });
      await insertAuthorMark(tx, { reportId: marked, voterId: crypto.randomUUID(), ipHash: "b" });

      const mine = await selectPublicReports(tx, me);
      expect(mine.find((r) => r.id === marked)).toMatchObject({
        affectedCount: 2,
        affectedByMe: true,
      });
      expect(mine.find((r) => r.id === empty)).toMatchObject({
        affectedCount: 0,
        affectedByMe: false,
      });

      const anonymous = await selectPublicReports(tx, null);
      expect(anonymous.find((r) => r.id === marked)).toMatchObject({
        affectedCount: 2,
        affectedByMe: false,
      });
    });
  });

  it("never exposes the reporter's name or WhatsApp", async () => {
    await withRollback(async (tx) => {
      const id = await insertTestReport(tx);
      const report = (await selectPublicReports(tx, null)).find((r) => r.id === id);
      expect(report).toBeDefined();
      expect(Object.keys(report!)).not.toContain("name");
      expect(Object.keys(report!)).not.toContain("whatsapp");
    });
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `bun run test src/lib/public-reports.test.ts`
Expected: FAIL com "Failed to resolve import "@/lib/public-reports"".

- [ ] **Step 4: Implementar `src/lib/public-reports.ts`**

Leva a consulta e o mapeamento que hoje estão em `listPublicReports`, acrescentando o `LEFT JOIN`:

```ts
import { count, desc, eq, sql } from "drizzle-orm";
import { reportAffected, reports } from "@/db/schema";
import type { Db } from "@/lib/affected";
import type { ReportType } from "@/lib/report-types";
import { formatProtocol, photoUrl, type PublicReport } from "@/lib/reports";

export async function selectPublicReports(db: Db, voterId: string | null): Promise<PublicReport[]> {
  const affected = db
    .select({
      reportId: reportAffected.reportId,
      affectedCount: count().as("affected_count"),
      affectedByMe: (voterId
        ? sql<boolean>`bool_or(${reportAffected.voterId} = ${voterId}::uuid)`
        : sql<boolean>`false`
      ).as("affected_by_me"),
    })
    .from(reportAffected)
    .groupBy(reportAffected.reportId)
    .as("affected");

  /* Explicit columns on purpose: name and WhatsApp are never read here. */
  const rows = await db
    .select({
      id: reports.id,
      protocolSeq: reports.protocolSeq,
      type: reports.type,
      description: reports.description,
      address: reports.address,
      lat: reports.lat,
      lng: reports.lng,
      createdAt: reports.createdAt,
      affectedCount: sql<number>`coalesce(${affected.affectedCount}, 0)`.mapWith(Number),
      affectedByMe: sql<boolean>`coalesce(${affected.affectedByMe}, false)`,
    })
    .from(reports)
    .leftJoin(affected, eq(affected.reportId, reports.id))
    .orderBy(desc(reports.createdAt));

  return rows.map((row) => ({
    id: row.id,
    protocol: formatProtocol(row.protocolSeq),
    type: row.type as ReportType,
    ...(row.description ? { description: row.description } : {}),
    address: row.address,
    lat: row.lat,
    lng: row.lng,
    createdAt: row.createdAt.toISOString(),
    photoUrl: photoUrl(row.id),
    affectedCount: row.affectedCount,
    affectedByMe: row.affectedByMe,
  }));
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `bun run test src/lib/public-reports.test.ts`
Expected: PASS.

- [ ] **Step 6: Ligar `listPublicReports` e `createReport` em `src/lib/reports.functions.ts`**

Troque os imports do topo por:

```ts
import { createServerFn } from "@tanstack/react-start";
import { getDb } from "@/db/client";
import { reportPhotos, reports } from "@/db/schema";
import { insertAuthorMark } from "@/lib/affected";
import { selectPublicReports } from "@/lib/public-reports";
import { PHOTO_REQUIRED_MESSAGE, reportInputSchema } from "@/lib/report-schema";
import { formatProtocol, type PublicReport } from "@/lib/reports";
import { ensureVoterId, readVoterId, requestIpHash } from "@/lib/voter-request";
```

Antes de `export const createReport`, acrescente:

```ts
/* Best effort: a misconfigured secret must never stop someone from reporting. */
function authorMark() {
  try {
    return { voterId: ensureVoterId(), ipHash: requestIpHash() };
  } catch (err) {
    console.error("Marca do autor ignorada:", err);
    return null;
  }
}
```

No handler de `createReport`, logo depois de `const photo = decodeJpegDataUrl(data.photo);`:

```ts
    const author = authorMark();
```

E, dentro da transação, depois do insert em `reportPhotos` e antes de `return row;`:

```ts
      if (author) await insertAuthorMark(tx, { reportId: row.id, ...author });
```

Substitua todo o `listPublicReports` por:

```ts
export const listPublicReports = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicReport[]> => selectPublicReports(getDb(), readVoterId()),
);
```

(O import de `desc` e de `ReportType` e o de `photoUrl` saem deste arquivo, porque agora são usados em `public-reports.ts`.)

- [ ] **Step 7: Criar `src/lib/affected.functions.ts`**

```ts
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getDb } from "@/db/client";
import {
  AffectedLimitError,
  ReportNotFoundError,
  affectedSummary,
  markAffected,
  unmarkAffected,
} from "@/lib/affected";
import {
  AFFECTED_ERROR_MESSAGE,
  AFFECTED_LIMIT_MESSAGE,
  AFFECTED_NOT_FOUND_MESSAGE,
} from "@/lib/reports";
import { maxPerIp } from "@/lib/voter";
import { ensureVoterId, readVoterId, requestIpHash } from "@/lib/voter-request";

const setAffectedInput = z.object({ reportId: z.string().uuid(), affected: z.boolean() });

export type SetAffectedResult =
  | { ok: true; affectedCount: number; affectedByMe: boolean }
  | { ok: false; message: string };

/* Takes the wanted state, not a toggle: a double click or a slow network cannot flip it the wrong way. */
export const setAffected = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => setAffectedInput.parse(data))
  .handler(async ({ data }): Promise<SetAffectedResult> => {
    const db = getDb();
    try {
      let voterId: string | null;
      if (data.affected) {
        voterId = ensureVoterId();
        await markAffected(db, {
          reportId: data.reportId,
          voterId,
          ipHash: requestIpHash(),
          maxPerIp: maxPerIp(process.env),
        });
      } else {
        voterId = readVoterId();
        if (voterId) await unmarkAffected(db, { reportId: data.reportId, voterId });
      }
      return { ok: true, ...(await affectedSummary(db, { reportId: data.reportId, voterId })) };
    } catch (err) {
      if (err instanceof AffectedLimitError) return { ok: false, message: AFFECTED_LIMIT_MESSAGE };
      if (err instanceof ReportNotFoundError)
        return { ok: false, message: AFFECTED_NOT_FOUND_MESSAGE };
      console.error(err);
      return { ok: false, message: AFFECTED_ERROR_MESSAGE };
    }
  });
```

- [ ] **Step 8: Afetados de exemplo no seed**

Em `scripts/seed.ts`, no loop `for (const sample of samples)`, troque por uma versão com índice e acrescente as marcas depois da foto:

```ts
    const affectedBySample = [3, 1, 0, 7, 2, 5, 1];
    for (const [index, sample] of samples.entries()) {
      const [row] = await tx
        .insert(schema.reports)
        .values(sample)
        .returning({ id: schema.reports.id });
      if (!row) throw new Error("Falha ao inserir exemplo");
      await tx
        .insert(schema.reportPhotos)
        .values({ reportId: row.id, contentType: "image/jpeg", data: photo });
      const affected = affectedBySample[index] ?? 0;
      for (let i = 0; i < affected; i++) {
        await tx
          .insert(schema.reportAffected)
          .values({ reportId: row.id, voterId: crypto.randomUUID(), ipHash: `seed-${i}` });
      }
    }
```

- [ ] **Step 9: Verificar**

Run: `bun run test && bun run lint && bunx tsc --noEmit`
Expected: testes PASS, e lint e tsc limpos. Só `selectPublicReports` constrói `PublicReport`, então os campos novos não quebram nenhum outro lugar.

Run: `bun run dev` e abra `http://localhost:<porta>/denuncias`. A página deve carregar igual a antes. No DevTools → Network, a resposta do loader traz `affectedCount` e `affectedByMe` em cada denúncia.

- [ ] **Step 10: Commit**

```bash
git add src/lib/public-reports.ts src/lib/public-reports.test.ts src/lib/affected.functions.ts src/lib/reports.ts src/lib/reports.functions.ts scripts/seed.ts
git commit -m "Lista pública com pessoas afetadas, marca do autor ao denunciar e server function setAffected"
```

---

### Task 5: Textos do contador e mensagem do WhatsApp

**Files:**
- Modify: `src/lib/reports.ts`
- Create: `src/lib/reports.test.ts`

**Interfaces:**
- Produces:
  - `affectedPeople(count: number): string` → `"1 pessoa"` / `"n pessoas"`
  - `affectedAriaLabel(count: number): string` → `"Me afeta também, 1 pessoa afetada"` / `"Me afeta também, n pessoas afetadas"`
  - `affectedSentence(state: { count: number; byMe: boolean }): { lead: string; rest: string }` (o `lead` vai em negrito)
  - `shareMessage(report, affectedCount?: number)`, com padrão `0`

- [ ] **Step 1: Escrever os testes (vão falhar)**

`src/lib/reports.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { affectedAriaLabel, affectedPeople, affectedSentence, shareMessage } from "@/lib/reports";

describe("affectedPeople", () => {
  it("pluralises", () => {
    expect(affectedPeople(0)).toBe("0 pessoas");
    expect(affectedPeople(1)).toBe("1 pessoa");
    expect(affectedPeople(12)).toBe("12 pessoas");
  });
});

describe("affectedAriaLabel", () => {
  it("names the action and the count", () => {
    expect(affectedAriaLabel(1)).toBe("Me afeta também, 1 pessoa afetada");
    expect(affectedAriaLabel(3)).toBe("Me afeta também, 3 pessoas afetadas");
  });
});

describe("affectedSentence", () => {
  it.each([
    [{ count: 0, byMe: false }, { lead: "", rest: "Seja o primeiro a dizer que isso te afeta." }],
    [{ count: 1, byMe: false }, { lead: "1 pessoa", rest: " diz que isso a afeta." }],
    [{ count: 12, byMe: false }, { lead: "12 pessoas", rest: " dizem que isso as afeta." }],
    [{ count: 1, byMe: true }, { lead: "", rest: "Você marcou que isso te afeta." }],
    [{ count: 2, byMe: true }, { lead: "Você e mais 1 pessoa", rest: " dizem que isso as afeta." }],
    [{ count: 12, byMe: true }, { lead: "Você e mais 11 pessoas", rest: " dizem que isso as afeta." }],
  ])("%j", (state, expected) => {
    expect(affectedSentence(state)).toEqual(expected);
  });
});

describe("shareMessage", () => {
  const report = {
    type: "buraco" as const,
    address: "Rua Cel. Jonas Loures, 120 - Centro, Almenara - MG, 39900-000, Brasil",
    createdAt: new Date().toISOString(),
  };

  it("leaves the count out below two people", () => {
    expect(shareMessage(report)).not.toContain("afeta");
    expect(shareMessage(report, 1)).not.toContain("afeta");
  });

  it("mentions two or more people before the call to action", () => {
    expect(shareMessage(report, 12)).toMatch(/12 pessoas dizem que isso as afeta\. Veja e cobre:$/);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `bun run test src/lib/reports.test.ts`
Expected: FAIL (`affectedPeople is not a function` ou erro de import).

- [ ] **Step 3: Implementar em `src/lib/reports.ts`**

Substitua o `shareMessage` atual por:

```ts
export function affectedPeople(count: number) {
  return count === 1 ? "1 pessoa" : `${count} pessoas`;
}

export function affectedAriaLabel(count: number) {
  return `Me afeta também, ${affectedPeople(count)} ${count === 1 ? "afetada" : "afetadas"}`;
}

/* Sentence under the button in the report; `lead` is shown in bold. */
export function affectedSentence({ count, byMe }: { count: number; byMe: boolean }) {
  if (byMe && count <= 1) return { lead: "", rest: "Você marcou que isso te afeta." };
  if (byMe) return { lead: `Você e mais ${affectedPeople(count - 1)}`, rest: " dizem que isso as afeta." };
  if (count === 0) return { lead: "", rest: "Seja o primeiro a dizer que isso te afeta." };
  if (count === 1) return { lead: "1 pessoa", rest: " diz que isso a afeta." };
  return { lead: affectedPeople(count), rest: " dizem que isso as afeta." };
}

/* Message that goes along with the report's link when someone shares it. One person (usually the author) says nothing new. */
export function shareMessage(
  report: Pick<PublicReport, "type" | "address" | "createdAt">,
  affectedCount = 0,
) {
  const meta = reportTypes[report.type];
  const affected =
    affectedCount >= 2 ? ` ${affectedPeople(affectedCount)} dizem que isso as afeta.` : "";
  return `${meta.emoji} ${meta.label} — ${shortAddress(report.address)}. ${waitingSentence(report)}${affected} Veja e cobre:`;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `bun run test && bun run lint && bunx tsc --noEmit`
Expected: tudo verde. `src/routes/index.tsx` continua chamando `shareMessage({...})` sem o segundo argumento e compila.

- [ ] **Step 5: Commit**

```bash
git add src/lib/reports.ts src/lib/reports.test.ts
git commit -m "Textos do contador de pessoas afetadas e contagem na mensagem do WhatsApp"
```

---

### Task 6: Estado compartilhado e botão

**Files:**
- Create: `src/lib/use-affected.tsx`
- Create: `src/components/AffectedButton.tsx`

**Interfaces:**
- Consumes: `setAffected`, `SetAffectedResult` (Task 4); `AFFECTED_ERROR_MESSAGE` (Task 4); `affectedAriaLabel`, `affectedSentence` (Task 5); `PublicReport`.
- Produces:
  - `AffectedProvider({ children }: { children: ReactNode })`
  - `useAffected(report: PublicReport): { count: number; byMe: boolean; error: string | null; toggle: () => void; dismissError: () => void }`
  - `AffectedButton({ report, variant }: { report: PublicReport; variant: "compact" | "full" })`

Não há runner de componentes React no projeto. Esta tarefa é verificada por tipos e lint aqui, e no navegador na Task 7.

- [ ] **Step 1: Implementar `src/lib/use-affected.tsx`**

```tsx
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useServerFn } from "@tanstack/react-start";
import { setAffected } from "@/lib/affected.functions";
import { AFFECTED_ERROR_MESSAGE, type PublicReport } from "@/lib/reports";

type Entry = { count: number; byMe: boolean; error: string | null };

type Store = {
  entries: ReadonlyMap<string, Entry>;
  toggle: (report: PublicReport) => Promise<void>;
  dismissError: (reportId: string) => void;
};

const AffectedContext = createContext<Store | null>(null);

function entryOf(report: PublicReport, local: Entry | undefined): Entry {
  return local ?? { count: report.affectedCount, byMe: report.affectedByMe, error: null };
}

/* Local overrides on top of the loader data, so the card and the open report always agree. */
export function AffectedProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<ReadonlyMap<string, Entry>>(new Map());
  const latest = useRef(entries);
  latest.current = entries;
  const sequence = useRef(new Map<string, number>());
  const send = useServerFn(setAffected);

  const put = useCallback((reportId: string, entry: Entry) => {
    setEntries((prev) => new Map(prev).set(reportId, entry));
  }, []);

  const toggle = useCallback(
    async (report: PublicReport) => {
      const before = entryOf(report, latest.current.get(report.id));
      const wanted = !before.byMe;
      const call = (sequence.current.get(report.id) ?? 0) + 1;
      sequence.current.set(report.id, call);

      put(report.id, {
        count: Math.max(0, before.count + (wanted ? 1 : -1)),
        byMe: wanted,
        error: null,
      });

      const result = await send({ data: { reportId: report.id, affected: wanted } }).catch(
        () => null,
      );
      // A newer click owns the button now
      if (sequence.current.get(report.id) !== call) return;
      if (result?.ok) {
        put(report.id, { count: result.affectedCount, byMe: result.affectedByMe, error: null });
      } else {
        put(report.id, { ...before, error: result?.message ?? AFFECTED_ERROR_MESSAGE });
      }
    },
    [put, send],
  );

  const dismissError = useCallback((reportId: string) => {
    setEntries((prev) => {
      const entry = prev.get(reportId);
      if (!entry?.error) return prev;
      return new Map(prev).set(reportId, { ...entry, error: null });
    });
  }, []);

  const store = useMemo(() => ({ entries, toggle, dismissError }), [entries, toggle, dismissError]);
  return <AffectedContext.Provider value={store}>{children}</AffectedContext.Provider>;
}

export function useAffected(report: PublicReport) {
  const store = useContext(AffectedContext);
  if (!store) throw new Error("useAffected precisa estar dentro de AffectedProvider");
  const { toggle: toggleReport, dismissError: dismissReportError } = store;
  const entry = entryOf(report, store.entries.get(report.id));
  const toggle = useCallback(() => void toggleReport(report), [toggleReport, report]);
  const dismissError = useCallback(
    () => dismissReportError(report.id),
    [dismissReportError, report.id],
  );
  return { ...entry, toggle, dismissError };
}
```

- [ ] **Step 2: Implementar `src/components/AffectedButton.tsx`**

```tsx
import { useEffect } from "react";
import { Check, Users } from "lucide-react";
import { useAffected } from "@/lib/use-affected";
import { affectedAriaLabel, affectedSentence, type PublicReport } from "@/lib/reports";

const ERROR_VISIBLE_MS = 5000;

export function AffectedButton({
  report,
  variant,
}: {
  report: PublicReport;
  variant: "compact" | "full";
}) {
  const { count, byMe, error, toggle, dismissError } = useAffected(report);

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(dismissError, ERROR_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [error, dismissError]);

  const state = byMe
    ? "border-primary bg-primary text-primary-foreground hover:opacity-90"
    : "border-border bg-card text-foreground hover:bg-muted";

  const errorLine = (
    <p aria-live="polite" className="text-xs font-medium text-primary empty:hidden">
      {error}
    </p>
  );

  if (variant === "compact") {
    return (
      <div className="grid justify-items-start gap-1.5">
        <button
          type="button"
          aria-pressed={byMe}
          aria-label={affectedAriaLabel(count)}
          onClick={toggle}
          className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${state}`}
        >
          <Users className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="tabular-nums">{count}</span>
          <span aria-hidden="true">·</span>
          Me afeta
          {byMe ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : null}
        </button>
        {errorLine}
      </div>
    );
  }

  const sentence = affectedSentence({ count, byMe });
  return (
    <div className="grid gap-2">
      <button
        type="button"
        aria-pressed={byMe}
        onClick={toggle}
        className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition-colors ${state}`}
      >
        <Users className="h-4 w-4" aria-hidden="true" />
        {byMe ? "Me afeta" : "Me afeta também"}
        {byMe ? <Check className="h-4 w-4" aria-hidden="true" /> : null}
      </button>
      <p className="text-sm text-muted-foreground">
        {sentence.lead ? <strong className="text-foreground">{sentence.lead}</strong> : null}
        {sentence.rest}
      </p>
      {errorLine}
    </div>
  );
}
```

- [ ] **Step 3: Verificar**

Run: `bun run lint && bunx tsc --noEmit && bun run test`
Expected: tudo verde. Um *warning* `react-refresh/only-export-components` em `use-affected.tsx` (exporta um componente e um hook) é aceitável, porque a regra está configurada como `warn`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/use-affected.tsx src/components/AffectedButton.tsx
git commit -m "Botão \"Me afeta também\" com atualização otimista compartilhada entre card e modal"
```

---

### Task 7: Botão no card e no modal

**Files:**
- Modify: `src/routes/denuncias.tsx`
- Modify: `src/components/ReportDialog.tsx`

**Interfaces:**
- Consumes: `AffectedProvider`, `useAffected` (Task 6); `AffectedButton` (Task 6); `shareMessage(report, affectedCount)` (Task 5).

- [ ] **Step 1: Envolver a página no provider (`src/routes/denuncias.tsx`)**

Imports, acrescente:

```ts
import { AffectedButton } from "@/components/AffectedButton";
import { AffectedProvider } from "@/lib/use-affected";
```

No `return` de `ReportsPage`, envolva o `<div className="min-h-screen ...">` inteiro (incluindo o `<Outlet />`, que renderiza o modal) em `<AffectedProvider>…</AffectedProvider>`.

- [ ] **Step 2: Trocar o tipo das refs dos cards**

```ts
  const cardRefs = useRef<Map<string, HTMLElement>>(new Map());
```

- [ ] **Step 3: Reorganizar o card**

Substitua todo o bloco `<Link key={report.id} ...> … </Link>` dentro de `visible.map` por:

```tsx
                  <article
                    key={report.id}
                    ref={(node) => {
                      if (node) cardRefs.current.set(report.id, node);
                      else cardRefs.current.delete(report.id);
                    }}
                    className={`group relative overflow-hidden rounded-xl border transition-shadow has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring ${
                      isSelected
                        ? "border-primary shadow-float"
                        : "border-border bg-card hover:shadow-float"
                    }`}
                  >
                    <div className="relative aspect-[4/3] overflow-hidden bg-neutral-900">
                      <img
                        src={report.photoUrl}
                        alt={`Foto da denúncia: ${meta.label} em ${shortAddress(report.address)}`}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      />
                      <div className="absolute top-2.5 right-2.5">
                        <DaysOpenBadge report={report} />
                      </div>
                    </div>
                    <div className="p-3.5">
                      <p className="flex items-center gap-2 text-sm font-bold text-foreground">
                        <span aria-hidden="true">{meta.emoji}</span>
                        {/* The link's ::after covers the whole card, so tapping anywhere still opens it */}
                        <Link
                          to="/denuncias/$protocol"
                          params={{ protocol: report.protocol }}
                          state={{ fromList: true }}
                          resetScroll={false}
                          className="outline-none after:absolute after:inset-0 after:content-['']"
                        >
                          {meta.label}
                          <span className="sr-only"> em {shortAddress(report.address)}</span>
                        </Link>
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {shortAddress(report.address)}
                      </p>
                      {report.description ? (
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground italic">
                          “{report.description}”
                        </p>
                      ) : null}
                      {/* Above the link's overlay: marking never opens the report */}
                      <div className="relative z-10 mt-3">
                        <AffectedButton report={report} variant="compact" />
                      </div>
                    </div>
                  </article>
```

- [ ] **Step 4: Botão e contagem no modal (`src/components/ReportDialog.tsx`)**

Imports, acrescente:

```ts
import { AffectedButton } from "@/components/AffectedButton";
import { useAffected } from "@/lib/use-affected";
```

Dentro de `ReportDialog`, depois de `const street = shortAddress(report.address);`:

```ts
  const { count: affectedCount } = useAffected(report);
```

Substitua o bloco final `<div className="mt-auto border-t border-border pt-5"> … </div>` por:

```tsx
        <div className="mt-auto grid gap-5 border-t border-border pt-5">
          <AffectedButton report={report} variant="full" />
          <div>
            <p className="mb-3 text-sm font-semibold text-foreground">
              Quanto mais gente vê, mais difícil ignorar.
            </p>
            <ShareReport url={url} message={shareMessage(report, affectedCount)} />
          </div>
        </div>
```

- [ ] **Step 5: Verificar tipos, lint e testes**

Run: `bun run test && bun run lint && bunx tsc --noEmit`
Expected: tudo verde.

- [ ] **Step 6: Roteiro manual no navegador**

Suba com `bun run dev`. No `.env` local, `AFFECTED_IP_SECRET` pode ficar vazio, porque fora de produção vale o padrão. Rode `bun run db:seed` num banco vazio, se quiser os números de exemplo. Abra `/denuncias` e confira:

1. Os cards mostram a pílula `👥 N · Me afeta`. Clicar na pílula **não** abre o modal, e o número muda na hora.
2. Clicar na foto, no título ou no endereço abre o modal. Tab chega ao título (com anel de foco no card) e depois à pílula, e Enter/Espaço marcam.
3. Com o modal aberto, marcar ou desmarcar nele atualiza o card de trás, e vice-versa.
4. A frase do modal segue os casos (0, só você, você e mais N, N pessoas).
5. Recarregar a página mantém o estado marcado (cookie `vigia_voter` em DevTools → Application: `HttpOnly` ✓, `SameSite=Lax`).
6. Numa aba anônima, a mesma denúncia mostra o número **sem** a sua marca e o botão desmarcado.
7. Limite: com `AFFECTED_MAX_PER_IP=1` no `.env` e o dev reiniciado, marque numa aba normal e tente marcar a mesma denúncia na aba anônima. Deve aparecer a mensagem "Muitas pessoas já marcaram…" embaixo do botão, que volta ao normal e some em ~5 s. Volte o valor para 3 depois.
8. Cliques rápidos (5× seguidos) terminam no estado do último clique, e recarregar confirma o mesmo número.
9. "Compartilhar no WhatsApp" numa denúncia com 2 ou mais pessoas inclui "N pessoas dizem que isso as afeta." antes de "Veja e cobre:". Com 0 ou 1, não inclui.
10. Criar uma denúncia nova em `/`: em `/denuncias` ela aparece com `1` e marcada.
11. `/denuncias/AV-<protocolo>` aberto direto (sem vir da lista) mostra o botão e o número certos.

- [ ] **Step 7: Commit**

```bash
git add src/routes/denuncias.tsx src/components/ReportDialog.tsx
git commit -m "Mostra \"Me afeta também\" nos cards da lista e no modal da denúncia"
```
