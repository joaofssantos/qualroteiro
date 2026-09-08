# qualroteiro

Planejador de rotas e viagens rodoviárias no Brasil. Junta o cálculo de custo de
estrada (pedágio, combustível, frete ANTT) com o planejamento completo da viagem
(roteiro dia a dia, lugares, atividades, orçamento, conversões).

## Monorepo

```
apps/
  web/        React + Vite + TS + Tailwind + shadcn/ui + MapLibre GL
  api/        Fastify + Prisma + PostgreSQL/PostGIS
packages/     módulos de domínio (routing, tolls, fuel, freight, itinerary,
              places, activities, budget, converters, geo, pois, trips, ...)
services/
  data-ingest/  workers BullMQ (ANTT, ANP, DNIT, concessionárias, catálogo)
infra/        docker-compose (postgres+postgis, redis, valhalla, photon)
```

## Liberação faseada

- **F1 — Qualp core:** geo, routing, tolls, fuel, web, api
- **F2 — viagem:** itinerary, places, activities, budget, trips
- **F3 — B2B/pro:** freight, public-api, accounts/billing

## Stack

Decisões técnicas em [`docs/decisions/0001-stack.md`](docs/decisions/0001-stack.md).

- Monorepo: pnpm workspaces + Turborepo
- Motor de rota: Valhalla self-hosted sobre extract OSM do Brasil
- Geocoding: Photon (OSM)

## AIPe

Este repositório também é o workspace AIPe do contexto (`.aipe/`, `.claude/`).
O onboarding é conduzido abrindo uma sessão do harness nesta pasta.

## Desenvolvimento

```sh
pnpm install
docker compose -f infra/docker-compose.yml up -d
pnpm dev
```

Requer Node 20+ e pnpm 9+.
