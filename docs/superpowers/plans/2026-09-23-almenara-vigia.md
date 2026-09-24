# Almenara Vigia Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar o app de troca de lâmpadas da Cemig no portal comunitário de denúncias "Almenara Vigia": tipo de denúncia, fluxo de localização a partir da foto, marcadores com emoji e página pública com dias desde a denúncia.

**Architecture:** Continua um app TanStack Start sem backend: as denúncias ficam em um store em memória (`src/lib/tickets.ts`, `useSyncExternalStore`). Um catálogo de tipos (`src/lib/report-types.ts`) é a fonte única para select, marcadores, filtros e cards. A página pública consome apenas `PublicTicket` (sem nome/WhatsApp). O rebranding é feito só por tokens de cor, assets e textos — nenhum layout muda.

**Tech Stack:** TanStack Start/Router 1.170, React 19, Tailwind v4 (tokens oklch em `src/styles.css`), zod 3.25, exifr, Google Maps JS API (legacy `google.maps.Marker`), Google Geocoding + Places API (server functions), bun.

**Spec:** `docs/superpowers/specs/2026-09-23-almenara-vigia-design.md`

## Global Constraints

- Sem testes automatizados nesta etapa (decisão do usuário). A verificação de cada tarefa é: `bun run build`, `bunx tsc --noEmit` e checagem manual no navegador (`bun run dev`).
- Denúncias continuam em memória; nada de banco, status "resolvida" ou visão de moderador.
- Layout, espaçamentos, fonte (Plus Jakarta Sans) e componentes não mudam — só logo, cores (tokens), textos e o que a spec lista.
- Nenhuma menção a "Cemig", "poste" ou "chamado" permanece na interface.
- Nome e WhatsApp nunca são renderizados em `/denuncias`.
- Cor primária da marca: `oklch(0.47 0.18 27)` ≈ `#a51212` (usar o hex `#a51212` dentro do código do Google Maps).
- Protocolo com prefixo `AV-`.
- Projeto conectado ao Lovable: **não** dar push, force push, rebase ou amend. Apenas commits locais.
- `src/routeTree.gen.ts` é gerado pelo plugin do TanStack Router — nunca editar à mão; ele é regenerado por `bun run build` (ou `bun run dev`).

## Review Focus

Sem testes automatizados; cada linha abaixo vira um passo de verificação manual na tarefa dona.

1. **Foto sem GPS e localização negada** (caso mais comum no celular) → o campo de endereço aparece e a denúncia pode ser enviada normalmente. (Task 4)
2. **Endereço do usuário no InfoWindow** (HTML montado com string) → texto como `<b>x</b>` no endereço/descrição aparece literal, sem virar HTML. (Task 2)
3. **Trocar o filtro com uma denúncia selecionada** que não pertence ao novo filtro → o InfoWindow fecha e não sobra marcador órfão. (Task 2)
4. **Endereço que já contém a cidade** (`ALMENARA`, `almenara`, `Almenára`) → a cidade não é duplicada na busca; endereço sem cidade recebe `, Almenara - MG`. (Task 3)
5. **Trocar a foto depois que o local já foi definido** → foto sem GPS não pergunta a localização de novo nem move o ponto; foto com GPS reposiciona o ponto. (Task 4)

---

## File Structure

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `src/assets/almenara-vigia-logo.png` | Criar | Recorte da cabeça do cachorro (128×128) |
| `src/assets/cemig-logo.png` | Remover | Logo antiga |
| `public/favicon.png` | Substituir | Favicon 64×64 com o cachorro |
| `src/styles.css` | Modificar | Tokens de cor vermelhos; remove `--status-*` |
| `src/components/Header.tsx` | Modificar | Logo + "ALMENARA VIGIA"; links "Ver denúncias"/"Fazer denúncia" |
| `src/routes/__root.tsx` | Modificar | Título/descrição padrão; `lang="pt-BR"` |
| `src/lib/report-types.ts` | Criar | Catálogo de tipos (chave, emoji, rótulo) |
| `src/lib/tickets.ts` | Reescrever | Modelo `Ticket`/`PublicTicket`, sementes, `formatDaysOpen`, `usePublicTickets` |
| `src/routes/denuncias.tsx` | Criar | Página pública (mapa + lista + filtros por tipo) |
| `src/routes/interno.tsx` | Remover | Substituída por `/denuncias` |
| `src/routeTree.gen.ts` | Regenerado | Pelo plugin do router |
| `src/lib/geocoding.functions.ts` | Modificar | `withAlmenara()` na busca e no autocomplete |
| `src/routes/index.tsx` | Reescrever | Formulário: foto → local → tipo → contato; textos novos |
| `src/lib/google-maps-loader.ts` | Modificar | Só o comentário de eslint para `any` (Task 5) |

---

### Task 1: Marca — logo, favicon, cores e header

**Files:**
- Create: `src/assets/almenara-vigia-logo.png`
- Delete: `src/assets/cemig-logo.png`
- Modify: `public/favicon.png`, `src/styles.css:50-52,74-103`, `src/components/Header.tsx`, `src/routes/__root.tsx:80-84,110`, `src/routes/index.tsx:126`

**Interfaces:**
- Consumes: nada.
- Produces: `Header` continua com a assinatura `Header({ variant }: { variant?: "public" | "interno" })` nesta tarefa (a Task 2 renomeia a variante). Tokens Tailwind `primary`, `primary-deep`, `secondary`, `accent`, `muted` etc. seguem existindo com novos valores.

- [ ] **Step 1: Gerar logo e favicon a partir da imagem de referência**

A imagem de referência (1000×1000, fundo vermelho, cachorro branco + texto) está em
`/private/tmp/claude-502/-Users-tiago-castro--superset-worktrees-bright-spot-manager-Tiago-Castro-skinny-shampoo/fb920026-8182-4b7f-80c5-abb014d82703/images/1.png`.
Se o arquivo não existir mais, peça ao usuário para salvá-lo e informe o caminho. O recorte abaixo (320×320 a partir de y=245, x=334) foi validado: contém só a cabeça do cachorro, sem o texto.

```bash
SRC=/private/tmp/claude-502/-Users-tiago-castro--superset-worktrees-bright-spot-manager-Tiago-Castro-skinny-shampoo/fb920026-8182-4b7f-80c5-abb014d82703/images/1.png
sips -c 320 320 --cropOffset 245 334 "$SRC" --out src/assets/almenara-vigia-logo.png
sips -z 128 128 src/assets/almenara-vigia-logo.png
cp src/assets/almenara-vigia-logo.png public/favicon.png
sips -z 64 64 public/favicon.png
git rm -q src/assets/cemig-logo.png
```

Abra `src/assets/almenara-vigia-logo.png` e confirme visualmente: cachorro branco centralizado em fundo vermelho, sem pedaços de letras.

- [ ] **Step 2: Reescrever `src/components/Header.tsx`**

