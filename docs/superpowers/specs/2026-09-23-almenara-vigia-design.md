# Almenara Vigia — portal comunitário de denúncias (MVP)

Data: 2026-09-23

## Objetivo

Transformar o sistema de "troca de lâmpada Cemig" em um portal comunitário de denúncias
urbanas chamado **Almenara Vigia**, cuja intenção é pressionar publicamente a prefeitura.
Qualquer pessoa registra uma denúncia (buraco, entulho, lâmpada queimada etc.) e todas as
denúncias ficam visíveis publicamente, com a contagem de dias desde o registro.

O layout e o design atuais são mantidos. Mudam apenas: logo, cores, textos, o fluxo de
localização, o tipo da denúncia, os marcadores do mapa e a página de listagem.

## Fora de escopo (etapas futuras)

- Persistência em banco (as denúncias continuam em memória, `src/lib/tickets.ts`).
- Status "resolvida" e cálculo do tempo de resolução.
- Visão de moderador/prefeitura com nome e WhatsApp.
- Testes automatizados (nenhum teste é adicionado nesta etapa).

## 1. Modelo de dados e catálogo de tipos

### `src/lib/report-types.ts` (novo)

Fonte única dos tipos, usada pelo select, marcadores, filtros e cards.

```ts
export type ReportType = "buraco" | "entulho" | "lampada" | "esgoto" | "mato" | "outro";

export const reportTypes: Record<ReportType, { emoji: string; label: string }> = {
  buraco: { emoji: "🕳️", label: "Buraco na via" },
  entulho: { emoji: "🗑️", label: "Entulho / lixo" },
  lampada: { emoji: "💡", label: "Lâmpada queimada" },
  esgoto: { emoji: "💧", label: "Esgoto / vazamento" },
  mato: { emoji: "🌿", label: "Mato alto / terreno" },
  outro: { emoji: "❓", label: "Outro" },
};
```

A ordem das chaves define a ordem no select e nos filtros.

### `src/lib/tickets.ts`

- `Ticket` ganha `type: ReportType` e `description?: string` (presente apenas quando
  `type === "outro"`).
- Novo tipo `PublicTicket = Omit<Ticket, "name" | "whatsapp">` e função `toPublic(ticket)`
  que devolve um objeto novo sem `name` e `whatsapp`. Novo hook `usePublicTickets()` que
  devolve a lista já convertida (memoizada sobre o snapshot do store).
- Protocolo muda de `LMP-` para `AV-` (sementes e `makeProtocol`).
- Os 7 exemplos fictícios recebem tipos variados (pelo menos um de cada tipo, incluindo um
  `outro` com `description`), mantendo endereços e datas de Almenara.
- Removidos: `Urgency`, `ticketUrgency`, `urgencyMeta`, `formatAge`.
- Nova função `formatDaysOpen(ticket)`: dias inteiros desde `createdAt`
  (`Math.floor`). Retorna `"Hoje"` para 0, `"Há 1 dia"` para 1 e `"Há N dias"` para N > 1.
