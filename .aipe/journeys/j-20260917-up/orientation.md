# Orientation Spec — j-20260917-up (Planejamento: mapa de destino + reabrir rota salva)

> The coordinator's cross-package orientation for this demand. The PE **approves**
> this before any dispatch. Amend it (bump the version) when an escalation changes
> the cross-package shape, then get re-approval. Implementation detail belongs to
> each specialist's own SDD (committed into its PR), not here.

> PE pediu (2026-09-17): "na página de planejamento mostrar o mapa de
> destino (com os pins selecionados), e ao clicar na tab da rota, abrir a
> rota novamente". Investigação real feita antes de especificar (leitura
> direta do código, não suposição) — achou dois buracos reais que mudam o
> escopo de "só adicionar um mapa" pra "também estender o que já é salvo":

## Decisões de arquitetura tomadas pelo coordenador (documentadas, não perguntadas)

1. **`rota-custos` não salva o suficiente pra reabrir.** `SaveRouteToTripDialog.tsx`
   salva `payload: route` (só o `PlannedRoute` — trace, pedágios,
   combustível). Mas `ResultScreen.tsx` também lê `query.originLabel`,
   `query.destinationLabel`, `query.vehicle.axleCategory`,
   `query.fuelPricePerL`, `query.vehicle.consumptionKmPerL` — nenhum desses
   é salvo hoje. Sem eles, não dá pra re-renderizar a Tela 2 fielmente.
   **Decisão**: mudar o payload salvo de `route` para `{ ...route, query }`
   (spread, não aninhado) — mantém `payload.distanceKm`/`payload.durationMin`
   no nível raiz (o que `describeTripItem.ts`'s `describeRotaCustos` já lê
   hoje, sem quebrar) e adiciona `payload.query` como campo novo opcional.
2. **Hospedagem/Restaurantes/Atividades não salvam coordenada.** `PlaceResult`
   (resultado de busca) tem `lat`/`lng`, mas `LodgingStay`, `RestaurantVisit`
   e `ActivityPlan` só têm `address: string | null` (texto livre) — a
   coordenada do lugar selecionado nunca é propagada pro objeto que a tela
   salva. **Decisão**: os três ganham `lat`/`lng` opcionais (`number | null`),
   preenchidos quando o usuário seleciona um resultado de busca (`selectPlace`
   já tem o `PlaceResult` com a coordenada em mãos), `null` quando o usuário
   digita manualmente (nunca inventar coordenada por geocoding reverso ou
   heurística — ausência de pin é aceitável, coordenada errada não é).
3. **Sem retroatividade.** Trips salvas antes desta mudança não ganham
   `query`/`lat`/`lng` — ficam sem "reabrir rota" e sem pin no mapa,
   documentado como limite conhecido, não um bug. Nenhuma migration de
   backfill (não há de onde tirar a coordenada de um endereço já salvo como
   texto livre sem geocoding, fora de escopo).
4. **Reabrir rota não recalcula.** O objetivo é restaurar exatamente o que
   foi salvo (mesmo trace, mesmos valores) — não chamar `/routes/plan` de
   novo. Isso implica uma ação nova no `routeStore`
   (`apps/web/src/core/store/routeStore.ts`) que aceita um `PlannedRoute` +
   `PlanQuery` prontos e os põe direto no estado (`routes: [route]`,
   `activeIndex: 0`, `query`), sem tocar a store de query/API.
5. **Pins no mapa reusam o padrão existente.** Cada módulo já monta
   `MapLayerData.markers` a partir de resultados de busca (ver
   `hospedagem/index.tsx`). O mapa da tela de detalhe da viagem faz o mesmo,
   iterando os `TripItem`s do dia/viagem atual, extraindo `lat`/`lng` de
   forma defensiva por `moduleId` (mesmo padrão de narrowing sem `as` que
   `describeTripItem.ts` já usa) — item sem coordenada simplesmente não vira
   pin, sem erro.

## Problem

