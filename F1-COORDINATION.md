# F1 — Documento de Coordenação (Claude ⇄ Codex)

> **Fonte única de verdade** para o acabamento do F1 do qualroteiro.
> Ninguém precisa copiar contexto entre chats — tudo que importa está aqui.
>
> - **Don Drapper (Claude / coordenador AIPe)** mantém: seções 1–4, a coluna
>   "Dono" e "Status" da tabela, os briefs, e faz o **QA gate** de tudo antes de
>   entrar no `dev`.
> - **Você (PE, dirigindo o Codex)** mantém: o **Log de progresso** (seção 8) —
>   uma linha por avanço — e marca `EM ANDAMENTO` / `PR ABERTA` na tabela.
> - Cada tarefa vira **um branch → uma PR pra `dev`**. Codex não mergeia; abre a
>   PR, você avisa aqui no log, o Claude roda o QA e mergeia.

Última atualização: 2026-09-10 · Jornada F1 original: `j-20260908-yk` (mergeada no `dev`) · Jornada demo-mode: `j-20260909-ym` (em andamento)

---

## 1. Estado atual do F1

F1 ("Rota & Custos") está **completo e integrado no `dev`** (9 commits à frente de
`main`, ainda não promovido). Três unidades entregues e QA-gated:

| Pacote | O que tem | Testes |
|---|---|---|
| `packages/{geo,routing,tolls,fuel}` | tipos + lógica pura; `RoutingProvider`/`GeocodeProvider` são **interfaces**; `matchTolls` + seed demo de 3 corredores; `estimateFuel` | 81 |
| `apps/api` | `POST /routes/plan`, `GET /places/search`; adapters **OpenRouteService** reais (`ors-routing.ts` parseia geometria de estrada completa); seam injetável `buildApp({routing,geocode})` | 34 |
| `apps/web` | shell + `moduleRegistry` (extensibilidade provada por teste); módulo "Rota & Custos" com 3 telas; layout split na tela de resultado | 46 |

### Dois problemas que o PE notou na homologação

**P1 — o mapa só aparece ao submeter.** `MapCanvas` é montado só em
`apps/web/src/modules/rota-custos/ResultScreen.tsx`. A
`NewQueryScreen.tsx` (Tela 1) é só formulário. → **T1**.

**P2 — a rota é "ponto a ponto", falta roterização.** Causa em duas camadas:
- `apps/api/src/providers/ors-routing.ts` **é um adapter ORS de verdade** e
  devolve a polyline completa da estrada — mas **nunca foi chamado** (sem
  `ORS_API_KEY` no ambiente). → **T2**.
- O caminho de demo/fixture usa `dutraCorridor.referencePolyline` (e as dos
  outros 2 corredores) = **8 pontos** ligando São Paulo → "perto de cada praça"
  → Rio. É reta entre pontos, não segue a estrada. → **T3**.

### Outras lacunas conhecidas (do QA das ondas anteriores)

- `points.fuelStations` é **sempre `[]`** (seed não tem postos). → **T4**
- Sem **CI** — tudo verificado local. → **T5**
- F1 não promovido `dev → main`. → **T6**
- Seed de pedágio é **demo** (3 corredores, tarifas 2024–25 aproximadas, não
  ANTT/ARTESP). Fora de escopo consertar agora.

---

## 2. Repositório & comandos

- Clone do produto: `/Users/joaofsantos/Documents/code/qualroteiro/repos/qualroteiro`
- Monorepo pnpm + Turborepo. Node 20, pnpm 9.
- Branch de integração: **`dev`** (todas as PRs de tarefa têm base `dev`).
  `main` só recebe promoção de release.
- Setup: `pnpm install` na raiz do repo.
- Verificação (rodar antes de abrir PR):
  ```sh
  pnpm install
  pnpm -w build
  pnpm -w typecheck
  pnpm -w lint
  pnpm -w test
  ```
