# G-COORDINATION.md — G-series (Google Places + mapa compartilhado)

> Doc de coordenação da fase G (dados reais de busca + mapa permanente),
> mesmo padrão de `F1-COORDINATION.md`/`F2-COORDINATION.md`. G1 já é uma
> jornada AIPe própria (`.aipe/journeys/j-20260916-sw/orientation.md`), não
> repetido aqui. Este arquivo existe pros briefs que vão pro **Codex**
> (G3/G4/G5), no mesmo formato usado em F2b/c/d/A3.

## Status geral

| Unidade | O quê | Quem | Status |
|---|---|---|---|
| G1 | `apps/api` — adapter Google Places + guarda de custo | Claude (Pete Campbell) | **fechado, mergeado em `dev`** |
| G2 | `apps/web` — mapa persistente compartilhado | Claude (Peggy Olson) | **fechado, mergeado em `dev`** |
| G3 | `apps/web/modules/hospedagem` — busca+mapa | Codex | **fechado, mergeado em `main`** |
| G4 | `apps/web/modules/restaurantes` — busca+mapa | Codex | **fechado, mergeado em `main`** |
| G5 | `apps/web/modules/atividades` — busca+mapa | Codex | **fechado, mergeado em `main`** |

**G1 e G2 promovidos pra `main`** (PR #26, commit `31697b1`).
Os 3 briefs abaixo estão **liberados** — cole cada um no Codex (pode ser em
paralelo, mesmo padrão de F2b/c/d). Conflito mecânico esperado em
`core/api/client.ts`/`types.ts` (a função nova `searchNearbyPlaces` — quem
chegar 2º/3º vai colidir) — eu resolvo na hora do merge, como sempre. Cada
PR ainda passa pelo meu ciclo de verificação de sempre (build/typecheck/
lint/test reproduzido, não só relatado) antes de mergear.

**Lembrete de escopo pra cada brief**: incluir o teste "assert direto em
`useMapStore.getState()` após unmount" (não via DOM de outro módulo) — é
lição direta do achado de QA em G2, não opcional.

## Contrato real de G2 (implementado, `dev`, PR #25 — substitui o rascunho provisório anterior)

G2 não criou um componente de mapa novo — `apps/web/src/core/map/MapCanvas.tsx`
já existia (de F1) e já era genérico. G2 promoveu sua montagem pro `AppShell`
e deu a qualquer módulo um canal pra publicar nele:

```ts
// apps/web/src/core/registry/types.ts — campo novo em ModuleDefinition
interface ModuleDefinition {
  // ...campos existentes (id, label, icon, path, Panel, mapLayers)
  readonly showMap?: boolean; // default false/ausente — liga o painel de mapa no AppShell
}

// apps/web/src/core/map/mapStore.ts — o canal (Zustand)
interface MapStore {
  layers: readonly (MapLayerData & { visible: boolean })[];
  trace: RouteTrace | null;
  onMarkerClick: ((layerId: string, markerId: string) => void) | undefined;

  setMapLayers(layers: readonly (MapLayerData & { visible: boolean })[]): void;
  setMapTrace(trace: RouteTrace | null): void;
  setOnMarkerClick(handler: ((layerId: string, markerId: string) => void) | undefined): void;
  clearMap(): void; // OBRIGATÓRIO chamar no cleanup do módulo, ver nota abaixo
}
export const useMapStore: /* zustand store */;
```

**Como um módulo G3/G4/G5 usa isso** (mesmo padrão que `RotaCustosLayout`
usa hoje): `showMap: true` na definição do módulo; dentro do componente,
`useEffect` que chama `setMapLayers`/`setMapTrace` sempre que os dados de
busca mudarem, **e um `useEffect` de cleanup separado que chama
`clearMap()` no unmount — sem exceção**. QA (Stan Rizzo) provou por mutação
que esquecer isso é invisível nos testes hoje se o próximo módulo também
sobrescrever `layers` no seu próprio mount — mas se G3/G4/G5 alguma vez
publicarem markers de forma assíncrona (ex. só depois do fetch ao
`/places/nearby` resolver), o vazamento vira real. Cada unidade G3/G4/G5
**precisa** incluir um teste equivalente ao que fechou o gap em G2 (assert
direto em `useMapStore.getState()` após unmount, não via DOM de outro
módulo) — não é opcional, é lição direta do que a QA achou aqui.

`MapLayerData`/`MapMarkerSpec`/`RouteTrace` (o shape de camada/marcador) já
existiam desde F1 em `core/map/layers.ts` — nenhum tipo novo precisa ser
inventado pra G3/G4/G5, só popular esse shape com o resultado de
`GET /places/nearby` do G1.

## Peça reaproveitada, já existe hoje (não é do G2, é de F1)

`apps/web/src/core/components/PlaceSearch.tsx` — autocomplete de texto→lugar
já usado no Rota & Custos (origem/destino), chama `GET /places/search?q=`
(geocode existente, não confundir com o `/places/nearby` novo do G1). Os 3
módulos abaixo reusam esse componente **sem alterá-lo**, só pra deixar o
usuário digitar "perto de onde" antes de buscar categoria.

Vai precisar de uma função nova no client, mesmo padrão de `searchPlaces` em
`apps/web/src/core/api/client.ts`:

```ts
// nova, mesmo padrão de searchPlaces — a PRIMEIRA das 3 units (G3/G4/G5) a
// ser mergeada cria isso; as outras duas vão dar conflito mecânico aqui,
// igual sempre deu em modules/index.ts — eu resolvo na hora, é esperado.
export async function searchNearbyPlaces(
  lat: number,
  lng: number,
  category: 'hospedagem' | 'restaurantes' | 'atividades',
  radiusMeters?: number,
  signal?: AbortSignal,
): Promise<readonly PlaceResult[]>
```

## Fluxo de UX, igual nas 3 (G3/G4/G5)

1. Novo bloco no painel do módulo, acima do formulário atual: "Buscar perto
   de" usando `PlaceSearch` pro usuário digitar um ponto de referência
   (cidade, bairro, endereço).
2. Ao resolver um `Place` (lat/lng), chama `searchNearbyPlaces(lat, lng,
   '<categoria fixa do módulo>')` → `PlaceResult[]` (o range).
3. Resultado mostrado em **lista + mapa ao mesmo tempo**: publica os
   resultados no mapa compartilhado via `setMapLayers` (uma camada nova,
   um marker por resultado: `id`, `lat`, `lng`, `label: nome`) e registra
   `setOnMarkerClick((layerId, markerId) => ...)`. Não existe prop
   `selectedId`/`onSelectMarker` no `MapCanvas` — a seleção é um estado
   local do próprio módulo (`useState`), setado tanto pelo clique na lista
   quanto pelo handler de `onMarkerClick` (mesmo padrão que
   `RotaCustosLayout` já usa hoje pro `PlazaDrawer`), então os dois
   convergem pro mesmo estado.
4. Selecionar um resultado preenche `placeName`/`address` do formulário
   **existente** (não mexe em `calc.ts`, não cria campo novo — os 3 módulos
   já têm `placeName`/`address` prontos pra isso). O resto do formulário
   (preço, datas/pessoas) continua manual, como hoje.
5. Usuário pode ignorar a busca inteiramente e preencher tudo à mão, igual
   funciona hoje — **zero regressão**, a busca é aditiva.
6. Estados a cobrir: sem resultados (mensagem vazia, não erro), erro do
   backend (`502`/`503` do G1 — mensagem amigável, formulário manual
   continua 100% funcional), loading.

`category` fixo por módulo (bate com o enum do G1): `hospedagem` →
`'hospedagem'`, `restaurantes` → `'restaurantes'`, `atividades` →
`'atividades'`.

**Fora de escopo nos 3**: usar o destino de uma viagem já criada como ponto
de referência automático (module é standalone, sem login) — fica pra uma
unidade futura se o PE quiser essa integração com `planejamento-viagem`.
Place Details (foto/telefone/horário) — G1 não expõe isso ainda.

---

## G3 — Hospedagem: busca real + mapa (DRAFT, bloqueado por G1+G2)

**Escopo**: só `apps/web/src/modules/hospedagem/**` (+ a função
`searchNearbyPlaces` em `core/api/client.ts`/`types.ts`, compartilhada — ver
nota de conflito acima). Inclui `showMap: true` no objeto `hospedagemModule`
(definido no fim de `modules/hospedagem/index.tsx`, não em `module.ts` —
esse só tem `MODULE_PATH`) e o `useEffect` de cleanup chamando `clearMap()`
no unmount (obrigatório, ver "Contrato real de G2" acima).

**Aceite**:
- `pnpm --filter @qualroteiro/web build/typecheck/lint/test` verdes.
- Teste: buscar por um destino chama `GET /places/nearby` com
  `category=hospedagem` e o `lat`/`lng` resolvidos pelo `PlaceSearch`.
- Teste: selecionar um resultado da lista preenche `placeName`/`address`.
- Teste: selecionar um marcador no mapa faz o mesmo (via o handler
  registrado em `setOnMarkerClick`).
- Teste: desmontar o módulo (navegar pra outro lugar) limpa a store —
  assert direto em `useMapStore.getState()` (`layers` volta a `[]`), não
  via DOM de outro módulo. Sem isso o PR não é aceito (lição da QA em G2).
- Teste: erro do backend mostra mensagem, formulário manual continua
  editável e `calculateLodgingCost` continua funcionando.
- Teste: módulo sem nenhuma busca funciona exatamente como antes (regressão
  zero — reusar os testes existentes de `hospedagem.test.tsx` como base).
- `git diff --name-only origin/dev..HEAD` só `apps/web/**`.
- SDD sdd-lite.

---

## G4 — Restaurantes: busca real + mapa (DRAFT, bloqueado por G1+G2)

**Escopo**: só `apps/web/src/modules/restaurantes/**` (+ `searchNearbyPlaces`
compartilhada, mesma nota de conflito). Inclui `showMap: true` no objeto
`restaurantesModule` (fim de `modules/restaurantes/index.tsx`) e o
`useEffect` de cleanup chamando `clearMap()` no unmount (obrigatório, ver
"Contrato real de G2" acima).

**Aceite**: mesmo formato de G3, adaptado pro módulo:
- `pnpm --filter @qualroteiro/web build/typecheck/lint/test` verdes.
- Teste: busca chama `/places/nearby` com `category=restaurantes`.
- Teste: seleção (lista ou mapa, via `setOnMarkerClick`) preenche
  `placeName`/`address`.
- Teste: erro do backend não quebra `calculateRestaurantCost`.
- Teste: regressão zero sem busca (base: `restaurantes.test.tsx`).
- Teste: desmontar o módulo limpa a store — assert direto em
  `useMapStore.getState()` (`layers` volta a `[]`), não via DOM de outro
  módulo. Sem isso o PR não é aceito (lição da QA em G2).
- `git diff --name-only origin/dev..HEAD` só `apps/web/**`.
- SDD sdd-lite.

---

## G5 — Atividades: busca real + mapa (DRAFT, bloqueado por G1+G2)

**Escopo**: só `apps/web/src/modules/atividades/**` (+ `searchNearbyPlaces`
compartilhada, mesma nota de conflito). Inclui `showMap: true` no objeto
`atividadesModule` (fim de `modules/atividades/index.tsx`) e o `useEffect`
de cleanup chamando `clearMap()` no unmount (obrigatório, ver "Contrato
real de G2" acima).

**Aceite**: mesmo formato de G3, adaptado pro módulo:
- `pnpm --filter @qualroteiro/web build/typecheck/lint/test` verdes.
- Teste: busca chama `/places/nearby` com `category=atividades`.
- Teste: seleção (lista ou mapa, via `setOnMarkerClick`) preenche
  `placeName`/`address`.
- Teste: erro do backend não quebra `calculateActivityCost`.
- Teste: regressão zero sem busca (base: `atividades.test.tsx`).
- Teste: desmontar o módulo limpa a store — assert direto em
  `useMapStore.getState()` (`layers` volta a `[]`), não via DOM de outro
  módulo. Sem isso o PR não é aceito (lição da QA em G2).
- `git diff --name-only origin/dev..HEAD` só `apps/web/**`.
- SDD sdd-lite.

---

## Sequenciamento sugerido quando liberar

Mesmo padrão de F2b/c/d: as 3 podem ir em paralelo pro Codex. Conflito
esperado e mecânico em `core/api/client.ts`/`types.ts` (quem chegar segundo
e terceiro) — resolvo eu na hora de mergear, igual sempre. Cada PR ainda
passa pelo meu ciclo de verificação de sempre (build/typecheck/lint/test
reproduzido, não só relatado) antes de mergear.

## Lição real, achada ao integrar G3+G4+G5 (não é teórica — reproduzida)

Os 3 PRs do Codex, cada um sozinho, passavam CI limpo — inclusive o teste
obrigatório de "`clearMap()` no unmount" que pedi em cada brief. Mas ao
combinar os 3 (mesmo processo de resolver o conflito esperado em
`client.ts`), o teste de **Atividades** parou de provar o que devia: ele
navegava pra "Restaurantes" pra checar a store depois do unmount, e
Restaurantes (assim como Hospedagem) publica `layers` (mesmo vazio) já no
próprio mount — mascarando a ausência do `clearMap()` de Atividades
**exatamente como a QA achou em G2**, só que entre dois módulos-irmãos
dessa vez, não entre G2 e o módulo que o usa.

Reproduzi com mutação de verdade: removi `clearMap()` de Atividades na
árvore combinada, os 6 testes do arquivo continuaram passando. Corrigido
trocando a navegação por `rendered.unmount()` direto (mesmo padrão que
Hospedagem e Restaurantes já usavam, por acaso — eles escolheram a forma
seguro, Atividades não). Reaplicado na branch real do PR #27, mutação
reproduzida e corrigida lá também antes de mergear.

**Lição pra qualquer módulo futuro que ganhar `showMap:true`**: o teste de
"limpa no unmount" só prova algo se o destino da navegação NÃO publicar
`layers` no próprio mount. `rendered.unmount()` direto (sem navegar pra
lugar nenhum) é a forma segura — não depende de nenhuma suposição sobre o
que outro módulo faz.

## Status final da fase G (2026-09-16)

G1, G2, G3, G4, G5 — todos fechados, todos em `main`. Sequência real de
merge: PR #24 (G1) → PR #25 (G2) → promoção `dev→main` (PR #26) → PR #29
(G3 Hospedagem, primeira das 3 do Codex, sem conflito) → PR #28 (G4
Restaurantes, conflito mecânico esperado em `core/api/client.ts`/`types.ts`
resolvido por mim) → PR #27 (G5 Atividades, mesmo conflito + o fix do teste
de cleanup mascarado, ver seção acima). `main` reverificado do zero após a
última merge: build/typecheck/lint/test 125/125 verdes.

