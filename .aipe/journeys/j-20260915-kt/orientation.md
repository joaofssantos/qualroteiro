# Orientation Spec — j-20260915-kt (F2a — fundação: Clerk + Trip)

> PE confirmou o fatiamento de F2 e o contrato desta fase (2026-09-16),
> documentado em `F2-COORDINATION.md`. `CLERK_SECRET_KEY` /
> `VITE_CLERK_PUBLISHABLE_KEY` já nos `.env` corretos.

## Problem

F2 entrega módulos novos (Hospedagem, Restaurantes, Atividades, Roteiro) que
plugam no `moduleRegistry` do F1 — usáveis **isolados** (como o Rota & Custos
já é, sem login) **ou combinados** numa viagem salva. F2a é a fundação: auth
(Clerk) + o domínio `Trip` (persistido) + o módulo mínimo "Planejamento de
Viagem" salvando **um** tipo de item (o resultado do Rota & Custos). F2b–e
(Hospedagem, Restaurantes, Atividades, Roteiro/timeline) plugam nisso depois,
em jornadas próprias.

O contrato REST e os tipos de domínio já foram fechados com o PE e publicados
em `F2-COORDINATION.md` §3 — a unidade `web` (A3) já está sendo construída no
Codex **contra esse contrato**, em paralelo a esta jornada. Este spec **não
pode divergir** do que está documentado lá sem voltar e avisar.

## Cross-package contracts

- **`qualroteiro/root` → `qualroteiro/api`**: `root` publica
  `@qualroteiro/trips` (tipos `Trip`/`TripDay`/`TripItem` + validação pura,
  sem I/O — mesmo padrão de `@qualroteiro/{geo,routing,tolls,fuel}`). `api`
  importa. `root` tem que estar `verified`/`merged` antes de `api`.
- **`qualroteiro/api` → `qualroteiro/web`**: `api` expõe o contrato REST de
  `/trips*` documentado em `F2-COORDINATION.md` §3 (tabela de rotas) — **não
  mudar o shape sem emendar o doc e avisar o Codex**, porque a A3 já está
  sendo escrita contra ele.
- Auth: `web` (Clerk frontend) manda `Authorization: Bearer <clerk session
  token>`; `api` verifica via Clerk backend SDK. Nenhuma rota de login própria
  — o Clerk cuida disso.

## Per-package scope

### qualroteiro/root
- **Scope:**
  - Novo pacote `packages/trips`, mesmo esqueleto de `packages/tolls`
    (`package.json`, `tsconfig.json`, `tsconfig.test.json`, `src/`, `tests/`).
  - Tipos (sem I/O): `Trip`, `TripDay`, `TripItem` — shape **exatamente** o
    documentado em `F2-COORDINATION.md` §3 (`id`, `userId`, `title`,
    `startDate`/`endDate` ISO date ou `null`, `createdAt`/`updatedAt` ISO
    datetime; `TripDay.date` ISO date ou `null` + `order`; `TripItem.moduleId`/
    `kind`/`title`/`payload: unknown`/`costEstimate: number | null`).
  - Validação pura: funções que validam um `title` não-vazio, datas
    `startDate <= endDate` quando ambas presentes, `order` não-negativo — o
    suficiente pra `api` não reimplementar essas regras. Sem acesso a banco,
    sem Prisma aqui (isso é da `api`).
  - Exportar tudo de `packages/trips/src/index.ts`.
  - **Não** tocar `apps/api`, `apps/web`, config de raiz.
- **Acceptance:**
  - `pnpm --filter @qualroteiro/trips build/typecheck/test` verdes;
    `pnpm -w test` sem regressão.
  - Testes: cada validação pura tem caso válido + caso inválido; os tipos
    batem literalmente com a tabela do `F2-COORDINATION.md` §3 (nomes de
    campo, opcionalidade).
  - Diff só em `packages/trips/**`.
  - SDD: `aipe skill match --task-type feature --size medium` (é um domínio
    novo, mais que "small").

