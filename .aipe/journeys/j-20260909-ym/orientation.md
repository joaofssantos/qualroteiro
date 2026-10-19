# Orientation Spec — j-20260909-ym

> The coordinator's cross-package orientation for this demand. The PE **approves**
> this before any dispatch.

## Problem

O F1 do qualroteiro está completo e integrado no `dev` (jornada j-20260908-yk:
`root` + `api` + `web`, todos merged e QA-gated). O PE quer um **link de
homologação** pra clicar e ver as 3 telas funcionando com o fluxo SP→RJ.

Uma tentativa externa (OpenAI Sites, feita fora do AIPe) publicou o bundle
estático do `apps/web` mas **sem backend `/api`** — o app foi buildado com
`VITE_API_BASE_URL` ausente, então chama o caminho relativo `/api/...`, que num
host estático cai no fallback do SPA e devolve HTML em vez de JSON. Resultado:
"não retorna nada". Um mock via service worker foi feito num diretório temporário
(`/private/tmp/...`, já apagado) — não reproduzível, fora do repo.

**Esta jornada** resolve isso **dentro do repo**: um `demo mode` de build no
`apps/web` que serve respostas de fixture (sem backend), pros 3 corredores já
semeados, de forma que um deploy estático do `apps/web` funcione sozinho.

Decisões do PE (2026-09-09):
- **Modo fixture, sem `ORS_API_KEY`** — nada de deploy de API nesta jornada.
- **Portar o mock pro repo** como código versionado e testado (não service
  worker num artefato temp).
- Alvo de deploy fica a cargo do PE (o `dist/` resultante é estático e
  self-contained); esta jornada **não** automatiza deploy.
- Promoção `dev → main` do F1 é decisão separada, ainda aberta.

## Cross-package contracts

Unidade única — `qualroteiro/web`. Sem contrato cross-package novo.

- `web` já consome o contrato HTTP de `apps/api` (`apps/api/specs/002-rota-custos-api/spec.md`).
  O demo mode **imita esse mesmo contrato** no lado do cliente — as fixtures têm
  que casar com os tipos `PlannedRoute` / `Place` que a UI já espera, incluindo o
  `422` (endereço sem resultado) e `points.fuelStations: []`.
- As fixtures devem derivar dos dados **reais** já no repo, não de aproximações:
  praças e tarifas de `@qualroteiro/tolls` (seed dos corredores
  `sp-rj-dutra`, `sp-curitiba-regis`, `sp-campinas-bandeirantes` — conferir os
  ids/exports reais do pacote), cálculo de combustível via
  `@qualroteiro/fuel` `estimateFuel`. Assim o número da tela de homolog é o mesmo
  que o produto real produziria.

## Per-package scope

### qualroteiro/web
- **Scope:**
  - Uma flag de build **`VITE_DEMO_MODE`** (documentada em `.env.example` e
    `src/env.d.ts`). Default `false` — o comportamento atual (fetch real via
    `/api` + proxy) fica **intocado** quando desligada.
  - Quando `VITE_DEMO_MODE=true`, a camada de fetch (`src/core/api/client.ts` ou
    um wrapper em volta dela) **não faz request de rede** — resolve a partir de um
    módulo de fixtures `src/core/api/demo/` (novo). Cobrir:
    - `GET /places/search?q=` → fixtures pra "São Paulo", "Rio de Janeiro",
      "Curitiba", "Campinas" (match case-insensitive por prefixo/substring); `q`
      em branco → o mesmo `400` que o cliente já trata; sem match → lista vazia
      (`200`), como o contrato real.
    - `POST /routes/plan` → uma `PlannedRoute` por par origem→destino pros 3
      corredores semeados:
      - SP→RJ (Dutra), SP→Curitiba (Régis Bittencourt), SP→Campinas
        (Bandeirantes).
      - `geometry`: um LineString plausível (pode ser a polyline de referência do
        próprio seed de `@qualroteiro/tolls`, se exposta; senão uma coarse entre
        as coords das pontas).
      - `distanceKm` / `durationMin`: valores fixos plausíveis (SP→RJ ~429.7 /
        ~342.5; SP→Curitiba ~408 / ~352; SP→Campinas ~96 / ~82 — ajustar aos do
        seed se houver).
      - `tolls`: `matchTolls` real rodado sobre a geometry da fixture + categoria
        `car`, OU as praças do corredor lidas direto do seed; `total` = soma.
      - `fuel`: `estimateFuel({ distanceKm, consumptionKmPerL, pricePerL })` real
        com os valores do request.
      - `points.tolls` = as mesmas praças; `points.fuelStations` = `[]`.
      - par sem corredor conhecido (ex. origem/destino que não casam) → devolver
        `422` com mensagem nomeando a ponta não resolvida, exatamente como o
        cliente já espera; OU uma rota genérica sem pedágio (`tolls.total: 0`) —
        escolher e documentar no SDD.
  - Um indicador visível de "modo demonstração" na UI quando a flag está on (um
    badge discreto no shell), pra ninguém confundir fixture com dado real.
  - Doc curta (`apps/web/README.md` ou `apps/web/docs/homolog.md`): como buildar
    o bundle de homolog (`VITE_DEMO_MODE=true pnpm --filter @qualroteiro/web
    build`) e que o `dist/` é um site estático self-contained, sem backend.