Busca real (Google Places) + mapa persistente agora funcionam nos 4 módulos
geográficos (Rota & Custos, Hospedagem, Restaurantes, Atividades), com
guarda de custo ativa no backend. Entrada manual continua funcionando em
todos, sem regressão.

## Revisão de front-end (2026-09-16)

Auditoria Playwright contra API/web reais, sem mocks e sem mudança de produto:
[relatório completo e evidências](docs/qa/2026-09-16-frontend-review/REPORT.md).
Achados: anúncio/associação acessível de erros nas três calculadoras
(importante), divergência de container de Restaurantes (cosmético) e inventário
de 17 declarações de cor hardcoded para prontidão de dark mode.

**Triagem (2026-09-16/17) — fechada:**

- **A11Y-01** (erros sem `aria-invalid`/`aria-describedby`/`role="alert"` em
  Hospedagem/Atividades/Restaurantes, 2 com mensagem em inglês) e **LAYOUT-01**
  (Restaurantes fora do container/header/peso de título dos módulos irmãos) —
  despachados juntos pro Codex (mecânico, critério já fechado — padrão de
  referência já existia em `VehicleProfileForm.tsx`). Corrigidos na PR #40
  (`fix(web): associate calculator validation errors`, mergeada em `main`,
  commit `2466391`). Verificação minha independente: diff lido linha a linha,
  CI real PASS, build/typecheck/lint (19 tasks) PASS, suíte completa do
  `apps/web` 132/132 PASS (reproduzida 2x isolada — a 1ª rodada teve 4 falhas
  em testes de modo demo não relacionados ao PR, replicadas idênticas contra
  `origin/main`, confirmando flakiness local pré-existente, não regressão),
  visual conferido nas evidências do próprio PR (`docs/qa/2026-09-16-frontend-a11y-layout/`).
  Relatório de correções em
  [`docs/qa/2026-09-16-frontend-a11y-layout/REPORT.md`](docs/qa/2026-09-16-frontend-a11y-layout/REPORT.md).