### qualroteiro/api
- **Scope:**
  - **Prisma**: modelos `Trip`, `TripDay`, `TripItem` em
    `apps/api/prisma/schema.prisma` (mapeando os tipos de `@qualroteiro/trips`
    — `userId` como string, relação `Trip 1—N TripDay 1—N TripItem`,
    `payload` como `Json`). Rodar `prisma migrate dev` contra o Postgres do
    `infra/docker-compose.yml` (`docker compose -f infra/docker-compose.yml up
    -d postgres` primeiro). **Se o daemon do Docker não estiver disponível no
    ambiente do dispatch**, rodar `prisma validate`/`prisma format` (checagem
    de schema sem banco) e declarar explicitamente em `/state-the-limit` que a
    migration nunca rodou contra um banco real — não simular, não inventar
    resultado.
  - **Middleware de auth**: verificar o `Authorization: Bearer <token>` via
    Clerk backend SDK (`@clerk/backend` ou equivalente) antes de qualquer rota
    `/trips*`. Sem token válido → `401 { "error": "..." }`. Adicionar
    `CLERK_SECRET_KEY` ao `apps/api/.env.example` (placeholder — a chave real
    já está no `.env`, não commitar).
  - **Endpoints**, shape exato da tabela em `F2-COORDINATION.md` §3:
    `POST /trips`, `GET /trips`, `GET /trips/:id`, `PATCH /trips/:id`,
    `DELETE /trips/:id`, `POST /trips/:id/days`,
    `POST /trips/:id/days/:dayId/items`,
    `DELETE /trips/:id/days/:dayId/items/:itemId`. Usar as validações de
    `@qualroteiro/trips` antes de tocar o banco.
  - `GET /trips/:id` e qualquer mutação em recurso alheio → `404` (nunca
    vazar que o recurso existe pra outro usuário).
  - **Não** tocar `apps/web`, `packages/{geo,routing,tolls,fuel}`, config de
    raiz.
- **Acceptance:**
  - `pnpm --filter @qualroteiro/api test/typecheck/lint` verdes.
  - Testes de integração (auth **mockado** — sem depender da rede do Clerk
    nem de token real): fluxo completo criar Trip → adicionar day → adicionar
    item → `GET /trips/:id` devolve tudo aninhado; tentar acessar Trip de
    outro `userId` → `404`; sem `Authorization` → `401`.
  - Se a migration rodou contra Postgres real: evidência do
    `prisma migrate dev` com sucesso. Se não rodou (Docker indisponível):
    `prisma validate` limpo + o limite declarado explicitamente.
  - `git diff --name-only origin/dev..HEAD` só `apps/api/**` (+ prisma
    migration files).
  - Nenhum segredo (`CLERK_SECRET_KEY`) em diff/commit/log.
  - SDD: `aipe skill match --task-type feature --size medium`.

## Sequencing

- **Wave 1:** `qualroteiro/root` (dev: Lane Pryce) → QA Bertram Cooper.
- **Wave 2:** `qualroteiro/api` (dev: Pete Campbell) → QA Joan Holloway. Só
  abre com Wave 1 `verified`/`merged`.

A3 (`apps/web`, Codex/PE) roda em paralelo desde já, contra o contrato
publicado — não faz parte do dispatch desta jornada.

## Per-unit dispatch envelopes

`aipe execution propose --journey j-20260915-kt` — ambas as unidades
`subagent/claude-code/reasoning/normal` (cost-index 4): é desenho de domínio
novo (tipos que vão sustentar F2b–e) e superfície sensível (auth, isolamento
por usuário) — julgamento real, não mecânico. Descartado `standard` (isolamento
por `userId` errado é o tipo de bug que passa nos testes óbvios e vaza dado
de um usuário pro outro — exatamente o "fix-too-much hazard" que pede
`reasoning`). QAs em `standard` (mecânico: rodar os testes + conferir
isolamento com os casos que o dev já deve ter coberto).

## Out of scope

- F2b/c/d/e (Hospedagem, Restaurantes, Atividades, Roteiro/timeline).
- Qualquer UI (`apps/web`) — é a A3, no Codex, fora desta jornada.
- Editar/deletar `TripDay` (só criar nesta fase — dá pra adicionar depois).
- Reordenar itens/dias (drag-and-drop) — fica pro F2e (Roteiro).
- Orçamento consolidado somando `costEstimate` — cálculo simples pode ficar
  pro `web` por enquanto (somar no cliente); se a API já expuser um total,
  documentar e avisar o Codex.
