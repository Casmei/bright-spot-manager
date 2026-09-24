# Almenara Vigia — "Me afeta também"

Data: 2026-09-24

## Objetivo

Uma espécie de curtida, mas com outro sentido: não é "gostei", é "esse problema me afeta
também". Qualquer pessoa, sem login, marca uma denúncia com um toque, e o número de pessoas
afetadas aparece na lista, no modal e na mensagem compartilhada no WhatsApp. O número serve
de pressão sobre a prefeitura, porque mostra que não é uma pessoa sozinha reclamando.

Critérios de sucesso:

- No card da lista e no modal da denúncia há um botão "Me afeta também" com o contador, e os
  dois ficam sincronizados.
- A mesma pessoa (mesmo navegador) conta no máximo uma vez por denúncia. Clicar de novo
  desmarca.
- Apagar os cookies e marcar de novo esbarra num limite brando por rede (IP): no máximo 3
  marcas por IP em cada denúncia, e esse número é configurável.
- Quem registra a denúncia já conta como a primeira pessoa afetada.
- O IP nunca é gravado em claro (LGPD).
- A mensagem do WhatsApp cita o número quando há pelo menos 2 pessoas afetadas.

## Fora de escopo

- Localização / restrição a moradores de Almenara (a ideia foi avaliada e deixada para depois).
- Ordenação "Mais afetadas", destaque nos pins do mapa e total no resumo do topo.
- Captcha (Turnstile), confirmação por WhatsApp e fingerprinting. Se houver abuso, o
  próximo passo é o Turnstile só nessa ação.
- Número de afetados na descrição Open Graph.

## 1. Dados

Tabela nova em `src/db/schema.ts`, com migração gerada por `db:generate`:

```ts
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
  (t) => [
    primaryKey({ columns: [t.reportId, t.voterId] }),
    index().on(t.reportId, t.ipHash),
  ],
);
```

- A chave primária `(report_id, voter_id)` garante uma marca por visitante.
- O índice `(report_id, ip_hash)` serve para a contagem do limite por IP.
- `scripts/seed.ts` passa a incluir alguns afetados de exemplo.
- A contagem é feita na hora (`count`), sem contador desnormalizado em `reports`.

### Hash do IP

`ip_hash = HMAC-SHA256(ip, AFFECTED_IP_SECRET)` em hex. Um sha256 sem segredo seria reversível
por força bruta, já que o espaço de IPv4 é pequeno. Trocar o segredo só zera o limite por IP.

### IP do cliente

O `getRequestIP({ xForwardedFor: true })` do h3 pega o **primeiro** item do `X-Forwarded-For`,
e esse item quem escreve é o próprio cliente, então dá para forjar. O Traefik do Coolify
**acrescenta** o IP real no fim da lista. Por isso, `clientIp()` usa o **último** item não
vazio do `X-Forwarded-For` e, na falta dele, o IP da conexão (`getRequestIP()` sem opções).
Se nenhum existir, usa a string fixa `"unknown"`.

### Configuração

Estas variáveis entram em `.env.example` e em `docs/deploy-coolify.md`:

- `AFFECTED_IP_SECRET`: obrigatória em produção (`NODE_ENV=production`). Fora de produção, o
  padrão é `"dev-secret"`. Em produção, se estiver ausente, `hashIp` lança um erro.
- `AFFECTED_MAX_PER_IP`: inteiro positivo, padrão `3`. Se o valor for inválido, usa o padrão.

### Concorrência

A checagem do limite e o insert não são atômicos: duas marcas simultâneas vindas do mesmo IP
podem passar do limite em 1. Aceito de propósito, porque o limite é brando. A chave primária
continua impedindo que o mesmo visitante conte duas vezes.

## 2. Servidor

### `src/lib/voter.ts` (só no servidor)

- Cookie `vigia_voter`: valor UUID, `httpOnly`, `SameSite=Lax`, `Secure` em produção, `path=/`,
  `maxAge` de 1 ano.
- `readVoterId()`: lê o cookie. Se o valor não for um UUID válido, devolve `null`.
- `ensureVoterId()`: lê ou gera (`crypto.randomUUID()`) e grava o cookie (renovando a validade).
- `clientIp()` e `hashIp(ip)`, como descritos acima.
- O cookie só é criado quando a pessoa age (marca ou denuncia), nunca numa simples visita.

