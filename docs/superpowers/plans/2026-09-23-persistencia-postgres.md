# Persistência em Postgres + Docker — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gravar as denúncias (com foto obrigatória) num Postgres acessado pelas server functions, e subir app + banco com `docker compose up`.

**Architecture:** Drizzle ORM + postgres.js num módulo só de servidor (`src/db`). Server functions `createReport`/`listPublicReports` e uma server route `/fotos/$id` que serve os bytes da foto. Build com nitro `node-server`, imagem Bun multi-stage que aplica migrations na subida.

**Tech Stack:** TanStack Start 1.168, nitro 3 beta, Drizzle ORM + drizzle-kit, postgres.js, zod 3, Bun 1.3, Postgres 17, Docker Compose, Coolify.

**Spec:** `docs/superpowers/specs/2026-09-23-persistencia-postgres-design.md`

## Global Constraints

- Sem testes automatizados nesta fase (decisão do usuário); cada tarefa verifica com `bun run lint`, `bunx tsc --noEmit` e checagem manual.
- Identificadores em inglês (`report`), URLs e textos em português.
- Nome e WhatsApp nunca são selecionados em consultas públicas.
- Foto obrigatória: JPEG (`FF D8 FF`), no máximo 2 MB decodificada.
- Protocolo `AV-${protocol_seq}`, sequence a partir de 1001.
- `VITE_GOOGLE_MAPS_API_KEY` é build arg; demais segredos são runtime.

## Review Focus

- Envio sem foto ou com data URL não-JPEG → recusado pelo servidor com mensagem clara, mesmo burlando o formulário.
- Falha de rede/banco no envio → formulário mostra erro e mantém os dados preenchidos.
- `/fotos/<lixo>` (id não-UUID) → 404, não 500.
- Banco vazio em produção → `/denuncias` renderiza sem quebrar (sem "mais antiga").
- Container subindo antes do Postgres → `app` espera o healthcheck do `db`; migrations idempotentes em reinícios.

---

### Task 1: Infra do banco (deps, schema, client, migration, compose dev)

**Files:**
- Create: `src/db/schema.ts`, `src/db/client.ts`, `drizzle.config.ts`, `scripts/migrate.ts`, `docker-compose.dev.yml`, `drizzle/` (gerado)
- Modify: `package.json` (deps + scripts), `.env.example`

**Interfaces:**
- Produces: `reports`, `reportPhotos` (tabelas Drizzle); `getDb(): PostgresJsDatabase<typeof schema>`.

- [ ] `bun add drizzle-orm postgres` e `bun add -d drizzle-kit`.
- [ ] `src/db/schema.ts`: sequence `reports_protocol_seq` (start 1001), tabela `reports` e `report_photos` conforme spec; `bytea` via `customType<{ data: Buffer }>`.
- [ ] `src/db/client.ts`: `getDb()` preguiçoso lendo `DATABASE_URL` (erro claro se faltar), reusando a instância.
- [ ] `drizzle.config.ts` (dialect postgresql, schema `./src/db/schema.ts`, out `./drizzle`).
- [ ] `scripts/migrate.ts`: `migrate(drizzle(postgres(url, { max: 1 })), { migrationsFolder: "drizzle" })`.
- [ ] Scripts: `db:generate`, `db:migrate`, `db:seed`, `db:studio`.
- [ ] `docker-compose.dev.yml` com `postgres:17-alpine` em `127.0.0.1:5432`.
- [ ] `bun run db:generate`, subir o banco dev, `bun run db:migrate`; conferir tabelas com `psql \d`.
- [ ] Commit.

### Task 2: Camada de servidor (reports.ts, schema compartilhado, server functions, rota de fotos)

**Files:**
- Create: `src/lib/reports.ts` (substitui `tickets.ts`), `src/lib/report-schema.ts`, `src/lib/reports.functions.ts`, `src/routes/fotos.$id.ts`
- Delete: `src/lib/tickets.ts`

