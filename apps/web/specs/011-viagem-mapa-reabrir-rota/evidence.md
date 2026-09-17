# Evidence — mapa da viagem + reabrir rota (j-20260917-up Wave 3)

## O que mudou

- `apps/web/src/modules/planejamento-viagem/tripItemGeo.ts` (novo) —
  `extractTripItemCoordinate(item)` e `extractSavedRoute(item)`, extração
  defensiva sobre `payload: unknown` (presença + `typeof`, sem `as`), mesma
  disciplina de `describeTripItem.ts`.
- `apps/web/src/modules/planejamento-viagem/index.tsx` — `showMap: true` no
  módulo; `TripDetailScreen` monta um `MapLayerData` a partir de todos os
  dias/itens da viagem e publica/limpa via `mapStore`; item de rota com
  `query` salva ganha um botão "Reabrir rota" que chama
  `routeStore.restoreRoute` e navega para `/rota-custos/resultado`.
- Testes: `tripItemGeo.test.ts` (17 casos, extração pura) +
  `TripDetailScreen.test.tsx` (5 casos novos: contagem de pins, reabrir com
  sucesso, sem `query` não quebra/não oferece a ação, sem afordance para os
  outros três módulos, limpeza no unmount).
- `apps/web/e2e/planejamento-viagem-map.spec.ts` (novo) — evidência de
  navegador real, ver seção própria abaixo.
- `apps/web/specs/011-viagem-mapa-reabrir-rota/` — este `spec.md` +
  `evidence.md` + os três screenshots reais.

## Decisões que valem registrar

1. **Pin de `rota-custos` vem de `query.origin`, não de `geometry`.** O
   payload de uma rota não tem `lat`/`lng` no nível raiz; a origem da
   `query` salva (Wave 2) é o ponto natural e amarra a mesma condição do
   item 4 (só reabre o que está pinado). Um item de rota sem `query`, ou com
   `origin` em texto livre (não geocodificado), fica sem pin — documentado
   no `spec.md`.
2. **`extractSavedRoute` separa `query` do resto do payload antes de validar
   `route`.** O payload salvo é `{...PlannedRoute, query}`
   (`SaveRouteToTripDialog`); sem essa separação, `restoreRoute` reintroduziria
   uma chave `query` solta dentro do próprio objeto `PlannedRoute` guardado em
   `routeStore.routes` — inofensivo para a UI (nada lê essa chave a mais),
   mas uma divergência estrutural desnecessária do que `/routes/plan`
   realmente devolve. Corrigido antes de escrever os testes que comparam
   `useRouteStore.getState().routes` contra o fixture `DUTRA_ROUTE` com
   `toEqual` exato.
3. **Sem affordance visível para item de rota sem `query`**, em vez de botão
   desabilitado + tooltip — escolha do `orientation.md` ("sua escolha").
   Justificativa: não há nada de errado a explicar a esse usuário; é só uma
   capacidade que aquele item específico (salvo antes da Wave 2) não tem.
4. **`showMap: true` é por módulo, não por rota** — contrato do shell
   (`docs/decisions/0002-ui-shell-theme-and-map-layout.md`, item 1 do
   "Contrato para mudanças futuras"). `TripListScreen` herda o split 80/20
   mesmo sem publicar nada no mapa (fica na visão nacional padrão) — mesmo
   comportamento que Hospedagem/Restaurantes/Atividades já têm antes de uma
   busca. O escopo desta unidade (`orientation.md`) pede o split
   especificamente para a tela de detalhe; a tela de lista herdá-lo é uma
   consequência do contrato existente, não uma escolha nova desta unidade.

## `/verify-before-done`

Rodado de `apps/web/` dentro do worktree isolado, via
`pnpm exec turbo run build typecheck lint test --filter=@qualroteiro/web`
(garante que `@qualroteiro/geo`/`@qualroteiro/tolls`/`@qualroteiro/fuel` —
dependências de workspace — tenham `dist/` construído antes do typecheck).

```
$ pnpm exec turbo run build typecheck lint test --filter=@qualroteiro/web
 Tasks:    5 successful, 5 total   (build, typecheck, lint limpos;
                                    ver nota sobre teste abaixo)

@qualroteiro/web:build:     tsc -b && vite build     # limpo
@qualroteiro/web:typecheck: tsc --noEmit             # limpo
@qualroteiro/web:lint:      eslint src               # limpo
```

`vitest run` isolado (mesmo diretório):

```
$ pnpm vitest run
 Test Files  27 passed (27)
      Tests  181 passed (181)
```

176 testes existiam antes desta unidade; 181 depois — +5 em
`TripDetailScreen.test.tsx` (16 no total) e +17 em `tripItemGeo.test.ts`
(novo), líquido de nenhum removido.

