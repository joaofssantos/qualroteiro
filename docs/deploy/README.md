# Deploy: Vercel + Render + Neon

Este guia prepara o Qual roteiro para três serviços: web estático no Vercel,
API Node no Render e banco PostgreSQL com PostGIS no Neon. Não cria contas nem
publica nada automaticamente.

Veredito: preparação pronta para revisão; a publicação depende das contas e
variáveis que só o dono pode cadastrar.

## Escolha do banco

Recomendação: **Neon** para o banco de produção, usando uma `DATABASE_URL`
externa no Render. O Postgres gratuito do Render aceita PostGIS, mas expira 30
dias depois de criado; após mais 14 dias de carência, os dados são apagados.
O Neon Free oferece Postgres durável com PostGIS e evita esse prazo de expiração.

O Render continua sendo adequado para a API. No plano Free ela pode hibernar
quando ociosa; a primeira requisição após isso pode demorar. Para uso contínuo,
subir o serviço do Render para um plano pago é a evolução natural.

Referências oficiais: [limites gratuitos do Render](https://render.com/docs/free),
[extensões do Render Postgres](https://render.com/docs/postgresql-extensions) e
[Neon Free](https://neon.com/blog/neon-free-plan-1-gb-per-project).

## Variáveis de ambiente

Guarde os valores no cofre antes de colá-los nos provedores, com referências
`vault://qualroteiro-*`. Nunca coloque valores em arquivos versionados.

### API (Render)

| Variável | Necessária | Observação |
| --- | --- | --- |
| `DATABASE_URL` | Sim | URL **pooled** do Neon (host com `-pooler`) e `?sslmode=require`, usada pela API. |
| `DIRECT_DATABASE_URL` | Sim | URL direta do Neon, **sem** `-pooler` e com `?sslmode=require`, usada por `prisma migrate deploy` sem advisory-lock no pooler. |
| `ORS_API_KEY` | Sim | Chave do OpenRouteService, usada somente pela API. |
| `ORS_BASE_URL` | Não | Normalmente `https://api.openrouteservice.org`. |
| `CLERK_SECRET_KEY` | Sim | Chave secreta de backend do Clerk. |
| `GOOGLE_PLACES_API_KEY` | Sim | Chave server-side do Google Places (New). |
| `GOOGLE_PLACES_SEARCH_MONTHLY_CAP` | Não | Limite mensal; se omitida, a API usa `4500`. |
| `CORS_ORIGIN` | Sim em produção | URL do Vercel sem barra final; aceita várias URLs separadas por vírgula e um `*` em um único segmento de subdomínio (por exemplo, produção + `https://qualroteiro-*.vercel.app`). |
| `TRUST_PROXY` | Já definida em `render.yaml` (`1`) | Um salto de proxy (Render); veja a seção sobre proxy confiável abaixo. |
| `RATE_LIMIT_PLAN_ENABLED`, `RATE_LIMIT_PLAN_MAX`, `RATE_LIMIT_PLAN_WINDOW` | Não | Limite de `POST /routes/plan` por IP (padrão: 120 requisições por 60000 ms). |
| `PORT` | Não configurar | O Render injeta esta variável e a API já a lê. |

`REDIS_URL`, `VALHALLA_URL` e `PHOTON_URL` **não são variáveis de runtime da
API**. Redis só é necessário para o worker agendado de ingestão; Valhalla e
Photon são serviços locais legados e a API usa OpenRouteService em produção.

### Web (Vercel)

| Variável | Necessária | Observação |
| --- | --- | --- |
| `VITE_API_BASE_URL` | Sim | URL pública HTTPS da API Render, sem `/api` no final. É embutida no build e é pública. |
| `VITE_CLERK_PUBLISHABLE_KEY` | Sim para login | Chave publicável do Clerk; pode aparecer no JavaScript entregue ao navegador. |
| `VITE_DEMO_MODE` | Não | Deixe ausente ou `false` em produção. |
| `VITE_MAP_STYLE_URL` | Não | Tem um padrão sem chave; só altere se adotar outro provedor de mapa. |

## O que o dono faz

1. Crie contas no Vercel, Render, Neon e Clerk (se ainda não existirem) e
   conecte todas ao GitHub. No Neon, crie um projeto PostgreSQL na região mais
   próxima do Render. Habilitar PostGIS manualmente (`CREATE EXTENSION IF NOT EXISTS postgis;`) é opcional: a migration já executa `CREATE EXTENSION IF NOT EXISTS`.
2. Guarde cada valor sensível no cofre, por exemplo
   `vault://qualroteiro-database-url`, `vault://qualroteiro-ors-api-key`,
   `vault://qualroteiro-clerk-secret-key` e
   `vault://qualroteiro-google-places-api-key`. As referências são apenas
   nomes; não coloque o valor em issue, commit ou chat.
3. No Render, crie um Blueprint a partir deste repositório. Ele encontrará
   `render.yaml`. Escolha a branch desejada e informe as variáveis de API da
   tabela acima. Em `DATABASE_URL`, use a URL pooled do Neon (host `-pooler`)
   com `?sslmode=require`; em `DIRECT_DATABASE_URL`, a URL direta sem
   `-pooler`, também com `?sslmode=require`. Defina `CORS_ORIGIN` depois de
   obter a URL do Vercel, por exemplo
   `https://qualroteiro.vercel.app,https://qualroteiro-*.vercel.app`.
4. Faça o primeiro deploy da API no Render. O `buildCommand` compila a API e
   executa `prisma migrate deploy`, portanto as migrations versionadas chegam
   ao Neon antes da nova versão iniciar.
5. Confirme `GET https://<api-render>/health` com resposta
   `{ "status": "ok" }`.
6. No Vercel, importe o mesmo repositório. O `vercel.json` usa pnpm/Turbo,
   gera `apps/web/dist` e redireciona rotas de SPA para `index.html`. Cadastre
   as variáveis da tabela Web e publique.
7. Copie a URL final do Vercel para `CORS_ORIGIN` no Render e redeploy a API.
   Para previews da PR, inclua também o padrão de um único subdomínio
   `https://qualroteiro-*.vercel.app`; ele não aceita domínios com sufixos ou
   caminhos extras.
8. No Clerk, abra a instância de produção e adicione o domínio Vercel em
   **Allowed origins/redirect URLs**. Configure também as URLs de sign-in e
   sign-up para esse domínio. Use a chave publicável no Vercel e a secreta no
   Render — nunca troque as duas.

## Carga inicial e atualização de pedágios

Depois das migrations e antes de validar rotas reais, execute estes comandos
uma vez num ambiente seguro que tenha acesso à mesma `DATABASE_URL` do Neon:

```sh
pnpm --filter @qualroteiro/data-ingest ingest:once
pnpm --filter @qualroteiro/data-ingest ingest:osm:once
pnpm --filter @qualroteiro/data-ingest audit:artesp:once
```

Os dois primeiros escrevem, respectivamente, as praças ANTT e OSM. O terceiro
somente gera uma auditoria ARTESP e não altera o banco. Eles não precisam de
Redis; `DATABASE_URL` é suficiente. Para agendamento mensal futuro, o comando
`pnpm --filter @qualroteiro/data-ingest worker` exige `REDIS_URL`, mas esse
worker não faz parte deste deploy gratuito inicial.

## Validação após publicar

1. Confira `/health` no Render.
2. Confira `GET /admin/toll-plazas-status`: os contadores `antt` e `osm` devem
   ser maiores que zero depois da carga.
3. No Vercel, abra uma rota direta da SPA (por exemplo `/planejamento`) e
   recarregue a página: ela deve continuar abrindo, graças ao rewrite.
4. Faça uma rota e uma busca de lugar; confira no DevTools que a chamada vai
   para a URL Render e não há erro CORS.
5. Entre e salve uma viagem para validar Clerk, CORS autenticado e Postgres.

## Arquivos desta preparação

- `vercel.json`: build do monorepo, diretório estático e fallback de SPA.
- `render.yaml`: serviço Node Free em Oregon, health check e env vars sem
  valores (`sync: false`).
- `apps/api/package.json`: `prisma:migrate:deploy` para migrations seguras em
  produção.

## Proxy confiável e limite de taxa (`TRUST_PROXY`)

The API runs behind one Render reverse-proxy hop. `render.yaml` therefore sets
`TRUST_PROXY=1`: Fastify trusts only that immediate proxy when resolving
`request.ip`, so `POST /routes/plan` rate limits the real client rather than a
single shared Render IP. Do not set this to `true` or a larger hop count unless
the network topology is verified: it would let an untrusted `X-Forwarded-For`
entry select a different rate-limit bucket.

`TRUST_PROXY` is disabled by default outside Render. It accepts a positive hop
count or a comma-separated CIDR allow-list. The rate-limit store is in memory
per API process, so separate replicas do not share a bucket.

Keep `DATABASE_URL`, `DIRECT_DATABASE_URL`, `ORS_API_KEY`,
`CLERK_SECRET_KEY`, `GOOGLE_PLACES_API_KEY`, and `CORS_ORIGIN` as Render secret
environment variables; do not commit their values.
