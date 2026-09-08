# 0001 — Stack técnica

Status: aceito · Data: 2026-09-08

## Contexto

`qualroteiro` é um planejador de rotas + viagens no Brasil (pedágio, combustível,
frete ANTT, roteiro, lugares, atividades, orçamento, conversões). Monorepo único,
liberação faseada (F1 Qualp core → F2 viagem → F3 B2B/pro).

## Decisões

| Área | Escolha | Motivo |
|---|---|---|
| Monorepo | pnpm workspaces + Turborepo | cache de build/test por pacote, maduro |
| Linguagem | TypeScript em tudo | um só ecossistema, tipos compartilhados entre pacotes |
| Frontend | React + Vite + TS + Tailwind + shadcn/ui | build rápido; shadcn evita recomeçar componentes do zero |
| Mapa | MapLibre GL | sem taxa por render; tiles MapTiler/Protomaps no início |
| Backend framework | Fastify | já dominado, TS-native, plugins |
| ORM | Prisma | zona de conforto do time; PostGIS via raw SQL / Kysely nos pacotes `geo`/`routing`/`pois` |
| Banco | PostgreSQL + PostGIS | consultas espaciais são o núcleo (rota, POIs por raio, snap) |
| Motor de rota | Valhalla self-hosted (Docker) sobre extract OSM do Brasil | perfil de caminhão (eixos/peso/altura), costing options, matriz; pedágio/frete são camada nossa sobre o trace |
| Geocoding | Photon self-host (OSM) | sem custo por request; fallback pago se necessário |
| Filas / ingestão | BullMQ + Redis | workers de `data-ingest` (ANTT, ANP, DNIT, concessionárias) |
| Auth | Clerk ou Lucia | indefinido — decidir antes da F1 fechar |
| Dev | Docker Compose | postgres+postgis, redis, valhalla, photon |

## Consequências

- Prisma não cobre bem `geometry`/`ST_*`; os pacotes espaciais assumem raw SQL
  tipado (Kysely) ao lado do Prisma. Aceito conscientemente em vez de Drizzle.
- Valhalla exige baixar + tilear o extract do Brasil no primeiro `up` (lento).
- Pedágio e frete ANTT não vêm do motor de rota — são tabelas próprias aplicadas
  sobre o traçado retornado.

## Pendências

- Provedor de auth (Clerk × Lucia).
- Provedor de tiles definitivo.
- Estratégia de atualização do extract OSM.
