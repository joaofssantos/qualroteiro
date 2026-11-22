# qualroteiro

[![CI](https://github.com/joaofssantos/qualroteiro/actions/workflows/ci.yml/badge.svg)](https://github.com/joaofssantos/qualroteiro/actions/workflows/ci.yml)

Planejador de rotas e viagens rodoviárias no Brasil. Junta o cálculo de custo de
estrada (pedágio, combustível, frete ANTT) com o planejamento completo da viagem
(roteiro dia a dia, lugares, atividades, orçamento, conversões).

## Monorepo

```
apps/
  web/        React + Vite + TS + Tailwind + shadcn/ui + MapLibre GL
  api/        Fastify + Prisma + PostgreSQL/PostGIS
packages/
  fuel/       cálculo de combustível
  geo/        tipos e utilitários geográficos
  routing/    contratos de roteamento
  tolls/      cálculo de pedágios
  trips/      planejamento de viagens
services/
  data-ingest/  workers BullMQ (ANTT, ANP, DNIT, concessionárias, catálogo)
infra/        Docker Compose (postgres, redis; valhalla e photon existem no compose, mas não são usados em runtime)
```

## Liberação faseada

- **F1 — Qualp core:** geo, routing, tolls, fuel, web, api
- **F2 — viagem:** itinerary, places, activities, budget, trips
- **F3 — B2B/pro:** freight, public-api, accounts/billing

## Stack

Decisões técnicas em [`docs/decisions/0001-stack.md`](docs/decisions/0001-stack.md).

- Monorepo: pnpm workspaces + Turborepo
- Roteamento: OpenRouteService, acessado pela API
- Geocoding: OpenRouteService (Pelias), via `/places/search` da API; Google Places só para `/places/nearby` na API

## AIPe

Este repositório também é o workspace AIPe do contexto (`.aipe/`, `.claude/`).
O onboarding é conduzido abrindo uma sessão do harness nesta pasta.

## Desenvolvimento

```sh
pnpm install
cp apps/api/.env.example apps/api/.env   # preencha ORS_API_KEY, CLERK_SECRET_KEY, GOOGLE_PLACES_API_KEY
docker compose -f infra/docker-compose.yml up -d postgres
pnpm --filter @qualroteiro/api prisma:migrate
```

Em dois terminais, inicie API e web:

```sh
pnpm --filter @qualroteiro/api dev
pnpm --filter @qualroteiro/web dev
```

O `DATABASE_URL` do `.env.example` já aponta para `postgresql://qualroteiro:qualroteiro@localhost:5432/qualroteiro`. O Redis é usado só pelo worker do `data-ingest`; Valhalla e Photon não entram no runtime atual.
Para o worker contínuo de ingestão, suba também o Redis e execute
`pnpm --filter @qualroteiro/data-ingest worker`. As importações avulsas não
precisam do Redis.

Requer Node 20+ e pnpm 9+. Configure as chaves de OpenRouteService, Clerk e
Google Places conforme os arquivos `.env.example` de cada app antes de usar os
recursos correspondentes.
