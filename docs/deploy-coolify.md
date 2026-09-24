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

## Rodar como em produção

```sh
POSTGRES_PASSWORD=troque-isto docker compose up -d --build
```

Isso sobe o `db` (Postgres 17, volume `pgdata`) e o `app` na porta 3000 (ou `APP_PORT`). A cada
subida, o `app` aplica as migrations pendentes e depois inicia o servidor. As variáveis também
podem ficar num arquivo `.env` ao lado do `docker-compose.yml`.

| Variável | Quando | Para quê |
|---|---|---|
| `POSTGRES_PASSWORD` | runtime (obrigatória) | senha do banco. Use só letras e números, porque ela entra na URL de conexão |
| `POSTGRES_USER`, `POSTGRES_DB` | runtime (opcionais) | padrão `vigia` |
| `VITE_GOOGLE_MAPS_API_KEY` | **build** | chave do Maps no navegador; é embutida no JavaScript no build |
| `GOOGLE_MAPS_API_KEY` | runtime | chave do servidor (geocoding), sem restrição de referer |
| `APP_PORT` | opcional | porta do host para o app (padrão 3000) |

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

1. **New Resource → Public/Private Repository**, escolha este repositório e o branch.
2. **Build Pack: Docker Compose**, arquivo `docker-compose.yml`.
3. Em **Environment Variables**, cadastre `POSTGRES_PASSWORD`, `VITE_GOOGLE_MAPS_API_KEY`
   (marque como *Build Variable*) e `GOOGLE_MAPS_API_KEY`.
4. No serviço `app`, defina o domínio (ex.: `https://vigia.seudominio.com.br:3000`; o `:3000`
   diz ao proxy do Coolify em que porta o container escuta). O Coolify emite o HTTPS.
5. Se a porta 3000 do servidor já estiver em uso por outro app, defina `APP_PORT` com outra
   porta. O acesso público passa pelo proxy do Coolify de qualquer forma.
6. **Deploy.** Nos logs do `app` devem aparecer `Migrations aplicadas.` e `Listening on`.
7. Confira a chave do Maps do navegador: no Google Cloud, libere o domínio novo nas restrições
   de referer.

### Backup (não pule)

Os dados e as fotos vivem só no volume `pgdata`.

- Veja se o Coolify oferece **Scheduled Backups** para o serviço `db` desse compose e, se
  oferecer, configure um backup diário com envio para um storage S3 externo.
- Se não oferecer, crie uma **Scheduled Task** no Coolify, no serviço `db`, rodando diariamente:
  `pg_dump -U vigia -Fc vigia > /var/lib/postgresql/data/backup-$(date +%F).dump`,
  e copie esses arquivos para fora da VPS.
- Para restaurar: `pg_restore -U vigia -d vigia --clean backup-AAAA-MM-DD.dump`.