A tela de detalhe de uma viagem salva (`planejamento-viagem`) hoje é só uma
lista/timeline de dias e itens — sem mapa, sem ação de "ver de novo" um item
salvo. O PE quer ver os lugares selecionados num mapa (mesmo padrão 80/20 dos
outros módulos) e poder reabrir uma rota salva sem recalcular. Isso expõe que
o que é salvo hoje (em 4 módulos) não carrega os dados necessários — a
jornada resolve os dois problemas juntos, faseada.

## Cross-package contracts

Só `apps/web` — nenhum contrato novo com `apps/api` (o shape de `TripItem`
já é `payload: Json` opaco, mudar o que cada módulo põe lá dentro não exige
migration nem mudança de rota).

- `hospedagem`/`restaurantes`/`atividades` → seus próprios `Save*ToTripDialog`:
  os três tipos de domínio ganham `lat`/`lng` opcionais, propagados até o
  payload salvo.
- `rota-custos` → `SaveRouteToTripDialog`: payload passa a incluir `query`.
- `rota-custos`'s `routeStore` → `planejamento-viagem`: nova ação de
  restauração, consumida pela tela de detalhe da viagem ao clicar num item
  de rota salvo.
- `planejamento-viagem` → `describeTripItem.ts` (já existe, reusar o
  padrão de narrowing defensivo pra extrair `lat`/`lng` por `moduleId`).

## Per-package scope

### qualroteiro/web

> Três waves sequenciais, mesmo pacote (`apps/web`), rodadas diferentes.

**Wave 1 — scope** (coordenadas nos três módulos de busca):
1. `LodgingStay`, `RestaurantVisit`, `ActivityPlan` (em `calc.ts` de cada
   módulo) ganham `lat: number | null` e `lng: number | null`.
2. `selectPlace()` em cada `index.tsx` passa a preencher `lat`/`lng` a partir
   do `PlaceResult` selecionado; entrada manual (sem selecionar da busca)
   mantém `null`.
3. `Save{Stay,Restaurant,Activity}ToTripDialog.tsx`: o payload salvo (hoje o
   objeto de domínio inteiro) já carrega `lat`/`lng` automaticamente com a
   mudança acima — confirmar que nenhum desses dialogs faz `pick` explícito
   de campos que precisaria de atualização.
- **Acceptance:**
  - `pnpm --filter @qualroteiro/web typecheck/lint/test` verdes.
  - Teste por módulo: selecionar um resultado de busca preenche
    `lat`/`lng`; editar manualmente sem selecionar mantém `null`; salvar na
    viagem persiste os dois campos no payload (mock de `createTripItem`,
    inspecionar o body enviado).
  - Nenhuma mudança de comportamento visível pro usuário nesta wave (só
    payload, sem UI nova ainda).
  - `git diff --name-only origin/main..HEAD` só `apps/web/**`.

**Wave 2 — scope** (query salva junto da rota, depende de Wave 1 `merged`
só por ordem de fila, não por dependência técnica real — pode reordenar se
o coordenador achar melhor):
1. `SaveRouteToTripDialog.tsx`: payload passa de `route` para
   `{ ...route, query: routeStoreQuery }` (o `query` já disponível no
   `routeStore` no momento do save — `ResultScreen`/o dialog já está dentro
   desse contexto).
2. Nova ação em `routeStore.ts` (nome sugerido `restoreRoute(route:
   PlannedRoute, query: PlanQuery)`) que substitui `routes`/`activeIndex`/
   `query` diretamente, sem chamar a API.
3. `describeTripItem.ts` — confirmar que `describeRotaCustos` continua
   funcionando sem mudança (payload ainda tem `distanceKm`/`durationMin` no
   nível raiz) — se não continuar, é achado real a corrigir aqui.
- **Acceptance:**
  - `pnpm --filter @qualroteiro/web typecheck/lint/test` verdes.
  - Teste: salvar uma rota grava `query` no payload junto dos campos que já
    eram salvos (`distanceKm` etc. continuam no nível raiz).
  - Teste: `restoreRoute` põe o estado do `routeStore` exatamente como um
    `PlanRouteResponse` real poria (mesma forma que `ResultScreen` espera),
    sem tocar `status`/chamar a API.
  - `describeTripItem` continua descrevendo itens de rota salvos ANTES desta
    mudança (payload sem `query`) sem quebrar — teste de regressão explícito
    com um payload "antigo" (só os campos de `PlannedRoute`, sem `query`).
  - `git diff --name-only origin/main..HEAD` só `apps/web/**`.