```tsx
import { Link } from "@tanstack/react-router";
import logoUrl from "@/assets/almenara-vigia-logo.png";

export function Header({ variant = "public" }: { variant?: "public" | "interno" }) {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-[1400px] items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-3">
          <img src={logoUrl} alt="" className="h-9 w-9 rounded-lg" />
          <span className="text-base font-extrabold tracking-tight text-foreground uppercase">
            Almenara Vigia
          </span>
        </Link>

        {variant === "public" ? (
          <Link
            to="/interno"
            className="rounded-full border border-primary/25 bg-secondary px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
          >
            Ver denúncias
          </Link>
        ) : (
          <Link
            to="/"
            className="rounded-full border border-primary/25 bg-secondary px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
          >
            Fazer denúncia
          </Link>
        )}
      </div>
    </header>
  );
}
```

(`alt=""` porque o nome da marca já está em texto ao lado.)

- [ ] **Step 3: Trocar os tokens de cor em `src/styles.css`**

No bloco `@theme inline`, remova estas três linhas:

```css
  --color-status-new: var(--status-new);
  --color-status-warning: var(--status-warning);
  --color-status-critical: var(--status-critical);
```

No bloco `:root`, substitua as linhas de `--background` até `--status-critical` **inclusive** (as três linhas `--status-*` são removidas; `--radius`, `--font-sans`, `--chart-*` e `--sidebar-*` ficam como estão) por:

```css
  --background: oklch(0.985 0.004 40);
  --foreground: oklch(0.22 0.02 25);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.22 0.02 25);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.22 0.02 25);
  --primary: oklch(0.47 0.18 27);
  --primary-foreground: oklch(0.99 0 0);
  --primary-deep: oklch(0.3 0.11 25);
  --secondary: oklch(0.955 0.02 25);
  --secondary-foreground: oklch(0.38 0.14 27);
  --muted: oklch(0.96 0.006 40);
  --muted-foreground: oklch(0.5 0.02 30);
  --accent: oklch(0.88 0.07 20);
  --accent-foreground: oklch(0.3 0.11 25);
  --destructive: oklch(0.58 0.21 27);
  --destructive-foreground: oklch(0.99 0.01 120);
  --border: oklch(0.91 0.01 30);
  --input: oklch(0.91 0.01 30);
  --ring: oklch(0.47 0.18 27);
```

e, logo depois dos `--chart-*`, substitua `--gradient-hero`, `--shadow-card` e `--shadow-float` por:

```css
  --gradient-hero: linear-gradient(135deg, var(--primary-deep), var(--primary));
  --shadow-card: 0 1px 2px oklch(0.22 0.02 25 / 6%), 0 8px 24px oklch(0.22 0.02 25 / 6%);
  --shadow-float: 0 12px 40px oklch(0.22 0.02 25 / 14%);
```

Confirme que as linhas `--status-new`, `--status-warning` e `--status-critical` não existem mais no `:root`:

```bash
grep -n "status-" src/styles.css
```
Expected: nenhuma saída. (Não há uso de `status-*` em classes — verificado com `grep -rn "status-" src`.)

Contraste: branco sobre `#a51212` ≈ 7.8:1 (AA ok).

- [ ] **Step 4: Textos padrão e idioma em `src/routes/__root.tsx`**

Troque:

```tsx
      { title: "Cemig Iluminação Pública" },
      {
        name: "description",
        content: "Solicitações de troca de lâmpadas de iluminação pública.",
      },
```

por:

```tsx
      { title: "Almenara Vigia — Denúncias da cidade" },
      {
        name: "description",
        content:
          "Portal comunitário de denúncias de problemas urbanos em Almenara (MG), com a contagem de dias sem solução.",
      },
```

E em `RootShell` troque `<html lang="en">` por `<html lang="pt-BR">`.

- [ ] **Step 5: Cor do marcador do formulário**

Em `src/routes/index.tsx`, no `new maps.Marker({...})` do efeito "Load the map", troque `fillColor: "#0f6b4f",` por `fillColor: "#a51212",`.

- [ ] **Step 6: Verificar**

```bash
bun run build && bunx tsc --noEmit
```
Expected: build termina com `[nitro] ✔`, tsc sem saída.

Manual (`bun run dev`, abrir `/`): header com o cachorro no quadrado vermelho + "ALMENARA VIGIA"; hero com gradiente vinho→vermelho; botões vermelhos; favicon novo na aba; layout idêntico ao anterior. Largura de 375px: logo, nome e botão cabem numa linha sem rolagem horizontal.

- [ ] **Step 7: Commit**

```bash
git add -A src/assets public/favicon.png src/styles.css src/components/Header.tsx src/routes/__root.tsx src/routes/index.tsx
git commit -m "Aplica marca Almenara Vigia: logo, favicon e paleta vermelha

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Modelo de denúncia e página pública `/denuncias`

**Files:**
- Create: `src/lib/report-types.ts`, `src/routes/denuncias.tsx`
- Rewrite: `src/lib/tickets.ts`
- Delete: `src/routes/interno.tsx`
- Modify: `src/components/Header.tsx`, `src/routes/index.tsx` (1 linha temporária), `src/routeTree.gen.ts` (regenerado)

**Interfaces:**
- Consumes: `Header` (Task 1), `ALMENARA_CENTER`, `MAP_STYLES`, `loadGoogleMaps` de `@/lib/google-maps-loader`.
- Produces:
  - `REPORT_TYPES: readonly ["buraco","entulho","lampada","esgoto","mato","outro"]`
  - `type ReportType = (typeof REPORT_TYPES)[number]`
  - `reportTypes: Record<ReportType, { emoji: string; label: string }>`
  - `type Ticket = { id; protocol; type: ReportType; description?: string; name; whatsapp; address; lat; lng; createdAt; photo? }`
  - `type PublicTicket = Omit<Ticket, "name" | "whatsapp">`
  - `addTicket(input: Omit<Ticket, "id" | "protocol" | "createdAt">): Ticket`
  - `useTickets(): Ticket[]`, `usePublicTickets(): PublicTicket[]`, `toPublic(ticket: Ticket): PublicTicket`
  - `ticketAgeInDays(ticket: Pick<Ticket, "createdAt">): number`
  - `formatDaysOpen(ticket: Pick<Ticket, "createdAt">): string` → `"Hoje" | "Há 1 dia" | "Há N dias"`
  - `Header({ variant }: { variant?: "public" | "denuncias" })`
  - Rota `/denuncias`

- [ ] **Step 1: Criar `src/lib/report-types.ts`**

```ts
/* Tipos de denúncia. A ordem do array define a ordem no select e nos filtros. */
export const REPORT_TYPES = ["buraco", "entulho", "lampada", "esgoto", "mato", "outro"] as const;

export type ReportType = (typeof REPORT_TYPES)[number];

export const reportTypes: Record<ReportType, { emoji: string; label: string }> = {
  buraco: { emoji: "🕳️", label: "Buraco na via" },
  entulho: { emoji: "🗑️", label: "Entulho / lixo" },
  lampada: { emoji: "💡", label: "Lâmpada queimada" },
  esgoto: { emoji: "💧", label: "Esgoto / vazamento" },
  mato: { emoji: "🌿", label: "Mato alto / terreno" },
  outro: { emoji: "❓", label: "Outro" },
};
```

- [ ] **Step 2: Reescrever `src/lib/tickets.ts`**

```ts
import { useMemo, useSyncExternalStore } from "react";
import type { ReportType } from "@/lib/report-types";

