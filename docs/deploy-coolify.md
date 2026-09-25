# Banco de dados, Docker e deploy no Coolify

O app (TanStack Start) grava as denúncias num Postgres. As fotos ficam no próprio banco, na
tabela `report_photos` (coluna `bytea`), e são servidas em `/fotos/<id>`.

## Desenvolvimento local

```sh
cp .env.example .env            # preencha as chaves do Google Maps
docker compose -f docker-compose.dev.yml up -d   # só o Postgres, em 127.0.0.1:5433
bun run db:migrate              # cria as tabelas
bun run db:seed                 # opcional: 7 denúncias de exemplo (só se o banco estiver vazio)
bun dev
```

Outros comandos:

- `bun run db:studio`: abre o Drizzle Studio para ver e editar os dados.
- `bun run db:generate`: depois de mudar `src/db/schema.ts`, gera a migration em `drizzle/`.
  Faça commit dela; a produção aplica sozinha no próximo deploy.

## Rodar tudo localmente como em produção

```sh
POSTGRES_PASSWORD=troque-isto docker compose up -d --build
```

Isso sobe o `db` (Postgres 17, volume `pgdata`) e o `app` na porta 3000 (ou `APP_PORT`). Serve
para testar localmente; em produção o banco é um recurso separado no Coolify (veja abaixo). A cada
subida, o `app` aplica as migrations pendentes e depois inicia o servidor. As variáveis também
podem ficar num arquivo `.env` ao lado do `docker-compose.yml`.

| Variável                       | Quando                | Para quê                                                                                                                  |
| ------------------------------ | --------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `POSTGRES_PASSWORD`            | runtime (obrigatória) | senha do banco. Use só letras e números, porque ela entra na URL de conexão                                               |
| `POSTGRES_USER`, `POSTGRES_DB` | runtime (opcionais)   | padrão `vigia`                                                                                                            |
| `VITE_GOOGLE_MAPS_API_KEY`     | **build**             | chave do Maps no navegador; é embutida no JavaScript no build                                                             |
| `GOOGLE_MAPS_API_KEY`          | runtime               | chave do servidor (geocoding), sem restrição de referer                                                                   |
| `AFFECTED_IP_SECRET`           | runtime (obrigatória) | segredo do hash do IP no "Me afeta também". Gere com `openssl rand -hex 32`; trocar só zera o limite por rede             |
| `AFFECTED_MAX_PER_IP`          | runtime (opcional)    | quantas pessoas da mesma rede podem marcar a mesma denúncia (padrão 3)                                                    |
| `BETA_WHATSAPPS`               | runtime (obrigatória) | WhatsApps que podem registrar denúncias, separados por vírgula (ex.: `33999166432,33988887777`). Vazia = ninguém denuncia |
| `APP_PORT`                     | opcional              | porta do host para o app (padrão 3000)                                                                                    |

> Máquina atrás de proxy que inspeciona HTTPS: se o `bun install` do build falhar com
> `SELF_SIGNED_CERT_IN_CHAIN`, crie um `docker-compose.override.yml` (já está no `.gitignore`)
> que passa o certificado como build secret `extra_ca`:
>
> ```yaml
> services:
>   app:
>     build:
>       secrets: [extra_ca]
> secrets:
>   extra_ca:
>     file: ${NODE_EXTRA_CA_CERTS}
> ```

## Deploy no Coolify (VPS Hostinger)

Em produção, banco e app são **dois recursos separados** no mesmo projeto do Coolify. O banco
tem ciclo de vida e backup próprios, e um redeploy do app nunca mexe nele. O
`docker-compose.yml` não é usado no deploy.

### 1. Banco

1. **New Resource → Database → PostgreSQL**, versão 17, no mesmo projeto e ambiente em que o
   app vai ficar.
2. Deixe o banco **sem acesso público** (_Make it publicly available_ desligado).
3. Inicie o banco e copie a **Postgres URL (internal)**. Ela é o `DATABASE_URL` do app.

### 2. App

1. **New Resource → Public/Private Repository**, escolha este repositório e o branch `main`.
2. **Build Pack: Dockerfile** (usa o `Dockerfile` da raiz). **Ports Exposes: `3000`**.
3. Em **Environment Variables**:

   | Variável                   | Tipo               | Valor                                                 |
   | -------------------------- | ------------------ | ----------------------------------------------------- |
   | `DATABASE_URL`             | runtime            | a Postgres URL (internal) do passo anterior           |
   | `GOOGLE_MAPS_API_KEY`      | runtime            | chave do servidor (geocoding)                         |
   | `AFFECTED_IP_SECRET`       | runtime            | `openssl rand -hex 32`                                |
   | `AFFECTED_MAX_PER_IP`      | runtime (opcional) | padrão `3`                                            |
   | `BETA_WHATSAPPS`           | runtime            | ex.: `33999166432`                                    |
   | `VITE_GOOGLE_MAPS_API_KEY` | **Build Variable** | chave do navegador; é embutida no JavaScript no build |

4. Defina o domínio (ex.: `https://vigia.seudominio.com.br`). O Coolify emite o HTTPS.
5. **Deploy.** Nos logs devem aparecer `Migrations aplicadas.` e `Listening on`. As migrations
   rodam a cada subida do container; as que já foram aplicadas são puladas.
6. No Google Cloud, libere o domínio novo nas restrições de referer da chave do navegador.

### 3. Backup (não pule)

As denúncias e as fotos vivem só no banco.

1. No recurso do Postgres, abra **Backups** e crie um backup agendado (ex.: diário, `0 3 * * *`).
2. Em **Settings → S3 Storages** do Coolify, cadastre um storage externo (Backblaze B2,
   Cloudflare R2, AWS S3…) e marque o backup para enviar para ele. Backup só na própria VPS não
   protege contra perder a VPS.
3. Teste uma restauração pelo menos uma vez, pela própria tela de backups do Coolify.