**Wave 3 — scope** (mapa + reabrir na tela de detalhe da viagem, depende de
Wave 1 e 2 `merged`):
1. Tela de detalhe de uma viagem (`planejamento-viagem`, o componente que
   lista dias/itens de uma trip específica) ganha o padrão 80/20 mapa+
   conteúdo já usado pelos outros módulos (`AppShell`'s `showMap`/`MapCanvas`
   compartilhado, ver G2).
2. Pins: itera os itens da viagem atual (todos os dias, não só um), extrai
   `lat`/`lng` por `moduleId` de forma defensiva (mesmo padrão de
   `describeTripItem.ts`, sem `as`), monta um `MapLayerData` com um marker
   por item que tiver coordenada. Item sem coordenada (busca manual, ou
   salvo antes desta jornada) não aparece no mapa — sem erro, sem pin
   fantasma.
3. Clique num item cujo `moduleId === 'rota-custos'` E cujo `payload` tenha
   `query` presente: chama `restoreRoute` (Wave 2) e navega pra
   `/rota-custos/resultado`. Item de rota sem `query` (salvo antes desta
   jornada): sem essa ação — mostrar normalmente, sem quebrar, mas sem
   "reabrir" clicável (decidir com o dev exatamente como comunicar isso ao
   usuário — desabilitado com tooltip, ou simplesmente sem o affordance;
   documentar a escolha).
4. Clique num item de Hospedagem/Restaurantes/Atividades: fora de escopo
   desta jornada reabrir uma tela de edição — só o pin no mapa conta aqui
   (reabrir edição fica pra uma jornada futura se o PE pedir).
- **Acceptance:**
  - `pnpm --filter @qualroteiro/web typecheck/lint/test` verdes.
  - Teste: viagem com itens de hospedagem+rota+restaurante, alguns com
    coordenada e outros sem — mapa mostra só os que têm, contagem exata.
  - Teste: clicar num item de rota com `query` salva navega pra
    `/rota-custos/resultado` e o `routeStore` reflete a rota salva (mesmos
    valores de distância/pedágio/combustível do payload).
  - Teste: item de rota SEM `query` (fixture simulando payload antigo) não
    quebra a tela nem oferece a ação de reabrir.
  - Nenhuma regressão nos outros módulos que usam o mapa compartilhado
    (`MapCanvas`/`mapStore`) — trocar de/para a tela de detalhe da viagem
    não deixa marcador residual de outro módulo.
  - `git diff --name-only origin/main..HEAD` só `apps/web/**`.
  - Evidência visual real (Playwright ou screenshot manual) do mapa com
    pins de uma viagem de verdade — não só teste unitário/jsdom (mesma
    lição da fase de pedágio: geometria de layout não se prova em jsdom).

## Sequencing

- **Wave 1:** coordenadas em Hospedagem/Restaurantes/Atividades.
- **Wave 2:** query salva junto da rota. (Pode rodar em paralelo lógico
  com a Wave 1 — são módulos diferentes — mas a lei do AIPe serializa
  dispatch no mesmo repo, então na prática é sequencial por fila, não por
  dependência real.)
- **Wave 3:** mapa + reabrir na tela de detalhe — depende de Wave 1 e 2
  `merged` de verdade (usa os campos que elas introduzem).

## Out of scope

- Migração/backfill de trips salvas antes desta jornada.
- Reabrir uma tela de EDIÇÃO de Hospedagem/Restaurantes/Atividades a partir
  do item salvo (só o pin no mapa).
- Geocoding reverso ou heurística pra inventar coordenada de endereço
  digitado manualmente.
- Qualquer mudança em `apps/api`/schema — `payload` continua `Json` opaco.
- Múltiplas rotas alternativas salvas por item (o `SaveRouteToTripDialog`
  já salva só a rota ativa no momento do save — mantido).