export type Ticket = {
  id: string;
  protocol: string;
  type: ReportType;
  description?: string;
  name: string;
  whatsapp: string;
  address: string;
  lat: number;
  lng: number;
  createdAt: string;
  photo?: string;
};

/* What anyone can see: never carries the reporter's name or WhatsApp. */
export type PublicTicket = Omit<Ticket, "name" | "whatsapp">;

const DAY = 24 * 60 * 60 * 1000;

export function ticketAgeInDays(ticket: Pick<Ticket, "createdAt">) {
  return (Date.now() - new Date(ticket.createdAt).getTime()) / DAY;
}

export function formatDaysOpen(ticket: Pick<Ticket, "createdAt">) {
  const days = Math.floor(ticketAgeInDays(ticket));
  if (days <= 0) return "Hoje";
  return days === 1 ? "Há 1 dia" : `Há ${days} dias`;
}

/* Allowlist on purpose: new private fields stay out of the public view by default. */
export function toPublic(ticket: Ticket): PublicTicket {
  return {
    id: ticket.id,
    protocol: ticket.protocol,
    type: ticket.type,
    address: ticket.address,
    lat: ticket.lat,
    lng: ticket.lng,
    createdAt: ticket.createdAt,
    ...(ticket.description ? { description: ticket.description } : {}),
    ...(ticket.photo ? { photo: ticket.photo } : {}),
  };
}

function daysAgo(days: number) {
  return new Date(Date.now() - days * DAY).toISOString();
}

let counter = 1042;

function makeProtocol() {
  counter += 1;
  return `AV-${counter}`;
}

let tickets: Ticket[] = [
  {
    id: "1",
    protocol: "AV-1021",
    type: "buraco",
    name: "Marina Alves",
    whatsapp: "(33) 99812-4410",
    address: "Av. Nossa Senhora do Amparo, 300 - Centro, Almenara - MG",
    lat: -16.1836,
    lng: -40.6947,
    createdAt: daysAgo(0.2),
  },
  {
    id: "2",
    protocol: "AV-1024",
    type: "lampada",
    name: "Carlos Teixeira",
    whatsapp: "(33) 99120-7788",
    address: "Rua Cel. Jonas Loures, 120 - Centro, Almenara - MG",
    lat: -16.1801,
    lng: -40.6903,
    createdAt: daysAgo(1.1),
  },
  {
    id: "3",
    protocol: "AV-1029",
    type: "entulho",
    name: "Juliana Prado",
    whatsapp: "(33) 98444-1201",
    address: "Rua Manoel Esteves, 45 - Vila Nova, Almenara - MG",
    lat: -16.1888,
    lng: -40.6885,
    createdAt: daysAgo(2.6),
  },
  {
    id: "4",
    protocol: "AV-1031",
    type: "esgoto",
    name: "Rafael Souza",
    whatsapp: "(33) 99666-3040",
    address: "Rua Joaquim Pedro, 890 - São Geraldo, Almenara - MG",
    lat: -16.1769,
    lng: -40.7004,
    createdAt: daysAgo(3.4),
  },
  {
    id: "5",
    protocol: "AV-1035",
    type: "mato",
    name: "Beatriz Lima",
    whatsapp: "(33) 99001-5522",
    address: "Rua das Palmeiras, 210 - Bela Vista, Almenara - MG",
    lat: -16.1922,
    lng: -40.7011,
    createdAt: daysAgo(5.2),
  },
  {
    id: "6",
    protocol: "AV-1038",
    type: "buraco",
    name: "Eduardo Nunes",
    whatsapp: "(33) 98777-9090",
    address: "Av. Pedro Versiani, 1500 - Jardim Vitória, Almenara - MG",
    lat: -16.1745,
    lng: -40.6862,
    createdAt: daysAgo(12.5),
  },
  {
    id: "7",
    protocol: "AV-1040",
    type: "outro",
    description: "Placa de 'Pare' caída na esquina; os carros estão passando direto.",
    name: "Sandra Rocha",
    whatsapp: "(33) 99433-1188",
    address: "Rua Santo Antônio, 77 - Santo Antônio, Almenara - MG",
    lat: -16.1867,
    lng: -40.7062,
    createdAt: daysAgo(0.8),
  },
];

const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function addTicket(input: Omit<Ticket, "id" | "protocol" | "createdAt">) {
  const ticket: Ticket = {
    ...input,
    id: crypto.randomUUID(),
    protocol: makeProtocol(),
    createdAt: new Date().toISOString(),
  };
  tickets = [ticket, ...tickets];
  emit();
  return ticket;
}

export function useTickets() {
  return useSyncExternalStore(
    subscribe,
    () => tickets,
    () => tickets,
  );
}