- Rodar local: `pnpm --filter @qualroteiro/api dev` (precisa `ORS_API_KEY`) e
  `pnpm --filter @qualroteiro/web dev` (proxy `/api` → `:3000`).

### Fluxo de branch por tarefa (Codex)

```
git -C repos/qualroteiro fetch origin
git -C repos/qualroteiro switch -c codex/f1/<slug> origin/dev
# ... trabalho ...
git push -u origin codex/f1/<slug>
gh pr create --base dev --head codex/f1/<slug> --title "..." --body "..."
```
Depois: anota no **Log de progresso** (seção 8) "PR #N aberta". O Claude roda o
QA gate e mergeia. Codex **não** mergeia nem toca `main`.

---

## 3. Contratos que NÃO mudam

Qualquer tarefa que encoste nisto sem combinar antes está errada.

### Contrato HTTP (`apps/api/specs/002-rota-custos-api/spec.md`)

- `POST /routes/plan` — body
  `{ origin, destination, waypoints?, vehicle:{ type, axleCategory, consumptionKmPerL }, fuelPricePerL }`;
  `origin`/`destination`/`waypoints[]` = `{ lng, lat }` **ou** string.
  Resposta `200`:
  ```jsonc
  { "routes": [ {
      "geometry":   { "type":"LineString", "coordinates":[[lng,lat], ...] },
      "distanceKm": 429.7, "durationMin": 342.5,
      "tolls": { "plazas": [/* TollPlaza[] */], "total": 52.9 },
      "fuel":  { "liters": 42.97, "cost": 257.82 },
      "points":{ "tolls": [/* TollPlaza[] */], "fuelStations": [] }
  } ] }
  ```
  `400` (campo inválido, mensagem nomeia o campo) · `422` (string de lugar sem
  geocode, mensagem nomeia qual) · `502` (provider falhou). Erro sempre
  `{ "error": "..." }`.
- `GET /places/search?q=` → `200 { "places": Place[] }` · `400` (q vazio) · `502`.
- `Place` = `{ id, label, lng, lat, kind? }`.
- `TollPlaza` = `{ id, name, concessionaire, highway, km, lat, lng, tariffByAxleCategory }`.

### Internals do web que T1 vai usar (do `dev`)

- `apps/web/src/core/map/MapCanvas.tsx` — `MapCanvasProps`:
  ```ts
  trace: readonly (readonly [number, number])[] | null;   // polyline ativa; null = nada
  layers: readonly (MapLayerData & { visible: boolean })[]; // camadas de marcadores
  onMarkerClick?: (layerId: string, markerId: string) => void;
  className?: string; label?: string;
  ```
- `apps/web/src/core/components/PlaceSearch.tsx` — `value: PlaceFieldValue`
  (`{ text: string; place: Place | null }`), `onChange(value)`.
- `apps/web/src/core/store/routeStore.ts` — `useRouteStore` (zustand):
  `query: PlanQuery | null`, `routes`, `activeIndex`, `status:
  'idle'|'loading'|'ready'|'error'`, `layers`, e ações `startPlanning`,
  `planSucceeded`, `planFailed`, `setActiveIndex`, `reset`, `registerLayer`,
  `toggleLayer`, `setLayerVisible`.
- `apps/web/src/core/shell/AppShell.tsx` — a nav é gerada do
  `moduleRegistry`; **este arquivo não conhece módulo concreto** (é o contrato de
  extensibilidade — não quebrar).
- Testes atuais do web: `apps/web/src/**/*.test.tsx` (46, todos devem continuar
  verdes).

---

## 4. Tabela de tarefas