- **Inventário dark mode** (17 declarações hardcoded, concentradas em
  `core/map`) — sem ação. Dark mode não existe no produto hoje (zero classe
  `dark:`); fica só como backlog registrado, revisitar se/quando o PE decidir
  implementar tema escuro.

## Log de progresso

- 2026-09-16: G2 spec escrita e aprovada (`.aipe/journeys/j-20260916-gl/orientation.md`).
  **Decisão tomada pelo coordenador, documentada no próprio spec**: em vez de
  ligar mapa em todo módulo nesta unidade, G2 só constrói o mecanismo (store
  compartilhada + `MapCanvas` promovido pro `AppShell`) e liga em
  `rota-custos` (zero mudança visual pra quem já usa). Ativar em
  hospedagem/restaurantes/atividades fica pra G3/G4/G5, cada um junto com a
  busca real (mais coerente que dois momentos sem propósito visível entre
  eles). Descoberta importante ao investigar antes de escrever o spec:
  `MapCanvas` e `AppShell` já eram genéricos o bastante — G2 é extração, não
  construção do zero. Dispatchada (Peggy Olson, Claude), em andamento.
- 2026-09-16: G2 primeira rodada (Peggy Olson) travou (stall 600s) sem
  commitar nada — retry limpo, zero trabalho perdido. Segunda tentativa
  entregou: 112/112 testes, build/typecheck/lint limpos, regressão zero em
  Rota & Custos confirmada por mim linha a linha. PR #25 aberto, CI verde,
  `delivered` registrado.