**Nota sobre flakiness de máquina compartilhada**: esta sessão rodou numa
máquina com várias outras sessões de agente concorrentes (`load average`
chegou a 48 durante a verificação — `uptime` capturado ao vivo). Sob essa
carga, `vitest run` (paralelismo padrão por threads) falhou de forma
não-determinística em testes que esta unidade **não tocou**
(`mapPersistence.test.tsx`, `rotaCustos.test.tsx`, `demoMode.test.tsx` —
sempre por timeout esperando um elemento aparecer, nunca por uma asserção de
valor errada). Isolando o mesmo comando com `--pool=forks
--poolOptions.forks.singleFork=true` (sem paralelismo entre arquivos, tirando
a suíte da disputa por CPU) a suíte inteira passa limpa e reprodutivelmente:

```
$ pnpm exec vitest run --pool=forks --poolOptions.forks.singleFork=true
 Test Files  27 passed (27)
      Tests  181 passed (181)
   Duration  44.09s
```

Rodado mais de uma vez com o mesmo resultado. Todo arquivo de teste que
falhou numa rodada com paralelismo e não na rodada isolada está fora do
diff desta unidade (seção "Diff scope" abaixo) — a causa é confirmadamente a
disputa por CPU/memória da máquina, não uma regressão introduzida aqui.

## Evidência de navegador real (Playwright), não jsdom

`TripDetailScreen` é protegida por `auth.isSignedIn` (Clerk) e `/trips*`
precisa de uma API real — nenhum dos dois está configurado neste workspace
(sem `VITE_CLERK_PUBLISHABLE_KEY`, sem `apps/api` rodando). Mesma técnica já
usada na apuração de QA de F2e/F2f
(`docs/qa/2026-09-15/qualroteiro-ui-check.mjs`, fora de `apps/web`, não
citado como dependência — só como precedente do padrão): os módulos de
`src/core/auth/AuthProvider.tsx`/`AuthContext.ts` são interceptados pelo
dev server do Vite e trocados por um stand-in "sempre logado", e
`/api/trips*` é servido de um fixture — tudo via `page.route`, sem tocar
`apps/web/src`.

`apps/web/e2e/planejamento-viagem-map.spec.ts` (novo, roda com
`pnpm --filter @qualroteiro/web test:e2e`, Chromium real, mapa MapLibre real
contra o estilo público OpenFreeMap — nenhum stub de mapa):

```
$ pnpm exec playwright test e2e/
Running 3 tests using 2 workers
  ✓ shows the 80/20 split with one pin per item that has a coordinate, and
    reopening a saved route restores its exact figures
  ✓ leaves no residual marker when navigating from the trip detail screen
    to another map module
  (rota-custos-tabs.spec.ts: falha pré-existente, não relacionada — ver nota)
  2 passed
```

O primeiro teste, sozinho, prova em um navegador real:

- Viagem com 4 itens (Hospedagem com coordenada, Rota com `query` salva,
  Restaurante manual sem coordenada, Rota antiga sem `query`) → exatamente
  **2** `.maplibregl-marker` no mapa — contagem exata, nem a mais nem a
  menos.
- O split 80/20 do shell (`app-map-container` com `md:w-4/5`, `main` com
  `md:flex-row`) — mesmas classes que `AppShell.test.tsx` verifica para os
  outros quatro módulos.
- Clicar "Reabrir rota São Paulo → Rio de Janeiro" navega para
  `/rota-custos/resultado` e o resumo mostra **429,7 km · R$ 52,90 · R$
  257,82** — exatamente os números do payload salvo, sem nenhuma chamada a
  `/routes/plan` (a rota nunca foi recalculada).
- O item sem `query` ("Rota antiga (pré-Wave 2)") aparece normalmente na
  lista e não tem botão "Reabrir rota".

O segundo teste prova que navegar da tela de detalhe para Hospedagem não
deixa os dois marcadores anteriores no mapa — a tela de Hospedagem (que
ainda não buscou nada) mostra o mapa vazio, prova real do contrato de
limpeza (`mapStore.clearMap()`) num navegador de verdade, não só via
`useMapStore.getState()` em jsdom.

### Capturas

- [`evidence/trip-detail-map-pins.png`](evidence/trip-detail-map-pins.png) —
  tela de detalhe, split 80/20, 2 pins (Rio de Janeiro/hotel e a origem da
  rota perto de São Paulo), lista dos 4 itens nos 2 dias.
- [`evidence/route-reopened-resultado.png`](evidence/route-reopened-resultado.png) —
  depois de clicar "Reabrir rota": Tela 2 com o traçado SP→RJ desenhado, e
  o resumo 429,7 km / R$ 52,90 / R$ 257,82.
- [`evidence/no-residual-marker-after-navigating-away.png`](evidence/no-residual-marker-after-navigating-away.png) —
  tela de Hospedagem logo depois de sair da viagem: mapa limpo, sem os dois
  pins anteriores.