| # | Tarefa | Pacote | Dono | Status | Branch / PR |
|---|---|---|---|---|---|
| **T1** | Mapa persistente (mapa na Tela 1, pins ao selecionar, split como padrão do módulo) | `apps/web` | **Codex (PE)** | ✅ VERIFICADA + MERGEADA no `dev` (`d3ca5a4`) | PR #5 |
| **T2** | Ativar roterização real (ORS key + smoke test real + correções da 1ª chamada) | `apps/api` | **Claude/AIPe** | ✅ VERIFICADA + MERGEADA (PR #9) — bug real: `.env` não carregava | PR #9 |
| **T3** | Polylines reais dos 3 corredores (traçado seguindo a estrada, congelado no seed) | `packages/tolls` | **Codex (PE)** | ✅ VERIFICADA + MERGEADA no `dev` (`004c8e1`) | PR #6 |
| **T4** | Postos de combustível (seed mínimo → `points.fuelStations` deixa de ser `[]`) | `packages/tolls` + `apps/api` | **Claude/AIPe** | ✅ COMPLETA (PR #8, #11) | PR #8, #11 |
| **T5** | CI + fix pré-req: `apps/api` sem `eslint.config.js` | `apps/api` → `root` | **Claude/AIPe** | ✅ Wave 1 (PR #7) · 🔄 Wave 2 (CI, PR #10) em QA — **já rodou de verdade no GitHub Actions** | PR #7, #10 |
| **T6** | Promoção F1 `dev → main` | coordenação | **Claude** | 🟢 **TUDO PRONTO — aguardando decisão do PE** | — |

**Paralelismo:** T1 (web) ∥ T2 (api) ∥ T3 (tolls) ∥ T5 (root) — pacotes
distintos, sem conflito. **Único gargalo:** T1 no Codex e a jornada
`j-20260909-ym` (demo-mode, também `apps/web`) mexem no mesmo pacote — T1 sai de
`origin/dev` **depois** que a PR do demo-mode mergear, ou rebaseia.

---

## 5. Brief — T1 · Mapa persistente (Codex)

**Repo:** `repos/qualroteiro` · **Pacote:** `apps/web` **só** (nunca `apps/api`,
`packages/`, config de raiz) · **Base:** `origin/dev` (depois da PR do demo-mode) ·
**Branch:** `codex/f1/t1-map-persistente`

### Problema
Hoje o `MapCanvas` só monta na tela de resultado. O usuário digita origem/destino
sem ver mapa nenhum. Queremos o mapa presente **desde a Tela 1**, reagindo às
escolhas do formulário, e o traçado da rota aparecendo quando houver resultado.

### O que fazer
1. **Layout do módulo "Rota & Custos" vira split persistente.** O `MapCanvas`
   passa a viver num contêiner do módulo (ex. um `RotaCustosLayout` que embrulha
   as rotas internas `/` e `/resultado`), não dentro do `ResultScreen`. Mapa à
   esquerda/topo, conteúdo (form ou painel) à direita/baixo — mesmo split
   responsivo que o `ResultScreen` já usa (`md:flex-row`, mapa `md:flex-1`,
   painel `md:w-[26rem]`).
2. **Mapa reage ao formulário (Tela 1):**
   - Ao escolher **origem** e/ou **destino** no `PlaceSearch` (tem
     `value.place: Place | null` com `lng`/`lat`), põe um marcador para cada um
     via a prop `layers` do `MapCanvas` (camada `"endpoints"`, marker id
     `"origin"` / `"destination"`).
   - Enquadra o mapa nos marcadores existentes (o `MapCanvas` já tem `boundsOf`
     nas layers; se precisar, exponha um jeito de dar fit — sem reescrever o
     `MapCanvas`, preferir passar as coordenadas via `layers`).
   - Paradas (`waypoints`) também viram marcadores se tiverem `place`.
   - Enquanto não houver resultado, `trace={null}` (sem linha).
3. **Tela de resultado:** o `trace` passa a ser a polyline da rota ativa
   (`routes[activeIndex].geometry.coordinates`), como já é hoje — só que agora o
   mapa **não desmonta** na transição Tela 1 → Tela 2 (ele persiste no layout).
   As camadas de pedágio/pontos continuam como estão.
4. **Estado:** guardar os marcadores de endpoint no `routeStore` (adicionar
   campos/ações se precisar — ex. `setEndpointMarker(kind, place)`) OU num estado
   local do layout. Preferir o store se for reusado; documentar a escolha.
5. **Sem** novo provider, sem chamada de rede nova, sem mexer no `moduleRegistry`
   nem no `AppShell`.

### Aceitação (o QA do Claude vai checar contra o diff)
- `pnpm --filter @qualroteiro/web build|typecheck|lint|test` verdes; `pnpm -w build` verde.
- Os **46 testes atuais continuam passando** (ajuste só o que a mudança de
  layout legitimamente exigir; se um teste dependia de "não tem mapa na Tela 1",
  atualize-o e explique no PR).
- Teste novo: na Tela 1, escolher origem "São Paulo, SP" e destino "Rio de
  Janeiro, RJ" faz aparecerem **2 marcadores** no mapa **sem** submeter o
  formulário e **sem** request de rede.
- Teste novo: submeter leva à Tela 2 com o `trace` = coordenadas da rota ativa, e
  o mapa **não** é recriado (o nó do container persiste — pode provar via um
  `data-testid` estável no container do mapa).
- Alternar alternativa na Tela 2 troca o `trace` (comportamento atual mantido).
- Diff só em `apps/web/**` (+ `pnpm-lock.yaml` se add devDep).
- Um `spec.md` + `plan.md` curtos commitados (pode ser sob `apps/web/specs/004-*`).

### Fora de escopo
Roterização real (é T2) · polylines reais (T3) · deploy · qualquer coisa fora de `apps/web`.

---

## 6. Brief — T3 · Polylines reais dos 3 corredores (Codex)

**Repo:** `repos/qualroteiro` · **Pacote:** `packages/tolls` **só** · **Base:**
`origin/dev` · **Branch:** `codex/f1/t3-polylines`

### Problema
`packages/tolls/src/seed/{dutra,regis-bittencourt,bandeirantes}.ts` têm
`referencePolyline` com ~8 pontos (São Paulo → perto de cada praça → destino).
É reta entre pontos. O `matchTolls` casa praça↔rota por proximidade dessa
polyline, e o `apps/web` desenha exatamente ela no caminho de demo/fixture — daí
o "ponto a ponto".

### O que fazer
1. Para cada um dos 3 corredores, obter uma **polyline seguindo a estrada real**
   (dezenas a centenas de pontos), **uma vez**, e **congelar** no seed:
   - Fonte sugerida: OpenRouteService (`/v2/directions/driving-car/geojson`) ou
     OSRM público (`router.project-osrm.org`) ou GraphHopper — qualquer um, é
     one-shot. Rodar da origem à praça final de cada corredor, pelas coords das
     pontas que já estão no seed.
   - Simplificar se ficar gigante (Douglas-Peucker, tolerância ~50–100 m) pra não
     inchar o bundle — alvo grosseiro: 100–400 pontos por corredor.
2. Substituir o `coordinates` de cada `referencePolyline` pela nova geometria.
   **Manter** a estrutura (`{ type: 'LineString', coordinates: [...] }`) e o
   comentário/`DEMO DATA` disclaimer do arquivo.
3. **Não** mudar praças, tarifas, ids de corredor, nem a assinatura de
   `matchTolls` ou qualquer coisa em `packages/tolls/src/match.ts`,
   `tariff.ts`, `types.ts`.
4. Conferir que as praças de cada corredor continuam **dentro do buffer de 500 m**
   da nova polyline (as coords das praças no seed são aproximadas; se alguma
   praça cair fora, ajuste a coord **da praça** pro ponto da estrada mais próximo
   e anote no PR).

### Aceitação
- `pnpm --filter @qualroteiro/tolls build|typecheck|test` verdes; `pnpm -w test` verde.
- Os **44 testes de `tolls` continuam passando** — em especial os de `matchTolls`
  que casam as 6 praças da Dutra e devolvem `total` = soma.
- Cada `referencePolyline` tem **≥ 50 pontos** e visualmente segue a rodovia
  (não corta reto entre cidades). Incluir no PR um print ou um geojson.io link
  de cada traçado.
- Teste novo (ou ajuste): todas as praças de cada corridor estão
  `isWithinBuffer(plaza, referencePolyline, 500)`.
- `distanceKm`/`durationMin` de fixture que dependam disso (se houver) revisados
  pra bater com o comprimento real da nova polyline.
- Diff só em `packages/tolls/**`. `spec.md` + `plan.md` curtos commitados.

### Fora de escopo
Dados reais de tarifa/ANTT · postos (T4) · qualquer coisa fora de `packages/tolls`.

---

## 7. Tarefas Claude/AIPe (resumo — o Claude despacha, não o Codex)

- **T2 · Ativar roterização real** — `apps/api`. Põe `ORS_API_KEY` no ambiente,
  roda o 1º `POST /routes/plan` real, corrige o que a chamada de verdade revelar
  (nome de campo, `profile`, retry de `alternative_routes`). Entrega: smoke test
  real documentado + ajustes. **Precisa o PE fornecer a `ORS_API_KEY`.**
- **T4 · Postos de combustível** — `packages/tolls` (seed de postos) + `apps/api`
  (montar `points.fuelStations`). Bloqueada por T3 (usa a mesma polyline).
- **T5 · CI** — `root`. GitHub Actions rodando `pnpm -w build/typecheck/lint/test`
  em PR pra `dev` e `main`. Pronta pra disparar quando o PE liberar.
- **T6 · Promoção `dev → main`** — o Claude abre a PR de promoção quando T1+T2
  estiverem no `dev` e o PE aprovar.

---

## 8. Log de progresso  *(append-only — uma linha por avanço, mais recente embaixo)*

- `2026-09-10` — Claude — documento criado. T1/T3 prontas pro Codex. T5 pronta pra
  disparar. Aguardando `ORS_API_KEY` do PE pra T2. Jornada `j-20260909-ym`
  (demo-mode, `apps/web`) ainda em andamento — T1 espera ela mergear.
- `2026-09-10` — Claude — `j-20260909-ym` entregou **PR #4** (`VITE_DEMO_MODE`,
  fixtures dos 3 corredores com `matchTolls`/`estimateFuel` reais, badge, docs;
  63 testes verdes). Em **QA gate** (Stan Rizzo). Ao passar + mergear no `dev`,
  **T1 fica liberada** pro Codex sair de `origin/dev`.
- `2026-09-10` — PE — **T1 e T3 iniciadas no Codex.** T3 sai limpo de
  `origin/dev`. T1 será rebaseada em `origin/dev` após a PR #4 mergear (o Claude
  avisa neste log). Quem abrir a 2ª PR que toca `apps/web` resolve o conflito.
- `2026-09-10` — Claude — **PR #4 (demo-mode) mergeada no `dev`** (`e8ec125`).
  QA do Stan Rizzo: **PASS 10/10**, 1 finding menor (dado do seed `@qualroteiro/tolls`
  ~1.6 kB gzip entra no bundle main mesmo com demo off; docs exageram o "drop all
  demo code"). Não vira tarefa agora — anotado. **T1 liberada: Codex rebaseia a
  branch de T1 em `origin/dev` `e8ec125`.** `dev` agora tem 12 commits à frente
  de `main`.
- `2026-09-10` — Codex — **T1 implementada** em
  `codex/f1/t1-map-persistente`; PR #5 aberta para `dev`. Verificações verdes:
  `pnpm --filter @qualroteiro/web build`, `typecheck`, `lint`, `test` e
  `pnpm -w build`.
- `2026-09-10` — Claude — **T1 verificada e mergeada no `dev`** (`d3ca5a4`).
  Checagem: `pnpm -w build` 6/6, `web typecheck`+`lint` limpos, **65 testes**
  (63 + 2 novos: "shows selected origin and destination markers before
  submitting", "keeps the same map container when the result screen opens").
  Novo `RotaCustosLayout` embrulha as rotas do módulo com `<Outlet/>`, hoista
  `MapCanvas`+`PlazaDrawer`; `endpointMarkers` no `routeStore` (aditivo);
  `AppShell.tsx` **não** tocado (contrato de extensibilidade intacto); escopo só
  `apps/web/**`; SDD `specs/005-mapa-persistente/` commitado. **Sem findings
  bloqueantes.** `dev` agora 14 commits à frente de `main`.
- `2026-09-10` — Codex — **T3 implementada** em
  `codex/f1/t3-polylines`; PR #6 aberta para `dev`. Polylines OSRM congeladas:
  Dutra 305 pontos, Régis Bittencourt 389, Bandeirantes 110; todas as praças
  continuam dentro do buffer de 500 m. Verificações verdes: `tolls build`,
  `tolls typecheck`, `tolls test` (44), `pnpm -w build`, `pnpm -w typecheck`,
  `pnpm -w test`. `pnpm -w lint` bloqueia antes de T3 por config ESLint em
  `apps/api` (`eslint.config.*` ausente).

- `2026-09-10` — Codex — **T3 implementada** em `codex/f1/t3-polylines`; PR #6
  aberta. Polylines: Dutra 305 / Régis 389 / Bandeirantes 110 vértices.
- `2026-09-10` — Claude — **T3 verificada e mergeada no `dev`** (`004c8e1`).
  `pnpm -w build` 6/6, `-w typecheck` 10/10, `-w test` **180 testes** (tolls 44
  incl. novos: "cada praça dentro do buffer da própria polyline", "polyline
  road-following com ≥50 vértices"). Escopo só `packages/tolls/**` (6 arquivos);
  SDD `specs/003-road-polylines/` commitado. Base estava defasada (antes do
  merge de T1) mas sem overlap de arquivo — GitHub 3-way mergeou limpo; re-rodei
  `dev` pós-merge (T1+T3 juntos) e está verde. Sem findings bloqueantes.
  **T4 desbloqueada.** `dev` agora 16 commits à frente de `main`.

- `2026-09-10` — Claude — **T5 (CI) despachada** via AIPe (jornada `j-20260910-hq`, Lane Pryce `standard`). Workflow `.github/workflows/ci.yml` rodando `pnpm -w build/typecheck/lint/test` em PR/push pra `dev` e `main`. Escopo só `.github/**`. QA gate Bertram Cooper na sequência.

- `2026-09-10` — Claude — **T5: bug pré-existente achado pelo dev.** Num checkout limpo do `dev`, `pnpm -w lint` **falha**: `apps/api` tem script `lint` mas nenhum `eslint.config.js` nem devDep de `eslint` (nunca pego — nenhum QA rodou `-w lint`). `build`/`typecheck`/`test` ok. Um CI verde precisa disso corrigido. **Spec da T5 amendada (v1→v2, 2 unidades):** Wave 1 `apps/api` adiciona o flat config espelhando `apps/web`; Wave 2 `root` o workflow. Aguardando reaprovação do PE.

- `2026-09-15` — Claude — **Recuperei o dev de T5-Wave1**: o subagent (Pete Campbell) travou 600s sem progresso logo antes de abrir a PR, mas o worktree tinha 2 commits limpos e prontos (SDD + flat config). Verifiquei independentemente (`lint`/`typecheck`/`test` limpos, `pnpm -w lint` 2/2), empurrei e abri a **PR #7**. Em QA (Joan Holloway).
- `2026-09-15` — Claude — Achei um branch local vazio `codex/fix/api-eslint-config` (sem commits, idêntico ao `dev`) — parece um início de sessão codex que não chegou a escrever nada. Não é trabalho duplicado, mas evita começar o mesmo fix aí agora que a PR #7 já resolve.
- `2026-09-15` — Claude — **T4 Wave 1 despachada** (jornada `j-20260914-bb`, Lane Pryce): seed de 4–6 postos/corredor + `matchFuelStations` em `packages/tolls`, dentro do buffer da polyline real de T3.
- `2026-09-15` — Claude — **`ORS_API_KEY` confirmada** (não lida/exibida). T2 fica na fila de `apps/api` atrás da PR #7 — disparo assim que ela mergear, pra não colidir no mesmo pacote.

- `2026-09-15` — Claude — **PR #7 verificada (QA passou 6/6, 0 findings) e mergeada no `dev`** (`e08c138`). `dev` agora 19 commits à frente de `main`. **T2 despachada** (jornada `j-20260915-er`, Pete Campbell) com a `ORS_API_KEY` já no `.env` do worktree. **T5-Wave2 (CI) na fila** — colidiu com T4-Wave1 no pacote `root` (ambas usam o mesmo dono, mesmo sem overlap de arquivo); disparo assim que T4-Wave1 fechar.

- `2026-09-15` — Claude — **PR #8 verificada (QA passou 8/8, 0 críticos) e mergeada no `dev`** (`aba1cde`). `dev` agora 22 commits à frente de `main`. **T5-Wave2 (CI) despachada** agora que `root` liberou. **T4-Wave2 (`apps/api`) na fila**, atrás de T2 (mesmo pacote).

- `2026-09-15` — Claude — **T2 entregue: PR #9.** Os adapters ORS **funcionaram certos de primeira** contra o serviço real — geometria real SP->RJ com **3.811 pontos** (vs. os 2-8 pontos dos fakes/seed), distanceKm/durationMin/tolls/fuel corretos, geocoder OK. **O bug real era outro**: `apps/api/.env` nunca era carregado em `process.env` (sem dotenv, sem `--env-file`) — o server recusava subir mesmo com key válida no disco. Corrigido com um parser de `.env` pequeno e sem dependência nova. 3 testes novos RED->GREEN (via `git stash`); os 34 antigos inalterados; suite continua sem depender de rede. Key nunca tocada/exibida/commitada. Em QA (Joan Holloway, com a key real pra fazer 1 chamada de verificação).

- `2026-09-15` — Claude — **PR #9 verificada (6/6, 0 crítico) e mergeada** (`36da2e7`). **T2 fechada** — roterização real funcionando. **PR #10 (CI, Wave 2 de T5) entregue e JÁ RODOU no GitHub Actions de verdade** (run 35001863258, sucesso) — em QA. **T4-Wave2 despachada** agora que `apps/api` liberou (popula `points.fuelStations` de verdade). `dev` 24 commits à frente de `main`.

- `2026-09-16` — Claude — **PR #11 verificada (8/8, 1 minor) e mergeada** (pelo PE, `54ac683`). **T4 completa.** **Acabamento do F1 fechado: T1–T5 todas mergeadas e QA-gated.** Verificação final em `origin/dev` limpo: `build` 6/6, `typecheck` 10/10, `lint` 2/2, `test` 10/10 · **207 testes** (routing 6, fuel 11, geo 20, tolls 67, web 65, api 38). `dev` 30 commits à frente de `main`. Só falta T6 (promoção) — decisão do PE.

---

## 9. Decisões pendentes do PE

1. **`ORS_API_KEY`** — tem? (grátis em openrouteservice.org/dev/#/signup). Destrava T2 e a fonte de T3.
2. **Liberar T5 (CI)** agora, em paralelo? (barato, sem risco)
3. **Ordem da promoção T6** — depois de T1+T2, ou já promover o F1 atual e as tarefas entram como incrementos?
4. **Split confirmado?** T1+T3 Codex, T2+T4+T5 Claude, T6 coordenação.