As partes puras (escolher o IP a partir do cabeçalho, calcular o HMAC e validar o UUID) ficam
em funções que recebem os valores por parâmetro, para dar para testá-las sem request.

### `src/lib/affected.ts` (regra de negócio, recebe o `db`)

- `markAffected(db, { reportId, voterId, ipHash, maxPerIp })`
  1. Se `(reportId, voterId)` já existe, não faz nada.
  2. Conta as linhas com `(reportId, ipHash)`. Se o total for `>= maxPerIp`, lança
     `AffectedLimitError`.
  3. `INSERT ... ON CONFLICT DO NOTHING`. Violação de FK (`23503`) vira `ReportNotFoundError`.
- `unmarkAffected(db, { reportId, voterId })`: `DELETE` por `(reportId, voterId)`, sem checagem
  de IP.
- `affectedSummary(db, { reportId, voterId })`: devolve `{ affectedCount, affectedByMe }`.
- `insertAuthorMark(db, { reportId, voterId, ipHash })`: insere sem checar o limite (a marca do
  autor não é barrada, mas conta no limite das outras pessoas da mesma rede).

### `src/lib/affected.functions.ts`

`setAffected` (`POST`), com entrada `{ reportId: uuid, affected: boolean }` validada com zod.
O cliente envia o estado **desejado**, não um toggle, e isso torna a chamada idempotente.

- `affected: true` → `ensureVoterId()`, `markAffected(...)` com `hashIp(clientIp())` e
  `AFFECTED_MAX_PER_IP`.
- `affected: false` → se não houver cookie, só devolve o resumo. Caso contrário,
  `unmarkAffected(...)`.
- Resposta: `{ affectedCount, affectedByMe }`, lida do banco depois da escrita.
- Erros devolvidos como mensagem para a pessoa:
  - `AffectedLimitError` → "Muitas pessoas já marcaram esta denúncia a partir da mesma rede.
    Tente mais tarde por outra conexão."
  - `ReportNotFoundError` → "Denúncia não encontrada."
  - qualquer outro → registrado no log e devolvido como "Não foi possível registrar agora.
    Tente de novo."

### `createReport`

Depois de inserir a denúncia e a foto, na mesma transação: `ensureVoterId()` e
`insertAuthorMark(...)`. Isso é best-effort. Se o cálculo do hash falhar (por exemplo, com o
segredo ausente em produção), a marca do autor é pulada, o erro vai para o log e a denúncia é
registrada normalmente. Para isso, o hash é calculado **antes** da transação e a marca só é
inserida se o hash existir.

### `listPublicReports`

Uma só consulta: `reports LEFT JOIN` um subselect em `report_affected`, agrupado por
`report_id`, com

- `affected_count = count(*)`
- `affected_by_me = bool_or(voter_id = $voterId)` (`false` quando não há cookie ou não há marcas)

`PublicReport` (em `src/lib/reports.ts`) ganha `affectedCount: number` e
`affectedByMe: boolean`. As colunas privadas (nome, WhatsApp) continuam fora do select. A rota
`/denuncias/$protocol` continua reaproveitando os dados do pai.

## 3. Interface

### Estado compartilhado: `src/lib/use-affected.tsx`

- `AffectedProvider` envolve a página `/denuncias` (o modal é renderizado pelo `<Outlet />`
  dentro dela, então fica sob o mesmo provider). Ele guarda apenas ajustes locais:
  `Map<reportId, { count, byMe }>` aplicados sobre os dados do loader.
- `useAffected(report)` devolve `{ count, byMe, toggle, error }`.
- `toggle()`:
  1. Atualização otimista (`byMe` invertido, `count ± 1`) e limpa o erro.
  2. Chama `setAffected({ reportId, affected: !byMeAnterior })` com um número de sequência
     por denúncia.
  3. Em caso de sucesso, se for a resposta mais recente, adota `{ affectedCount, affectedByMe }`
     do servidor.
  4. Em caso de erro, se for a resposta mais recente, volta ao estado de antes do clique e
     define `error` (a mensagem vinda do servidor).
  5. Respostas de chamadas antigas são ignoradas.
- `error` some sozinho depois de ~5 s.
- Nada de `router.invalidate()` depois do clique.