export function usePublicTickets() {
  const all = useTickets();
  return useMemo(() => all.map(toPublic), [all]);
}
```

- [ ] **Step 3: Ajuste temporário em `src/routes/index.tsx`**

`addTicket` agora exige `type`. Para o build continuar passando até a Task 4 reescrever o formulário, em `handleSubmit` adicione a linha `type: "lampada",` como primeira propriedade do objeto passado a `addTicket({ ... })`. (A Task 4 substitui o arquivo inteiro.)

- [ ] **Step 4: Atualizar `src/components/Header.tsx`**

Troque a assinatura e os links:

```tsx
export function Header({ variant = "public" }: { variant?: "public" | "denuncias" }) {
```

e no link do ramo `variant === "public"` troque `to="/interno"` por `to="/denuncias"`. O restante do arquivo fica igual ao da Task 1.

- [ ] **Step 5: Criar `src/routes/denuncias.tsx` e remover `interno.tsx`**

```bash
git rm -q src/routes/interno.tsx
```

Crie `src/routes/denuncias.tsx`:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Header } from "@/components/Header";
import { ALMENARA_CENTER, MAP_STYLES, loadGoogleMaps } from "@/lib/google-maps-loader";
import { REPORT_TYPES, reportTypes, type ReportType } from "@/lib/report-types";
import { formatDaysOpen, usePublicTickets } from "@/lib/tickets";

export const Route = createFileRoute("/denuncias")({
  head: () => ({
    meta: [
      { title: "Denúncias em Almenara — Almenara Vigia" },
      {
        name: "description",
        content:
          "Mapa público das denúncias de problemas urbanos em Almenara e há quantos dias cada uma espera uma resposta da prefeitura.",
      },
      { property: "og:title", content: "Denúncias em Almenara — Almenara Vigia" },
      {
        property: "og:description",
        content:
          "Buracos, entulho, lâmpadas queimadas: veja no mapa o que a população denunciou e há quantos dias está sem solução.",
      },
    ],
  }),
  component: ReportsPage,
});

const BRAND_HEX = "#a51212";

/* Address and description come from the public form; never inject them as HTML. */
function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function ReportsPage() {
  const tickets = usePublicTickets();
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapObj = useRef<any>(null);
  const mapsApi = useRef<any>(null);
  const markers = useRef<Map<string, any>>(new Map());
  const infoWindow = useRef<any>(null);
  const cardRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const [ready, setReady] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<ReportType | "todos">("todos");

  const ordered = useMemo(
    () =>
      [...tickets].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      ),
    [tickets],
  );

  const visible = useMemo(
    () => ordered.filter((ticket) => filter === "todos" || ticket.type === filter),
    [ordered, filter],
  );

  const counts = useMemo(() => {
    const base = Object.fromEntries(REPORT_TYPES.map((key) => [key, 0])) as Record<
      ReportType,
      number
    >;
    for (const ticket of tickets) base[ticket.type] += 1;
    return base;
  }, [tickets]);

  const oldest = ordered[0];

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then((maps) => {
        if (cancelled || !mapRef.current) return;
        mapsApi.current = maps;
        mapObj.current = new maps.Map(mapRef.current, {
          center: ALMENARA_CENTER,
          zoom: 14,
          styles: MAP_STYLES,
          clickableIcons: false,
          mapTypeControl: false,
          streetViewControl: false,
        });
        infoWindow.current = new maps.InfoWindow();
        setReady(true);
      })
      .catch(() => setReady(false));
    return () => {
      cancelled = true;
    };
  }, []);

  // Reconcile markers with the visible reports
  useEffect(() => {
    const maps = mapsApi.current;
    const map = mapObj.current;
    if (!ready || !maps || !map) return;

    const keep = new Set(visible.map((ticket) => ticket.id));
    for (const [id, marker] of markers.current) {
      if (!keep.has(id)) {
        marker.setMap(null);
        markers.current.delete(id);
      }
    }

    for (const ticket of visible) {
      const isSelected = selected === ticket.id;
      const meta = reportTypes[ticket.type];
      const icon = {
        path: maps.SymbolPath.CIRCLE,
        scale: isSelected ? 18 : 14,
        fillColor: "#ffffff",
        fillOpacity: 1,
        strokeColor: BRAND_HEX,
        strokeWeight: isSelected ? 4 : 2,
      };
      const label = { text: meta.emoji, fontSize: isSelected ? "20px" : "16px" };

      const existing = markers.current.get(ticket.id);
      if (existing) {
        existing.setIcon(icon);
        existing.setLabel(label);
        existing.setZIndex(isSelected ? 999 : 1);
        continue;
      }

      const marker = new maps.Marker({
        map,
        position: { lat: ticket.lat, lng: ticket.lng },
        icon,
        label,
        title: `${meta.label} · ${ticket.protocol}`,
      });
      marker.addListener("click", () => setSelected(ticket.id));
      markers.current.set(ticket.id, marker);
    }
  }, [ready, visible, selected]);

  // Focus the map on the selected report
  useEffect(() => {
    const map = mapObj.current;
    if (!ready || !map || !selected) return;
    const ticket = visible.find((item) => item.id === selected);
    if (!ticket) {
      infoWindow.current?.close();
      return;
    }
    map.panTo({ lat: ticket.lat, lng: ticket.lng });
    map.setZoom(16);
    const marker = markers.current.get(ticket.id);
    if (marker && infoWindow.current) {
      const meta = reportTypes[ticket.type];
      infoWindow.current.setContent(
        `<div style="font-family:inherit;font-size:12px;max-width:240px">` +
          `<strong>${meta.emoji} ${escapeHtml(meta.label)}</strong> · ${escapeHtml(ticket.protocol)}<br/>` +
          `${escapeHtml(ticket.address)}<br/>` +
          `<span style="color:${BRAND_HEX};font-weight:700">${formatDaysOpen(ticket)}</span>` +
          `</div>`,
      );
      infoWindow.current.open({ anchor: marker, map });
    }
  }, [ready, selected, visible]);

  // Bring the selected card into view when a marker is clicked
  useEffect(() => {
    if (!selected) return;
    cardRefs.current.get(selected)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selected]);

  return (
    <div className="min-h-screen bg-background font-sans">
      <Header variant="denuncias" />

      <main className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Denúncias em Almenara</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {oldest
                ? `${tickets.length} ${tickets.length === 1 ? "problema aguardando" : "problemas aguardando"} a prefeitura — a mais antiga foi feita ${formatDaysOpen(oldest).toLowerCase()}.`
                : "Nenhuma denúncia registrada ainda."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {REPORT_TYPES.filter((key) => counts[key] > 0).map((key) => (
              <div
                key={key}
                title={reportTypes[key].label}
                aria-label={`${reportTypes[key].label}: ${counts[key]}`}
                className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground shadow-card"
              >
                <span aria-hidden="true">{reportTypes[key].emoji}</span>
                <span aria-hidden="true">{counts[key]}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_minmax(0,420px)]">
          <div className="relative h-[420px] overflow-hidden rounded-2xl border border-border bg-muted shadow-card lg:h-[calc(100vh-13rem)]">
            <div ref={mapRef} className="absolute inset-0" />
          </div>

          <div className="flex flex-col rounded-2xl border border-border bg-card shadow-card lg:h-[calc(100vh-13rem)]">
            <div className="flex flex-wrap gap-2 border-b border-border p-4">
              {(["todos", ...REPORT_TYPES] as const).map((key) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                    filter === key
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  {key === "todos" ? "Todos" : `${reportTypes[key].emoji} ${reportTypes[key].label}`}
                </button>
              ))}
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {visible.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  {filter === "todos"
                    ? "Nenhuma denúncia registrada ainda."
                    : "Nenhuma denúncia deste tipo."}
                </p>
              ) : null}

              {visible.map((ticket) => {
                const meta = reportTypes[ticket.type];
                const isSelected = selected === ticket.id;
                return (
                  <button
                    key={ticket.id}
                    ref={(node) => {
                      if (node) cardRefs.current.set(ticket.id, node);
                      else cardRefs.current.delete(ticket.id);
                    }}
                    onClick={() => setSelected(ticket.id)}
                    className={`w-full rounded-xl border p-4 text-left transition-shadow ${
                      isSelected
                        ? "border-primary bg-secondary shadow-float"
                        : "border-border bg-card hover:shadow-card"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span aria-hidden="true" className="text-lg">
                          {meta.emoji}
                        </span>
                        <span className="text-sm font-bold text-foreground">{meta.label}</span>
                      </div>
                      <span className="rounded-full bg-primary px-2.5 py-1 text-[11px] font-extrabold tracking-wide text-primary-foreground uppercase">
                        {formatDaysOpen(ticket)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs font-semibold text-muted-foreground">
                      {ticket.protocol}
                    </p>
                    {ticket.photo ? (
                      <img
                        src={ticket.photo}
                        alt={`Foto da denúncia ${ticket.protocol}`}
                        className="mt-3 h-28 w-full rounded-lg border border-border object-cover"
                      />
                    ) : null}
                    <p className="mt-2 text-sm text-foreground">{ticket.address}</p>
                    {ticket.description ? (
                      <p className="mt-1 text-sm text-muted-foreground italic">
                        “{ticket.description}”
                      </p>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
```

- [ ] **Step 6: Regenerar a árvore de rotas e verificar**

```bash
bun run build && bunx tsc --noEmit
grep -c "interno" src/routeTree.gen.ts; grep -c "denuncias" src/routeTree.gen.ts
grep -rn -e "urgency" -e "formatAge" -e "Urgency" src
```
Expected: build ok; tsc sem saída; `interno` = 0, `denuncias` > 0; o último grep sem saída.

Manual (`bun run dev`, abrir `/denuncias`):
- Subtítulo "7 problemas aguardando a prefeitura — a mais antiga foi feita há 12 dias."
- Chips 🕳️ 2 · 🗑️ 1 · 💡 1 · 💧 1 · 🌿 1 · ❓ 1.
- Mapa com círculos brancos, borda vermelha e emoji; nenhum marcador colorido por idade.
- Cards: mais antiga primeiro, selo vermelho "HÁ 12 DIAS"/"HOJE", descrição entre aspas no card ❓, **nenhum nome ou telefone** em lugar algum (inclusive InfoWindow).
- Clique no card → mapa centraliza e abre InfoWindow; clique no marcador → card é destacado e rolado para a vista.
- **Review Focus 3:** selecione o card 🕳️ AV-1021, depois clique no filtro "💡 Lâmpada queimada" → o InfoWindow fecha e só o marcador 💡 fica no mapa.
- **Review Focus 2:** temporariamente troque o `address` da semente 1 por `"<b>teste</b> Rua X"`, recarregue, selecione-a → o InfoWindow mostra `<b>teste</b>` literal. Desfaça a alteração.
- Header da `/denuncias` mostra "Fazer denúncia" e leva a `/`; na `/`, "Ver denúncias" leva a `/denuncias`. `/interno` mostra a página 404.

- [ ] **Step 7: Commit**

```bash
git add -A src/lib/report-types.ts src/lib/tickets.ts src/routes src/components/Header.tsx src/routeTree.gen.ts
git commit -m "Adiciona tipos de denúncia e página pública /denuncias com emojis

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Buscas de endereço restritas a Almenara

**Files:**
- Modify: `src/lib/geocoding.functions.ts`

**Interfaces:**
- Consumes: nada novo.
- Produces: nenhuma mudança de assinatura — `geocodeAddress` e `suggestAddresses` continuam com os mesmos inputs/outputs; só o texto enviado ao Google muda.

- [ ] **Step 1: Adicionar `withAlmenara`**

Logo abaixo de `const SEARCH_RADIUS_METERS = 60000;` adicione:

```ts
/* Keeps searches inside the city: appends Almenara when the text does not mention it. */
function withAlmenara(text: string) {
  const normalized = text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
  return normalized.includes("almenara") ? text : `${text}, Almenara - MG`;
}
```

(Não exportar: o arquivo é de server functions e o helper só é usado aqui.)

- [ ] **Step 2: Aplicar na busca e no autocomplete**

Em `geocodeAddress`, troque:

```ts
  .handler(async ({ data }) => callGeocode({ address: data.address }));
```

por:

```ts
  .handler(async ({ data }) => callGeocode({ address: withAlmenara(data.address) }));
```

Em `suggestAddresses`, dentro do `JSON.stringify({...})`, troque `input: data.input,` por `input: withAlmenara(data.input),`.

- [ ] **Step 3: Verificar**

```bash
bun run build && bunx tsc --noEmit
```
Expected: ok.

**Review Focus 4** — checagem rápida da lógica com bun (não é teste versionado; é só um sanity check):

```bash
bun -e '
function withAlmenara(text){const n=text.normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase();return n.includes("almenara")?text:`${text}, Almenara - MG`;}
for (const t of ["Rua Joaquim Pedro 890","Rua X, ALMENARA","rua x almenara mg","Rua X, Almenára"]) console.log(JSON.stringify(t),"->",JSON.stringify(withAlmenara(t)));
'
```
Expected: só a primeira linha ganha `, Almenara - MG`; as outras três ficam iguais.

Manual (`bun run dev`, em `/` clique em "Sem foto? Informar o endereço" — ou, se a Task 4 ainda não foi feita, use o campo de endereço atual): digite "Rua Joaquim Pedro" → sugestões são de Almenara; clique "Buscar" com "Rua Manoel Esteves 45" → o ponto cai em Almenara.

- [ ] **Step 4: Commit**

```bash
git add src/lib/geocoding.functions.ts
git commit -m "Acrescenta Almenara nas buscas de endereço sem a cidade

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Formulário de denúncia — foto primeiro, tipo e textos

**Files:**
- Rewrite: `src/routes/index.tsx`

**Interfaces:**
- Consumes: `REPORT_TYPES`, `reportTypes`, `ReportType` (Task 2); `addTicket` com `type`/`description` (Task 2); `geocodeAddress`, `reverseGeocode`, `suggestAddresses`, `placeDetails`, `AddressSuggestion` (existentes); `Header` (Task 2); `ALMENARA_CENTER`, `MAP_STYLES`, `loadGoogleMaps`.
- Produces: rota `/` com o fluxo novo. Nada exportado além de `Route`.

Comportamento-chave (da spec):
- A página **não** pede localização ao abrir.
- `locationStatus`: `"idle"` (nada ainda) → `"locating"` (pedindo GPS do navegador) → `"found"` (ponto + endereço) ou `"manual"` (campo de endereço visível).
- Foto: EXIF GPS → senão, localização do navegador (só se ainda não há ponto) → senão, `"manual"`.
- "Sem foto? Informar o endereço" (em `idle`) e "Não é aqui? Digitar endereço" (em `found`) levam a `"manual"`.
- Clique/arraste no mapa e escolha de endereço levam a `"found"` quando há endereço; se a geocodificação reversa falhar, `"manual"` com o ponto mantido.

- [ ] **Step 1: Substituir `src/routes/index.tsx` inteiro**

```tsx
import { Link, createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Header } from "@/components/Header";
import { ALMENARA_CENTER, MAP_STYLES, loadGoogleMaps } from "@/lib/google-maps-loader";
import { REPORT_TYPES, reportTypes, type ReportType } from "@/lib/report-types";
import { addTicket } from "@/lib/tickets";
import {
  geocodeAddress,
  placeDetails,
  reverseGeocode,
  suggestAddresses,
  type AddressSuggestion,
} from "@/lib/geocoding.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Fazer denúncia — Almenara Vigia" },
      {
        name: "description",
        content:
          "Denuncie buracos, entulho, lâmpadas queimadas e outros problemas de Almenara. A denúncia fica pública no mapa, com a contagem de dias sem solução.",
      },
      { property: "og:title", content: "Almenara Vigia — Denuncie e cobre a prefeitura" },
      {
        property: "og:description",
        content: "Tire uma foto do problema, marque no mapa e pressione a prefeitura por uma solução.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PublicPage,
});

const formSchema = z
  .object({
    type: z.enum(REPORT_TYPES, {
      errorMap: () => ({ message: "Selecione o tipo do problema" }),
    }),
    description: z.string().trim().max(280, "Use no máximo 280 caracteres na descrição"),
    address: z.string().trim().min(5, "Informe ou confirme o endereço do problema").max(250),
    name: z.string().trim().min(3, "Informe seu nome completo").max(100),
    whatsapp: z
      .string()
      .trim()
      .min(10, "Informe um WhatsApp com DDD")
      .max(20)
      .regex(/^[0-9()+\-\s]+$/, "Use apenas números, espaços e parênteses"),
  })
  .superRefine((data, ctx) => {
    if (data.type === "outro" && data.description.length < 10) {
      ctx.addIssue({
        code: "custom",
        path: ["description"],
        message: "Descreva o problema com pelo menos 10 caracteres",
      });
    }
  });

type LocationStatus = "idle" | "locating" | "found" | "manual";

const locationHints: Record<LocationStatus, string> = {
  idle: "Comece pela foto do problema — a gente tenta achar o local sozinho.",
  locating: "Buscando sua localização...",
  found: "Local encontrado. Confira e complete a denúncia.",
  manual: "Digite o endereço ou toque no mapa para marcar o local.",
};

/* Shrinks a camera photo so it can be kept alongside the report. */
async function shrinkPhoto(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const max = 1000;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.75);
}

/* Asks the browser for the device location; resolves null when denied or unavailable. */
function browserLocation(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  });
}

