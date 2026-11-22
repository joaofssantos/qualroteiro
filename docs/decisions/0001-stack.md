# 0001 — Stack técnica

Status: aceito · Data: 2026-09-08 · Revisado em 2026-11-22 (motor de rota, geocoding, tiles, auth)

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
| Mapa | MapLibre GL + estilo vetorial OpenFreeMap `liberty` (`VITE_MAP_STYLE_URL` troca o estilo) | sem taxa por render nem chave de API; o estilo é recolorido no cliente para o tema escuro |
| Backend framework | Fastify | já dominado, TS-native, plugins |
| ORM | Prisma | zona de conforto do time; PostGIS via raw SQL / Kysely nos pacotes `geo`/`routing`/`pois` |
| Banco | PostgreSQL + PostGIS | consultas espaciais são o núcleo (rota, POIs por raio, snap) |
| Motor de rota | OpenRouteService gerenciado (`/v2/directions/{perfil}/geojson`, `apps/api/src/providers/ors-routing.ts`; `ORS_BASE_URL` permite apontar para uma instância própria) | zero infraestrutura de roteamento; perfis carro/caminhão. Pedágio/frete são camada nossa sobre o traçado |
| Geocoding / lugares | OpenRouteService (`/geocode/search`, `ors-geocode.ts`) para busca de endereços; Google Places (Nearby Search) para POIs, com teto mensal de 4500 chamadas (`google-places.ts`) | mesma chave ORS do roteamento; o teto do Google fica abaixo da faixa gratuita |
| Filas / ingestão | BullMQ + Redis | workers de `data-ingest` (ANTT, ANP, DNIT, concessionárias) |
| Auth | Clerk (token verificado no backend; sem tabela de usuário local, `Trip.userId` = `sub` do Clerk) | decidido na F2a |
| Dev | Docker Compose | postgres+postgis e redis. O compose ainda declara valhalla e photon, mas **nenhum código os usa** (`VALHALLA_URL`/`PHOTON_URL` ficam sem leitura) |

## Consequências

- Prisma não cobre bem `geometry`/`ST_*`; os pacotes espaciais assumem raw SQL
  tipado (Kysely) ao lado do Prisma. Aceito conscientemente em vez de Drizzle.
- Roteamento e geocoding dependem de um provedor gerenciado (ORS): cota e latência são externas. Sem rate limit próprio na API hoje — ver 0003 (limitador #68) antes de ligar a prévia ao vivo.
- Valhalla/Photon self-hosted continuam como opção futura (variáveis e serviços no compose), não como decisão vigente.
- Pedágio e frete ANTT não vêm do motor de rota — são tabelas próprias aplicadas
  sobre o traçado retornado.

## Pendências

- Provedor de tiles definitivo (OpenFreeMap público, sem SLA).
- Remover valhalla/photon do compose ou voltar a usá-los.