- 2026-09-16: QA (Stan Rizzo) em PR #25 → **FAIL**. Achado bloqueante real:
  o contrato de `clearMap()` (store de mapa limpa no unmount — disciplina
  manual, não garantida por tipo, já documentada como risco no próprio
  código) não tem NENHUM teste que prove que está sendo seguido. QA mutou
  (removeu a chamada de `clearMap()`) e nenhum dos 112 testes quebrou,
  porque todo módulo `showMap:true` testado hoje sobrescreve `layers`
  síncrono no próprio mount, mascarando a ausência do cleanup em todo
  cenário de navegação exercitado. Não é bug em produção hoje, mas G3/G4/G5
  herdariam o vazamento sem rede de segurança. Fix round 2 despachado
  (Peggy Olson, mesma branch/PR): adicionar teste que assert direto em
  `useMapStore.getState()` após unmount (não via DOM de outro módulo que
  republica), provando com mutação própria antes de considerar pronto.
  Achado não-bloqueante à parte: `apps/web/.env.example` com
  `VITE_API_BASE_URL` concreto (pré-existente, fora do diff) — guardado em
  `COORDINATOR-STATE.md` pra próxima leva de fix.
- 2026-09-16: fix round 2 (Peggy Olson) fechou o gap — teste novo assert
  direto em `useMapStore.getState()` após desmontar `rota-custos` navegando
  pra um módulo sem mapa. Reproduzi a mutação da QA eu mesmo (removi
  `clearMap()`, só o teste novo cai). Re-gate (Stan Rizzo) → **PASS**,
  refez a mesma mutação de forma independente, confirmou. PR #25 mergeado
  em `dev` (commit `bf34f56`). **G2 fechado.** Worktrees órfãs dos 3
  sandboxes de tentativa (stall + 2 reconciliações) limpas.
  `apps/web/src/core/map/mapStore.ts` e o campo `showMap` em
  `ModuleDefinition` agora são reais — a seção "Contrato provisório de G2"
  acima foi atualizada pra refletir a API de verdade.