const inputClass =
  "mt-2 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/25";
const labelClass = "text-xs font-semibold tracking-wide text-muted-foreground uppercase";

function PublicPage() {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapObj = useRef<any>(null);
  const markerObj = useRef<any>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const sessionToken = useRef<string>("");
  const suggestRequest = useRef(0);

  const [point, setPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [address, setAddress] = useState("");
  const [locationStatus, setLocationStatus] = useState<LocationStatus>("idle");
  const [type, setType] = useState<ReportType | "">("");
  const [description, setDescription] = useState("");
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoNote, setPhotoNote] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [protocol, setProtocol] = useState<string | null>(null);

  const findAddress = useServerFn(geocodeAddress);
  const findPoint = useServerFn(reverseGeocode);
  const findSuggestions = useServerFn(suggestAddresses);
  const findPlace = useServerFn(placeDetails);

  function ensureSession() {
    if (!sessionToken.current) sessionToken.current = crypto.randomUUID();
    return sessionToken.current;
  }

  const placeMarker = useCallback((coords: { lat: number; lng: number }, zoom = 17) => {
    setPoint(coords);
    const map = mapObj.current;
    if (!map) return;
    map.setCenter(coords);
    map.setZoom(zoom);
    markerObj.current?.setVisible(true);
    markerObj.current?.setPosition(coords);
  }, []);

  /* Fills the address for a point; falls back to typing when it cannot be resolved. */
  const resolveAddress = useCallback(
    async (coords: { lat: number; lng: number }) => {
      try {
        const result = await findPoint({ data: coords });
        if (result) {
          setAddress(result.address);
          setLocationStatus("found");
          return;
        }
      } catch {
        // handled below
      }
      setAddress("");
      setLocationStatus("manual");
      setError("Não conseguimos identificar o endereço deste ponto. Digite-o abaixo.");
    },
    [findPoint],
  );

  // Load the map
  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then((maps) => {
        if (cancelled || !mapRef.current) return;
        const map = new maps.Map(mapRef.current, {
          center: ALMENARA_CENTER,
          zoom: 15,
          styles: MAP_STYLES,
          clickableIcons: false,
          mapTypeControl: false,
          streetViewControl: false,
        });
        mapObj.current = map;

        const marker = new maps.Marker({
          map,
          draggable: true,
          icon: {
            path: maps.SymbolPath.CIRCLE,
            scale: 11,
            fillColor: "#a51212",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 3,
          },
        });
        markerObj.current = marker;
        marker.setVisible(false);

        const apply = (coords: { lat: number; lng: number }) => {
          setPoint(coords);
          setShowSuggestions(false);
          setError(null);
          void resolveAddress(coords);
        };

        marker.addListener("dragend", () => {
          const pos = marker.getPosition();
          apply({ lat: pos.lat(), lng: pos.lng() });
        });

        map.addListener("click", (event: any) => {
          const coords = { lat: event.latLng.lat(), lng: event.latLng.lng() };
          marker.setVisible(true);
          marker.setPosition(coords);
          apply(coords);
        });
      })
      .catch(() => setError("Não foi possível carregar o mapa agora."));

    return () => {
      cancelled = true;
    };
  }, [resolveAddress]);

  // Address suggestions while typing
  useEffect(() => {
    const term = address.trim();
    if (term.length < 3 || !showSuggestions) {
      setSuggestions([]);
      return;
    }
    const id = ++suggestRequest.current;
    const timer = setTimeout(() => {
      void findSuggestions({ data: { input: term, sessionToken: ensureSession() } })
        .then((results) => {
          if (id === suggestRequest.current) setSuggestions(results);
        })
        .catch(() => {
          if (id === suggestRequest.current) setSuggestions([]);
        });
    }, 300);
    return () => clearTimeout(timer);
  }, [address, showSuggestions, findSuggestions]);

  async function chooseSuggestion(suggestion: AddressSuggestion) {
    setShowSuggestions(false);
    setSuggestions([]);
    setAddress(suggestion.label);
    setError(null);
    try {
      const result = await findPlace({
        data: { placeId: suggestion.placeId, sessionToken: ensureSession() },
      });
      sessionToken.current = "";
      if (!result) {
        setError("Não conseguimos localizar esse endereço no mapa.");
        return;
      }
      if (result.address) setAddress(result.address);
      placeMarker({ lat: result.lat, lng: result.lng });
      setLocationStatus("found");
    } catch {
      setError("Não conseguimos confirmar esse endereço agora.");
    }
  }

  async function handleSearch() {
    setError(null);
    setShowSuggestions(false);
    if (address.trim().length < 5) {
      setError("Digite um endereço mais completo para buscar.");
      return;
    }
    setSearching(true);
    try {
      const result = await findAddress({ data: { address: address.trim() } });
      if (!result) {
        setError("Endereço não encontrado. Tente incluir número e bairro.");
        return;
      }
      setAddress(result.address);
      placeMarker({ lat: result.lat, lng: result.lng });
      setLocationStatus("found");
    } catch {
      setError("Não conseguimos consultar o endereço agora. Tente novamente.");
    } finally {
      setSearching(false);
    }
  }

  async function handlePhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError(null);
    setPhotoNote("Lendo a foto...");

    let gps: { latitude?: number; longitude?: number } | null = null;
    try {
      const exifr = await import("exifr");
      gps = await exifr.gps(file).catch(() => null);
      setPhoto(await shrinkPhoto(file));
    } catch {
      setPhotoNote(null);
      setError("Não conseguimos ler essa foto. Tente outra imagem.");
      return;
    }

    // 1. Location saved in the photo itself
    if (gps && typeof gps.latitude === "number" && typeof gps.longitude === "number") {
      const coords = { lat: gps.latitude, lng: gps.longitude };
      setPhotoNote("Foto anexada — usamos a localização registrada na própria foto.");
      placeMarker(coords, 18);
      await resolveAddress(coords);
      return;
    }

    // A location is already set: swapping the photo must not move it
    if (point) {
      setPhotoNote("Foto anexada.");
      return;
    }

    // 2. Device location (phones often strip GPS from uploaded photos)
    setPhotoNote("A foto não tem localização. Pedindo a localização do seu aparelho...");
    setLocationStatus("locating");
    const coords = await browserLocation();
    if (coords) {
      setPhotoNote("Foto anexada — usamos a localização do seu aparelho.");
      placeMarker(coords, 18);
      await resolveAddress(coords);
      return;
    }

    // 3. Typed address
    setPhotoNote("Foto anexada, mas não conseguimos a localização. Informe o endereço abaixo.");
    setLocationStatus("manual");
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!point) {
      setError("Marque o local do problema no mapa ou informe o endereço.");
      return;
    }
    const parsed = formSchema.safeParse({ type, description, address, name, whatsapp });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Verifique os dados informados.");
      return;
    }
    const ticket = addTicket({
      type: parsed.data.type,
      ...(parsed.data.type === "outro" ? { description: parsed.data.description } : {}),
      name: parsed.data.name,
      whatsapp: parsed.data.whatsapp,
      address: parsed.data.address,
      lat: point.lat,
      lng: point.lng,
      ...(photo ? { photo } : {}),
    });
    setProtocol(ticket.protocol);
  }

  function resetForm() {
    setProtocol(null);
    setPoint(null);
    setAddress("");
    setLocationStatus("idle");
    setType("");
    setDescription("");
    setName("");
    setWhatsapp("");
    setPhoto(null);
    setPhotoNote(null);
    setError(null);
    markerObj.current?.setVisible(false);
    mapObj.current?.setCenter(ALMENARA_CENTER);
    mapObj.current?.setZoom(15);
  }

  return (
    <div className="min-h-screen bg-background font-sans">
      <Header />

      <section
        className="px-4 py-10 text-primary-foreground sm:px-6"
        style={{ background: "var(--gradient-hero)" }}
      >
        <div className="mx-auto w-full max-w-[1400px]">
          <p className="text-xs font-semibold tracking-[0.18em] text-accent uppercase">
            Almenara Vigia · Denúncia comunitária
          </p>
          <h1 className="mt-3 max-w-2xl text-3xl leading-tight font-bold sm:text-4xl">
            Viu um problema na cidade? Denuncie e cobre a prefeitura.
          </h1>
          <p className="mt-3 max-w-xl text-sm text-primary-foreground/80">
            Cada denúncia fica pública no mapa, com a contagem de dias sem solução. Comece pela
            foto — a gente tenta achar o local sozinho.
          </p>
        </div>
      </section>

      <main className="mx-auto grid w-full max-w-[1400px] gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,420px)_1fr]">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
          {protocol ? (
            <div className="text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-secondary text-2xl">
                ✓
              </div>
              <h2 className="mt-4 text-xl font-bold text-foreground">Denúncia registrada!</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Seu protocolo é <span className="font-semibold text-primary">{protocol}</span>.
                Ela já aparece no mapa público, contando os dias até a prefeitura resolver.
              </p>
              <Link
                to="/denuncias"
                className="mt-6 block w-full rounded-xl bg-primary px-4 py-3 text-center text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                Ver no mapa de denúncias
              </Link>
              <button
                onClick={resetForm}
                className="mt-3 w-full rounded-xl border border-primary/25 bg-secondary px-4 py-3 text-sm font-semibold text-primary"
              >
                Fazer outra denúncia
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <h2 className="text-lg font-bold text-foreground">Nova denúncia</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {locationHints[locationStatus]}
                </p>
              </div>

              <div>
                <span className={labelClass}>Foto do problema</span>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(event) => void handlePhoto(event)}
                  className="hidden"
                />
                <div className="mt-2 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    className="flex-1 rounded-xl border border-dashed border-primary/40 bg-secondary/60 px-3 py-4 text-sm font-semibold text-primary"
                  >
                    {photo ? "📷 Trocar foto" : "📷 Tirar foto ou escolher da galeria"}
                  </button>
                  {photo ? (
                    <img
                      src={photo}
                      alt="Foto do problema enviada"
                      className="h-14 w-14 rounded-xl border border-border object-cover"
                    />
                  ) : null}
                </div>
                {photoNote ? (
                  <p className="mt-2 text-xs text-muted-foreground">{photoNote}</p>
                ) : null}
                {locationStatus === "idle" ? (
                  <button
                    type="button"
                    onClick={() => setLocationStatus("manual")}
                    className="mt-2 text-xs font-semibold text-primary underline underline-offset-2"
                  >
                    Sem foto? Informar o endereço
                  </button>
                ) : null}
              </div>

              {locationStatus === "found" ? (
                <div>
                  <span className={labelClass}>Local do problema</span>
                  <div className="mt-2 rounded-xl bg-muted px-3 py-2.5 text-sm text-foreground">
                    📍 Local encontrado: {address}
                  </div>
                  <button
                    type="button"
                    onClick={() => setLocationStatus("manual")}
                    className="mt-2 text-xs font-semibold text-primary underline underline-offset-2"
                  >
                    Não é aqui? Digitar endereço
                  </button>
                </div>
              ) : null}

              {locationStatus === "manual" ? (
                <div>
                  <label htmlFor="address" className={labelClass}>
                    Local do problema
                  </label>
                  <div className="mt-2 flex gap-2">
                    <div className="relative min-w-0 flex-1">
                      <input
                        id="address"
                        autoFocus
                        value={address}
                        onChange={(event) => {
                          setAddress(event.target.value);
                          setShowSuggestions(true);
                        }}
                        onFocus={() => setShowSuggestions(true)}
                        onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                        autoComplete="off"
                        placeholder="Rua, número e bairro"
                        maxLength={250}
                        className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/25"
                      />
                      {showSuggestions && suggestions.length > 0 ? (
                        <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-border bg-card shadow-float">
                          {suggestions.map((suggestion) => (
                            <li key={suggestion.placeId}>
                              <button
                                type="button"
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => void chooseSuggestion(suggestion)}
                                className="w-full px-3 py-2.5 text-left text-sm text-foreground hover:bg-secondary"
                              >
                                {suggestion.label}
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleSearch()}
                      disabled={searching}
                      className="rounded-xl border border-primary/25 bg-secondary px-3 py-2.5 text-sm font-semibold text-primary disabled:opacity-60"
                    >
                      {searching ? "..." : "Buscar"}
                    </button>
                  </div>
                  <p className="mt-2 rounded-xl bg-muted px-3 py-2.5 text-xs text-muted-foreground">
                    {point
                      ? `Ponto marcado: ${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`
                      : "Nenhum ponto marcado no mapa ainda."}
                  </p>
                </div>
              ) : null}

              <div>
                <label htmlFor="type" className={labelClass}>
                  Tipo do problema
                </label>
                <select
                  id="type"
                  value={type}
                  onChange={(event) => setType(event.target.value as ReportType | "")}
                  className={inputClass}
                >
                  <option value="" disabled>
                    Selecione o tipo do problema
                  </option>
                  {REPORT_TYPES.map((key) => (
                    <option key={key} value={key}>
                      {reportTypes[key].emoji} {reportTypes[key].label}
                    </option>
                  ))}
                </select>
              </div>

              {type === "outro" ? (
                <div>
                  <label htmlFor="description" className={labelClass}>
                    Descreva o problema
                  </label>
                  <textarea
                    id="description"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Ex.: placa de trânsito caída na esquina"
                    rows={3}
                    maxLength={280}
                    className={`${inputClass} resize-none`}
                  />
                  <p className="mt-1 text-right text-xs text-muted-foreground">
                    {description.trim().length}/280
                  </p>
                </div>
              ) : null}

              <div>
                <label htmlFor="name" className={labelClass}>
                  Seu nome
                </label>
                <input
                  id="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Nome completo"
                  maxLength={100}
                  className={inputClass}
                />
              </div>

              <div>
                <label htmlFor="whatsapp" className={labelClass}>
                  WhatsApp
                </label>
                <input
                  id="whatsapp"
                  value={whatsapp}
                  onChange={(event) => setWhatsapp(event.target.value)}
                  placeholder="(33) 99999-0000"
                  inputMode="tel"
                  maxLength={20}
                  className={inputClass}
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  Seu nome e WhatsApp não aparecem publicamente.
                </p>
              </div>

              {error ? (
                <p className="rounded-xl bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                Enviar denúncia
              </button>
            </form>
          )}
        </div>

        <div className="relative min-h-[420px] overflow-hidden rounded-2xl border border-border bg-muted shadow-card lg:min-h-[560px]">
          <div ref={mapRef} className="absolute inset-0" />
          <div className="pointer-events-none absolute top-4 left-4 rounded-full bg-card/95 px-4 py-2 text-xs font-semibold text-foreground shadow-float">
            Toque no mapa para ajustar o local
          </div>
        </div>
      </main>
    </div>
  );
}
```

Notas para o implementador:
- `z.enum(REPORT_TYPES, { errorMap })` é a sintaxe do zod **v3** (o projeto usa 3.25; `import { z } from "zod"` é v3). Não usar `{ message }` (sintaxe v4).
- `type` vazio (`""`) falha no enum e mostra "Selecione o tipo do problema".
- A linha temporária `type: "lampada"` da Task 2 desaparece com esta substituição.

- [ ] **Step 2: Verificar build e resíduos**

```bash
bun run build && bunx tsc --noEmit
grep -rn -i -e "cemig" -e "poste" -e "chamado" src --include="*.tsx" --include="*.ts" | grep -v routeTree.gen
```
Expected: build ok; tsc sem saída; grep sem saída.

- [ ] **Step 3: Verificação manual (`bun run dev`, abrir `/`)**

Use o DevTools (Sensors → Location; e as permissões de localização do site) para simular.

- Ao abrir a página, o navegador **não** pede localização; dica "Comece pela foto do problema…"; seção de local oculta.
- **Foto com GPS** (qualquer JPG de câmera com GPS, ou baixe um de exemplo com EXIF GPS): marcador aparece, "📍 Local encontrado: …" preenchido, nota "usamos a localização registrada na própria foto".
- **Foto sem GPS + localização permitida** (ex.: screenshot PNG; DevTools com localização de Almenara `-16.1836, -40.6947`): o navegador pede permissão só agora; após permitir, local encontrado.
- **Review Focus 1 — foto sem GPS + localização negada**: bloquear localização do site → o campo de endereço aparece com foco e a nota "não conseguimos a localização"; buscar endereço, preencher tipo/nome/WhatsApp e enviar → protocolo `AV-1043`.
- **Review Focus 5 — trocar a foto**: com o local já definido, trocar por uma foto sem GPS → nada é perguntado, o ponto não se move, nota "Foto anexada."; trocar por foto com GPS → o ponto vai para o GPS da foto.
- **Sem foto**: clicar "Sem foto? Informar o endereço" → campo aparece; escolher sugestão → "📍 Local encontrado"; "Não é aqui? Digitar endereço" volta ao campo com o texto preservado.
- Clique no mapa em qualquer estado → ponto move e endereço é preenchido (estado "found").
- Enviar sem tipo → "Selecione o tipo do problema". Tipo ❓ Outro sem descrição → "Descreva o problema com pelo menos 10 caracteres"; com descrição → envia. Trocar de "Outro" para "Buraco" esconde o campo.
- Tela de confirmação: "Denúncia registrada!", protocolo, "Ver no mapa de denúncias" abre `/denuncias` e a nova denúncia aparece com selo "HOJE" (e a descrição, se for Outro), sem nome/WhatsApp. Voltar e "Fazer outra denúncia" → formulário limpo, marcador escondido, estado idle.
- Largura 375px: formulário e mapa empilhados, sem rolagem horizontal.

- [ ] **Step 4: Commit**

```bash
git add src/routes/index.tsx
git commit -m "Reescreve formulário: foto primeiro, tipo de denúncia e textos do Almenara Vigia

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Lint limpo

O lint já falhava antes deste trabalho (14 erros: `no-explicit-any` no código do Google Maps, que é carregado sem tipos, e formatação prettier). A spec exige lint passando.

**Files:**
- Modify: `src/lib/google-maps-loader.ts`, `src/routes/index.tsx`, `src/routes/denuncias.tsx` (+ qualquer arquivo tocado que o prettier reformatar)

**Interfaces:** nenhuma mudança.

- [ ] **Step 1: Liberar `any` nos arquivos que usam a API do Google Maps**

Adicione como **primeira linha** de `src/lib/google-maps-loader.ts`, `src/routes/index.tsx` e `src/routes/denuncias.tsx`:

```ts
/* eslint-disable @typescript-eslint/no-explicit-any -- Google Maps JS API é carregada sem tipos */
```

- [ ] **Step 2: Formatar os arquivos tocados**

```bash
bunx prettier --write src/lib src/routes/index.tsx src/routes/denuncias.tsx src/routes/__root.tsx src/components/Header.tsx src/styles.css
```

- [ ] **Step 3: Verificar**

```bash
bun run lint && bun run build && bunx tsc --noEmit
```
Expected: lint sai com código 0 (restam só os 6 *warnings* `react-refresh` pré-existentes em `src/components/ui/*`); build e tsc ok. Se o lint apontar algo novo (ex.: regra de react-hooks), corrija no arquivo apontado e rode de novo.

- [ ] **Step 4: Commit**

```bash
git add -A src
git commit -m "Deixa o lint passando (tipos do Google Maps e formatação)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