### `src/components/AffectedButton.tsx`

Botão com `aria-pressed={byMe}` e ícone `Users` (lucide). O erro fica numa região
`aria-live="polite"` logo abaixo.

- Variante `compact` (card): pílula `[ícone] 12 · Me afeta`, com contorno quando desmarcado e
  preenchida na cor da marca, com ✓, quando marcado.
- Variante `full` (modal): botão largo "Me afeta também" (marcado: "Me afeta ✓") e uma frase
  abaixo:
  - `count === 0`: "Seja o primeiro a dizer que isso te afeta."
  - desmarcado: "**12 pessoas** dizem que isso as afeta." (1: "**1 pessoa** diz que isso a
    afeta.")
  - marcado e `count === 1`: "Você marcou que isso te afeta."
  - marcado e `count > 1`: "**Você e mais 11 pessoas** dizem que isso as afeta." (mais 1:
    "Você e mais 1 pessoa…")

Os textos e plurais ficam em helpers puros em `src/lib/reports.ts`.

### Card da lista (`src/routes/denuncias.tsx`)

O card deixa de ser um `<Link>` inteiro, porque um botão dentro de um link é HTML inválido.
Ele passa a ser `<article className="group relative ...">`:

- O `<Link>` fica no título ("emoji + tipo"), com
  `after:absolute after:inset-0 after:content-['']`, e continua cobrindo o card todo para
  clique e toque.
- Rodapé com `AffectedButton variant="compact"` em `relative z-10`.
- A `ref` usada no `scrollIntoView`, as classes de selecionado/hover e o zoom da foto passam
  para o `<article>`. O `alt` da foto e o texto continuam iguais.

### Modal (`src/components/ReportDialog.tsx`)

Um bloco com `AffectedButton variant="full"` antes da seção "Quanto mais gente vê, mais
difícil ignorar."

### WhatsApp

`shareMessage(report, affectedCount)` insere "12 pessoas dizem que isso as afeta." antes de
"Veja e cobre:" apenas quando `affectedCount >= 2`. O modal passa o `count` atual do
`useAffected`, já com o clique otimista.

## 4. Erros

| Situação | Comportamento |
|---|---|
| Limite de IP atingido | Mensagem em linha e reversão do botão |
| Denúncia inexistente | "Denúncia não encontrada." e reversão |
| Rede ou erro inesperado | "Não foi possível registrar agora. Tente de novo." e reversão |
| Cookie ausente ou inválido na leitura | `affectedByMe = false`, sem erro |
| `AFFECTED_IP_SECRET` ausente em produção | `setAffected` falha (com log). `createReport` segue sem a marca do autor |
| Duplo clique ou respostas fora de ordem | Estado desejado + número de sequência: vale o último clique |

## 5. Testes

Adicionar o Vitest como dev dependency e o script `"test": "vitest run"`.

- **Unitários (puros):**
  - escolha do IP a partir do `X-Forwarded-For` (último item, espaços, vazio, fallback)
  - `hashIp` determinístico, diferente quando muda o segredo, e com erro em produção sem
    segredo
  - validação do UUID do cookie
  - textos e plurais do contador (0, 1, 2, n; marcado e desmarcado)
  - `shareMessage` com e sem a frase (limiar de 2)
- **Integração** contra o Postgres de desenvolvimento (`DATABASE_URL`, porta 5433). Cada teste
  roda numa transação com rollback e é pulado se o banco não estiver disponível:
  - marcar duas vezes com o mesmo visitante → 1
  - desmarcar → 0
  - com `maxPerIp = 3`, a 4ª marca do mesmo `ip_hash` → `AffectedLimitError`
  - desmarcar não esbarra no limite
  - `affectedSummary` com e sem visitante
  - denúncia inexistente → `ReportNotFoundError`
  - apagar a denúncia apaga as marcas (cascade)
  - `insertAuthorMark` ignora o limite
- **Manual no navegador:**
  - marcar no card e ver o modal atualizado (e vice-versa)
  - recarregar e ver o estado mantido
  - abrir em aba anônima e ver o número sem a própria marca
  - criar uma denúncia e ver que ela nasce com 1 e marcada
  - conferir o texto do WhatsApp com 1 e com 2+ pessoas