**Interfaces:**
- Produces: `type PublicReport = { id; protocol; type; description?; address; lat; lng; createdAt: string; photoUrl: string }`; `formatDaysOpen(r: Pick<PublicReport,"createdAt">)`; `reportFormSchema` (zod, o do formulário); `createReport({ data: { type, description, address, name, whatsapp, lat, lng, photo } }) → { protocol: string }`; `listPublicReports() → PublicReport[]`; `photoUrl(id) = "/fotos/" + id`.

- [ ] Mover `formSchema` de `src/routes/index.tsx` para `report-schema.ts` (`reportFormSchema`) e acrescentar `reportInputSchema` = form + `lat`/`lng` numéricos + `photo` string.
- [ ] `decodeJpegDataUrl(photo)`: exige prefixo `data:image/jpeg;base64,`, decodifica, valida magic bytes e 2 MB; lança `Error` em português.
- [ ] `createReport`: transação inserindo `reports` (returning id, protocolSeq) e `report_photos`; retorna `AV-…`. `description` só para `outro`.
- [ ] `listPublicReports`: select explícito das colunas públicas, `orderBy(desc(createdAt))`.
- [ ] `/fotos/$id`: GET com checagem de UUID → 404; senão bytes + cache imutável.
- [ ] `bunx tsc --noEmit`; commit.

### Task 3: Front (formulário e /denuncias)

**Files:** Modify `src/routes/index.tsx`, `src/routes/denuncias.tsx`

- [ ] Formulário: importa `reportFormSchema`; exige foto ("Tire ou escolha uma foto do problema."); `submitting` desabilita botão ("Enviando..."); chama `useServerFn(createReport)`; em erro mostra "Não foi possível enviar agora. Tente de novo." (ou a mensagem de validação do servidor) sem limpar o formulário.
- [ ] `/denuncias`: `loader: () => listPublicReports()`, `Route.useLoaderData()`; `ticket` → `report`; `<img src={report.photoUrl} loading="lazy">`.
- [ ] Manual: `bun dev` com banco dev, enviar denúncia, ver em outra aba anônima; conferir que o HTML não tem nome/WhatsApp.
- [ ] Commit.

### Task 4: Seed de desenvolvimento

**Files:** Create `scripts/seed.ts`, `scripts/placeholder.jpg`

- [ ] Gerar um JPEG placeholder pequeno (cinza com texto "foto de exemplo") com `sips`/ImageMagick ou canvas; versionar.
- [ ] `scripts/seed.ts`: recusa rodar se já houver denúncias; insere os 7 exemplos (com `created_at` retroativo) e a foto placeholder.
- [ ] `bun run db:seed`; conferir em `/denuncias`; commit.

### Task 5: Docker de produção + guia Coolify

**Files:** Create `Dockerfile`, `.dockerignore`, `docker-compose.yml`, `docs/deploy-coolify.md`; Modify `vite.config.ts`, `.env.example`, `README.md`

- [ ] `vite.config.ts`: `nitro: { preset: "node-server" }`.
- [ ] `Dockerfile`: stage `build` (`oven/bun:1.3`, `bun install --frozen-lockfile`, `ARG VITE_GOOGLE_MAPS_API_KEY`, `bun run build`); stage `runtime` (`oven/bun:1.3-slim`, `bun install --production`, copia `.output`, `drizzle/`, `scripts/migrate.ts`; `CMD bun scripts/migrate.ts && bun .output/server/index.mjs`; `PORT=3000`).
- [ ] `docker-compose.yml`: `db` (volume `pgdata`, healthcheck `pg_isready`, envs `POSTGRES_*`) e `app` (build com arg, `depends_on: condition: service_healthy`, `DATABASE_URL`, `GOOGLE_MAPS_API_KEY`, porta `3000`).
- [ ] `docs/deploy-coolify.md`.
- [ ] `docker compose up --build` numa base vazia; enviar denúncia; `docker compose restart`; conferir persistência; `bun run lint && bun run build`.
- [ ] Commit.
