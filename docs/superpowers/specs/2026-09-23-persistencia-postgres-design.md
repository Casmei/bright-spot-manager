# Almenara Vigia — persistência em Postgres + Docker

Data: 2026-09-23

## Objetivo

Hoje as denúncias vivem numa variável do navegador (`src/lib/tickets.ts`): cada pessoa só vê
as próprias, e tudo some ao recarregar. Esta etapa grava as denúncias num Postgres acessado
pelas server functions do TanStack Start, e empacota tudo para que um `docker compose up`
suba os dois serviços (app + banco). O deploy será feito pelo Coolify numa VPS da Hostinger.

Critérios de sucesso:

- Uma denúncia enviada por qualquer pessoa aparece em `/denuncias` para todo mundo e continua
  lá após restart/redeploy.
- Nome e WhatsApp são gravados, mas nunca saem do servidor.
- Toda denúncia tem foto (passa a ser obrigatória).
- `docker compose up --build` sobe app + banco numa máquina limpa, aplicando as migrations.

## Fora de escopo

- Limitação de envios / anti-spam.
- Status "resolvida" e tela de moderador (o esquema só não pode impedi-los depois).
- Testes automatizados.

## 1. Renomeação: ticket → report

"Ticket" soa a suporte técnico; o código já usa `ReportType`. Identificadores em inglês,
URLs em português.

- `src/lib/tickets.ts` → `src/lib/reports.ts`, `Ticket`/`PublicTicket` → `Report`/`PublicReport`,
  `formatDaysOpen` e `ticketAgeInDays` → `reportAgeInDays` passam a aceitar `Pick<…, "createdAt">`.
- O store em memória (`addTicket`, `useTickets`, `usePublicTickets`, sementes) é removido.

## 2. Banco

Postgres 17 via Drizzle ORM + driver `postgres` (postgres.js).

```
reports
  id            uuid pk default gen_random_uuid()
  protocol_seq  integer not null unique, default nextval('reports_protocol_seq')  -- começa em 1001
  type          text not null            -- validado no app contra REPORT_TYPES
  description   text null                -- só para type = 'outro'
  name          text not null            -- privado
  whatsapp      text not null            -- privado
  address       text not null
  lat           double precision not null
  lng           double precision not null
  created_at    timestamptz not null default now()

report_photos
  report_id     uuid pk references reports(id) on delete cascade
  content_type  text not null
  data          bytea not null
```

- Protocolo exibido: `AV-${protocol_seq}`.
- Fotos em tabela separada para a listagem não carregar bytes.
- Arquivos: `src/db/schema.ts` (tabelas), `src/db/client.ts` (conexão preguiçosa a partir de
  `DATABASE_URL`, só servidor), `drizzle.config.ts`, migrations em `drizzle/`.

## 3. Servidor

`src/lib/reports.functions.ts`:

- `createReport` (POST): valida com o schema zod compartilhado (`src/lib/report-schema.ts`,
  usado também pelo formulário) + `lat`, `lng` e `photo` (data URL). A foto precisa ser
  `data:image/jpeg;base64,…`, começar com os bytes JPEG `FF D8 FF` e ter no máximo 2 MB
  decodificada. Grava `reports` e `report_photos` numa transação; devolve `{ protocol }`.
- `listPublicReports` (GET): seleciona **apenas** colunas públicas, ordenado por `created_at`
  desc, e devolve `PublicReport[]` com `photoUrl: "/fotos/<id>"`.

`src/routes/fotos.$id.ts` (server route): lê `report_photos` pelo id; 200 com
`Content-Type` gravado e `Cache-Control: public, max-age=31536000, immutable`; 404 se não
existir ou se o id não for um UUID.

## 4. Front

- Formulário (`/`): foto obrigatória ("Tire ou escolha uma foto do problema."). Envia via
  `useServerFn(createReport)`, com estado de envio (botão desabilitado). Em erro mostra
  "Não foi possível enviar agora. Tente de novo." e mantém os dados preenchidos.
- `/denuncias`: `loader` chama `listPublicReports` (SSR com dados); a imagem usa `photoUrl`
  com `loading="lazy"`. Erros caem no error boundary existente.

## 5. Docker, dev e deploy

- `vite.config.ts`: `nitro: { preset: "node-server" }` → `.output/server/index.mjs`.
- `Dockerfile` multi-stage com Bun: build (instala deps, `vite build`) e runtime (`.output`,
  migrations, script de migração e deps de produção). Na subida: aplica migrations e inicia
  o servidor na porta 3000.
- `VITE_GOOGLE_MAPS_API_KEY` é embutida no bundle no build → entra como build arg.
  `GOOGLE_MAPS_API_KEY`, `DATABASE_URL`, `POSTGRES_*` são de runtime.
- `docker-compose.yml` (produção): `db` (`postgres:17-alpine`, volume `pgdata`, healthcheck,
  sem porta exposta) e `app` (build local, depende do `db` saudável, porta 3000).
- `docker-compose.dev.yml`: só o `db`, em `127.0.0.1:5432`, para `bun dev`.
- Scripts: `db:generate`, `db:migrate`, `db:seed` (7 exemplos com fotos placeholder, só dev),
  `db:studio`.
- `docs/deploy-coolify.md`: recurso Docker Compose, domínio no serviço `app:3000`, variáveis,
  e backup (conferir o backup agendado do Coolify para o Postgres do compose; alternativa:
  tarefa agendada com `pg_dump`).

## 6. Verificação (manual)

- `bun run lint` e `bun run build` passam.
- `docker compose up --build` sobe os dois serviços numa base vazia.
- Denúncia enviada aparece em `/denuncias` em outro navegador e sobrevive a
  `docker compose restart`.
- A resposta HTML/JSON de `/denuncias` não contém nome nem WhatsApp.
- Envio sem foto é recusado (no formulário e pela server function).