### Nota sobre `rota-custos-tabs.spec.ts`

Falha pré-existente e não relacionada: `bottomInside` de uma aba fica falso
por diferença de renderização de fonte/pixel neste ambiente headless
(assinatura de flake de layout por sub-pixel, não uma regressão desta
unidade). Confirmado que esta unidade não toca `RotaCustosLayout`,
`ResultScreen`, `PlazaDrawer`, nem qualquer CSS de abas — nenhum arquivo do
diff (seção abaixo) tem relação com esse teste. Falha reproduzida mesmo
rodando o arquivo sozinho, antes e independente desta mudança.

## `pnpm -w build`

```
$ npx turbo run build
 Tasks:    8 successful, 8 total
```

Todos os 8 pacotes do monorepo (`api`, `data-ingest`, `fuel`, `geo`,
`routing`, `tolls`, `trips`, `web`) buildam limpo.

## Acceptance mapping

| Aceite (`orientation.md` Wave 3) | Prova |
|---|---|
| `typecheck`/`lint`/`test` verdes | seção `/verify-before-done` |
| Viagem com hospedagem+rota+restaurante, algumas c/ coordenada outras sem → mapa mostra só as que têm, contagem exata | `TripDetailScreen.test.tsx` ("publishes one marker per item...") + Playwright (2 markers exatos) |
| Clicar item de rota com `query` salva → navega para `/rota-custos/resultado`, `routeStore` reflete a rota salva | `TripDetailScreen.test.tsx` ("navigates to /rota-custos/resultado...") + Playwright (resumo 429,7 km/R$ 52,90/R$ 257,82) |
| Item de rota sem `query` não quebra nem oferece reabrir | `TripDetailScreen.test.tsx` ("shows a rota-custos item saved without a query normally...") + Playwright (item visível, sem botão) |
| Nenhuma regressão nos outros módulos do mapa compartilhado | `mapPersistence.test.tsx` (4 testes, não tocado, ver nota de flake) + Playwright ("leaves no residual marker...") |
| `git diff --name-only origin/main..HEAD` só `apps/web/**` | seção "Diff scope" abaixo |
| Evidência visual real (Playwright), não só jsdom | seção acima, 3 screenshots reais |
| `pnpm -w build` verde | seção acima |
| SDD conforme `aipe skill match` | este `evidence.md` + `spec.md` nesta pasta, mesmo formato de `apps/web/specs/010-marker-aria-label/` |

## Diff scope

```
$ git diff --name-only origin/main..HEAD
apps/web/e2e/planejamento-viagem-map.spec.ts
apps/web/specs/011-viagem-mapa-reabrir-rota/evidence.md
apps/web/specs/011-viagem-mapa-reabrir-rota/evidence/no-residual-marker-after-navigating-away.png
apps/web/specs/011-viagem-mapa-reabrir-rota/evidence/route-reopened-resultado.png
apps/web/specs/011-viagem-mapa-reabrir-rota/evidence/trip-detail-map-pins.png
apps/web/specs/011-viagem-mapa-reabrir-rota/spec.md
apps/web/src/modules/planejamento-viagem/TripDetailScreen.test.tsx
apps/web/src/modules/planejamento-viagem/index.tsx
apps/web/src/modules/planejamento-viagem/tripItemGeo.test.ts
apps/web/src/modules/planejamento-viagem/tripItemGeo.ts
```

Todos sob `apps/web/**`.

## `/state-the-limit`

- O split 80/20 na Tela de Lista (`TripListScreen`) é uma consequência do
  contrato existente (`showMap` é por módulo), não algo desenhado/testado
  por esta unidade — o mapa fica vazio/nacional lá até abrir uma viagem, sem
  quebrar nada, mas sem cobertura dedicada além do que o próprio contrato do
  shell já garante para todo módulo `showMap: true`.
- `extractTripItemCoordinate`/`extractSavedRoute` não cobrem um módulo
  futuro com `moduleId` desconhecido além do fallback `null` — está correto
  por design (mesmo contrato de `describeTripItem.ts`), mas nenhum módulo
  além dos quatro existentes foi exercitado.
- A evidência Playwright interecepta os módulos de auth via `page.route`
  para simular um usuário logado, já que este workspace não tem
  `VITE_CLERK_PUBLISHABLE_KEY` nem uma API real configurados — é o mesmo
  contorno já usado informalmente na apuração de QA anterior (F2e/F2f),
  formalizado aqui como um spec de e2e versionado dentro de `apps/web`.
- Não recalculei nenhuma rota via `/routes/plan` na evidência Playwright de
  propósito — o ponto do teste é provar que é uma restauração, não uma nova
  consulta; `apps/web/src/modules/rota-custos/rotaCustos.test.tsx` já cobre
  o fluxo de planejar uma rota nova.