- `ticketAgeInDays` é mantida (usada para ordenação e para "a mais antiga está aberta há X
  dias").

## 2. Formulário de denúncia (`src/routes/index.tsx`)

Layout inalterado: card do formulário à esquerda, mapa à direita. A ordem dos passos dentro
do card passa a ser:

### ① Foto (primeiro campo)

Botão em destaque "📷 Tirar foto ou escolher da galeria". A foto continua opcional. Ao
escolher uma foto:

1. Ler GPS do EXIF (`exifr`, como hoje). Se houver: posiciona o marcador e preenche o
   endereço por geocodificação reversa.
2. Se a foto não tiver GPS: pedir a localização do navegador (`navigator.geolocation`)
   nesse momento. Se concedida: posiciona o marcador e preenche o endereço.
3. Se o navegador negar ou falhar: exibe o campo de endereço.

A página **não** pede mais a localização ao abrir; o pedido acontece só após a foto (passo
2). Motivo do passo 2: navegadores móveis costumam remover o GPS do EXIF em uploads via
formulário web.

Abaixo do botão de foto há o link "Sem foto? Informar o endereço", que exibe o campo de
endereço diretamente.

### ② Localização

- Estado inicial: nada exibido além da dica "Comece pela foto do problema".
- Localização encontrada: linha "📍 Local encontrado: <endereço>" e o link
  "Não é aqui? Digitar endereço", que exibe o campo de endereço.
- Campo de endereço (quando exibido): igual ao atual — input único com autocomplete e
  botão "Buscar".
- Em qualquer estado, o marcador pode ser arrastado e o clique no mapa reposiciona o ponto
  (comportamento atual preservado).

### Correção de cidade (servidor, `src/lib/geocoding.functions.ts`)

Nova função `withAlmenara(text: string): string`:

- Normaliza para comparação: minúsculas e remoção de acentos
  (`normalize("NFD").replace(/[̀-ͯ]/g, "")`).
- Se o texto normalizado não contiver `almenara`, retorna `` `${text}, Almenara - MG` ``;
  caso contrário, retorna o texto original.

Aplicada em `geocodeAddress` (antes de chamar a Geocoding API) e em `suggestAddresses`
(no `input` enviado ao Places Autocomplete). O valor exibido no input não é alterado.

### ③ Tipo

Select obrigatório com os 6 tipos (`emoji + label`), sem valor pré-selecionado
(placeholder "Selecione o tipo do problema"). Usa um `<select>` nativo estilizado com as
mesmas classes dos inputs atuais.

Quando o tipo é `outro`, aparece o campo **"Descreva o problema"** (textarea, obrigatório,
10 a 280 caracteres). Para os demais tipos o campo fica oculto e não é enviado.

### ④ Nome e WhatsApp

Iguais aos atuais, com a nota "Seu nome e WhatsApp não aparecem publicamente."

### Validação (zod)

`formSchema` ganha `type` (enum das chaves de `ReportType`, mensagem
"Selecione o tipo do problema") e `description` validada condicionalmente
(obrigatória, 10–280, quando `type === "outro"`). Sem ponto marcado: erro
"Marque o local do problema no mapa ou informe o endereço."

### Confirmação

Título "Denúncia registrada!", texto com o protocolo `AV-xxxx` e dois botões:
"Ver no mapa de denúncias" (link para `/denuncias`) e "Fazer outra denúncia" (reset,
que também limpa tipo, descrição e estado de localização).

## 3. Página pública (`src/routes/interno.tsx` → `src/routes/denuncias.tsx`)

Rota `/interno` deixa de existir; a nova rota é `/denuncias`. `src/routeTree.gen.ts` é
regenerado pelo plugin do TanStack Router.

Layout atual preservado (mapa à esquerda, lista à direita). Consome apenas
`usePublicTickets()`; nome e WhatsApp nunca são renderizados.

- **Cabeçalho da página:** título "Denúncias em Almenara"; subtítulo
  "N problemas aguardando a prefeitura — a mais antiga foi feita <texto>.", onde `<texto>`
  é `formatDaysOpen` da mais antiga em minúsculas ("hoje", "há 12 dias"). Sem a segunda
  parte quando não houver denúncias. No lugar da legenda de cores, chips com
  contagem por tipo (`emoji contagem`), só para tipos com ao menos uma denúncia.
- **Filtros:** "Todos" + um botão por tipo (`emoji label`).
- **Ordenação:** mais antigas primeiro.
- **Marcadores (abordagem A):** `google.maps.Marker` com `icon` `SymbolPath.CIRCLE`
  branco (`fillColor #ffffff`), borda na cor primária `#a51212`, e `label` com o emoji
  (`fontSize` ~16px). Selecionado: `scale` maior e `strokeWeight` maior, `zIndex` alto.
  A reconciliação de marcadores atual é mantida, trocando apenas o ícone/label.
- **Clique no marcador:** seleciona a denúncia e rola a lista até o card
  (`scrollIntoView({ block: "nearest", behavior: "smooth" })`).
- **Clique no card:** centraliza o mapa e abre o InfoWindow (comportamento atual). O
  InfoWindow mostra emoji + tipo, protocolo, endereço e o texto de dias. Todo texto
  interpolado no HTML do InfoWindow é escapado (endereço e descrição vêm do usuário).
- **Card:** emoji + label do tipo, protocolo, selo vermelho em destaque com
  `formatDaysOpen` em caixa alta ("HÁ 12 DIAS" / "HOJE"), foto (se houver), endereço e
  descrição (quando `outro`).
- Estado vazio do filtro: "Nenhuma denúncia deste tipo."

## 4. Marca, cores e textos

### Logo

- Recortar a cabeça do cachorro da imagem de referência (PNG 1000×1000, fundo vermelho)
  em um quadrado e salvar em `src/assets/almenara-vigia-logo.png`.
- Header: logo em quadrado com cantos arredondados (`h-9 w-9 rounded-lg`) + texto
  "ALMENARA VIGIA" em `font-extrabold`, caixa alta, `tracking-tight`, visível em todas as
  larguras.
- O mesmo recorte substitui `public/favicon.png`.
- `src/assets/cemig-logo.png` é removido.

### Cores (`src/styles.css`, apenas tokens do `:root`)

| Token | Valor |
|---|---|
| `--primary` | `oklch(0.47 0.18 27)` (≈ `#a51212`, vermelho da logo) |
| `--primary-foreground` | `oklch(0.99 0 0)` |
| `--primary-deep` | `oklch(0.3 0.11 25)` (vinho, gradiente do hero) |
| `--ring` | igual a `--primary` |
| `--foreground` / `--card-foreground` / `--popover-foreground` | `oklch(0.22 0.02 25)` |
| `--background` | `oklch(0.985 0.004 40)` |
| `--secondary` | `oklch(0.955 0.02 25)` |
| `--secondary-foreground` | `oklch(0.38 0.14 27)` |
| `--muted` | `oklch(0.96 0.006 40)` |
| `--muted-foreground` | `oklch(0.5 0.02 30)` |
| `--accent` | `oklch(0.88 0.07 20)` (rosado claro, texto de destaque no hero) |
| `--accent-foreground` | `oklch(0.3 0.11 25)` |
| `--border` / `--input` | `oklch(0.91 0.01 30)` |
| sombras | mesma estrutura, com a matiz do foreground |

Os tokens `--status-*` deixam de ser usados e são removidos (do `:root` e do `@theme`).
Texto branco sobre `--primary` deve atingir contraste AA (≥ 4.5:1). Nenhuma classe de
componente muda. O marcador do formulário (`index.tsx`) passa de `#0f6b4f` para
`#a51212`.

### Textos

- `__root.tsx`: título padrão "Almenara Vigia — Denúncias da cidade".
- Hero (`/`):
  - Sobretítulo: "Almenara Vigia · Denúncia comunitária"
  - Título: "Viu um problema na cidade? Denuncie e cobre a prefeitura."
  - Texto: "Cada denúncia fica pública no mapa, com a contagem de dias sem solução.
    Comece pela foto — a gente tenta achar o local sozinho."
- Header: botão "Ver denúncias" (na `/`) ↔ "Fazer denúncia" (na `/denuncias`).
- Formulário: título "Nova denúncia"; botão de envio "Enviar denúncia"; rótulos
  "Foto do problema", "Local do problema", "Tipo do problema".
- Overlay do mapa (`/`): "Toque no mapa para ajustar o local".
- Metadados `head` (`title`, `description`, `og:*`) de `/` e `/denuncias` reescritos no
  tom de denúncia comunitária, sem menções à Cemig.
- Nenhuma menção a "Cemig", "poste" ou "chamado" permanece na interface.

## Verificação

Sem testes automatizados nesta etapa. Antes de concluir:

- `bun run build` e `bun run lint` passam.
- Verificação manual no navegador: foto com GPS, foto sem GPS com localização permitida,
  foto sem GPS com localização negada, fluxo sem foto, busca de endereço sem "Almenara",
  tipo `outro` com e sem descrição, página `/denuncias` (filtros, clique marcador ↔ card,
  ausência de nome/WhatsApp), header, favicon e cores.
