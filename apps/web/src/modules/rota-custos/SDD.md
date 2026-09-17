# j-20260917-up Wave 2 — query salva junto da rota (sdd-lite)

## Problem

`SaveRouteToTripDialog` salvava só `payload: route` (`PlannedRoute` — trace,
pedágios, combustível). `ResultScreen` (Tela 2) também depende de
`query.originLabel`, `query.destinationLabel`, `query.vehicle.axleCategory`,
`query.fuelPricePerL` e `query.vehicle.consumptionKmPerL` pra se renderizar —
nenhum desses era salvo, então uma rota salva não tinha como ser reaberta
fielmente (essa reabertura é a Wave 3; esta wave só garante que o dado exista).

## Scope

**Dentro:**
- `SaveRouteToTripDialog.tsx`: o payload salvo passa de `route` para
  `{ ...route, query }` — *spread*, não aninhado. `distanceKm`/`durationMin`
  (e o resto de `PlannedRoute`) continuam no nível raiz do payload; `query` é
  a única chave nova. `query` é lido do `routeStore`
  (`useRouteStore((s) => s.query)`) dentro do próprio dialog — ele só é
  montado dentro de `ResultScreen`, que já está nesse contexto (sem precisar
  virar prop nova).
- `routeStore.ts` ganha `restoreRoute(route: PlannedRoute, query: PlanQuery):
  void` — substitui `routes` (`[route]`), `activeIndex` (`0`) e `query`
  diretamente no estado. Não chama a API, não muda `status` nem `error` (não
  é uma nova consulta — é uma restauração local do que já foi salvo).
- Confirmado (com teste de regressão) que `describeTripItem.ts`'s
  `describeRotaCustos` continua funcionando sem mudança para os dois formatos
  de payload — o antigo (`PlannedRoute` puro) e o novo (`PlannedRoute` +
  `query`) — porque ela só lê `distanceKm`/`durationMin`, que continuam na
  raiz nos dois casos. Nenhuma mudança de código foi necessária ali.

**Fora:**
- Consumir `restoreRoute` de fato (botão "reabrir" na tela de detalhe da
  viagem, navegação pra `/rota-custos/resultado`) — isso é a Wave 3, que
  depende desta wave estar mergeada.
- Qualquer mudança em `apps/api` — `payload` continua `Json` opaco.
- Retroatividade: itens salvos antes desta mudança continuam sem `query` no
  payload; `describeTripItem` continua descrevendo-os normalmente (é
  exatamente o que o teste de regressão prova), mas a Wave 3 não vai
  oferecer "reabrir" para eles.

## Acceptance

- `pnpm --filter @qualroteiro/web typecheck/lint/test` verdes.
- Salvar uma rota grava `query` no payload junto dos campos que já eram
  salvos, com `distanceKm`/`durationMin` continuando no nível raiz —
  `SaveRouteToTripDialog.test.tsx`, inspecionando o body enviado a
  `createTripItem`.
- `restoreRoute` põe o estado do `routeStore` exatamente como um
  `PlanRouteResponse` real poria (`routes: [route]`, `activeIndex: 0`,
  `query` preenchido), sem tocar `status`/`error` e sem chamar a API —
  `routeStore.test.ts`.
- Regressão explícita: `describeTripItem` descreve itens de rota salvos
  ANTES desta mudança (payload só com os campos de `PlannedRoute`, sem
  `query`) e DEPOIS dela, com o mesmo resultado —
  `describeTripItem.test.ts`.
- `git diff --name-only origin/main..HEAD` só toca `apps/web/**`.