- 2026-09-16: G1 dispatchada (Pete Campbell, Claude, em andamento). G3/G4/G5
  adiantadas como draft a pedido do PE — **bloqueadas**, aguardando G1 e G2
  `merged` antes de liberar pro Codex.
- 2026-09-16: G1 **fechada**. PR #24 mergeado em `dev` (o merge no GitHub
  aconteceu antes do gate de QA terminar — reconciliado no ledger com
  `--reason` documentando isso, não foi um skip silencioso). QA (Joan
  Holloway) PASS, 152/152, disjuntor e incremento-só-em-sucesso provados por
  mutação própria dela, chamada real ao Google reproduzida de forma
  independente. Um achado Minor não-bloqueante: doc-comment errado em
  `ApiUsageCounter.count` (`apps/api/prisma/schema.prisma`) — diz que conta
  sucesso-ou-falha, código só conta sucesso (certo). **Guardado pra próxima
  leva de fix** (ver `COORDINATOR-STATE.md` § Pontas soltas) — não vale uma
  jornada própria sozinho, mecânico, 1-2 linhas.

- 2026-09-17: Codex adicionou regressao de selecao de lugar seguida de
  edicao manual do endereco nos tres modulos (hospedagem, restaurantes,
  atividades). PR https://github.com/joaofssantos/qualroteiro/pull/53,
  branch `codex/test/address-edit-clears-coordinates`, commit `b80d277`,
  base `main`. Apenas os tres arquivos de teste foram commitados.
  Os casos verificam o novo endereco e `lat: null, lng: null` no payload
  de `createTripItem`, apos confirmar o dialog de salvar na viagem.
  Prova por mutacao: removendo apenas `setCoords(null)` do onChange de
  endereco em cada modulo, os 3 testes novos falharam e os outros 25
  passaram. Linhas restauradas antes da validacao final, sem diff de
  producao. `pnpm -w build`, `typecheck`, `lint` e `test`: PASS
  (frontend 154 testes; API 173). Dependencias locais de data-ingest
  instaladas com `pnpm install --frozen-lockfile`, sem mudar lockfile.
  Evidencia detalhada na descricao da PR; log mutante local em
  `/private/tmp/qualroteiro-address-mutation.log`.
  **Revisada e mergeada por mim (Claude)**: reproduzi a mutação de forma
  independente (removi `setCoords(null)` eu mesmo, confirmei que exatamente
  o teste novo de cada módulo falha) antes de aceitar a alegação. CI real
  PASS, diff só nos 3 arquivos de teste. Mergeada (`ce5a296`) em `main`.