- **Acceptance:**
  - `pnpm --filter @qualroteiro/web build`, `typecheck`, `lint`, `test` verdes; e
    `pnpm -w build` verde.
  - **Demo on:** um teste com `VITE_DEMO_MODE=true` (ou injetando a flag) submete
    a Tela 1 com origem "São Paulo, SP" / destino "Rio de Janeiro, RJ" / consumo
    10 / combustível 6 e **sem nenhum mock de `fetch`/rede** chega na Tela 2 com:
    traçado no mapa, resumo preenchido, aba Pedágios listando ≥1 praça da Dutra
    com tarifa, aba Combustível com `custo = litros × preço` (= `429.7/10*6`
    dentro da tolerância). Os outros 2 corredores provados por teste também
    (Curitiba, Campinas).
  - **Demo off (regressão):** os 46 testes atuais continuam passando; com a flag
    off, a camada de fetch faz request pro `/api` como hoje (provado — o teste
    atual que mocka `fetch` continua válido).
  - `PlaceSearch` em demo mode resolve as 4 cidades da fixture sem tocar a rede.
  - O badge "modo demonstração" aparece só com a flag on (provado).
  - `.env.example` + `src/env.d.ts` documentam `VITE_DEMO_MODE`.
  - Nenhuma mudança em `apps/api`, `packages/`, ou config de raiz (além de
    lockfile se precisar de devDep). Sem service worker.
  - SDD: seguir o que `aipe skill match --task-type feature --size small` indicar
    (sdd-lite: spec curto + evidência + doc de tarefa).

## Sequencing

- **Wave 1:** `qualroteiro/web` (dev: Peggy Olson) → **QA gate** Stan Rizzo.

Onda única.

## Per-unit dispatch envelopes

Gate cumprido: `aipe execution propose --journey j-20260909-ym` rodado; envelope
abaixo é uma linha da saída.

- **`qualroteiro/web`** — `subagent / claude-code / standard / normal`
  (cost-index 2). Standard porque o contrato-alvo já existe
  (`apps/api/specs/002-*/spec.md`), os dados reais já estão no repo
  (`@qualroteiro/tolls` seed, `@qualroteiro/fuel`), e o mock de referência já foi
  descrito na passagem — é fiação de uma camada de fixture atrás de uma flag +
  testes, não design. Descartado `reasoning` (sem julgamento arquitetural em
  jogo); `fast` (a consistência fixture↔contrato e o caminho de regressão pedem
  mais que trivial); `session`/`ultracode`/`frontier` (sem necessidade,
  gated). `--size small` → SDD sdd-lite.

- **QA** (`Stan Rizzo`) — `subagent / claude-code / standard / normal`
  (cost-index 2). Mecânico contra critério explícito (rodar os testes que o dev
  enumerou + revisar o diff contra a acceptance, checar que demo-off não
  regrediu).

## Out of scope

- Deploy / hospedagem (o PE publica o `dist/` onde quiser).
- Qualquer `ORS_API_KEY` / chamada real a provider / deploy de API de homolog.
- Mudanças em `apps/api`, `packages/`, `services/`, infra, Prisma.
- Service worker (o mock vive na camada de fetch, versionado).
- Ingestão de dados, dados de postos, piso ANTT.
- Promoção `dev → main` do F1 (decisão separada).
- Dados de pedágio "de verdade" — as fixtures usam o seed demo já existente.
