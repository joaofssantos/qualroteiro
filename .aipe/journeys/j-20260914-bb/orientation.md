# Orientation Spec — j-20260914-bb (T4 — postos de combustível)

> PE escolheu a opção (a) seed demo à mão para os dados de posto (2026-09-14).

## Problem

`points.fuelStations` no contrato de `POST /routes/plan` é **sempre `[]`**
(WAVE 1 do F1 não trouxe dados de posto). O painel "Pontos na rota" do web já
renderiza a seção, só falta dado. T4 do `F1-COORDINATION.md`.

## Cross-package contracts

- `qualroteiro/root` (dono de `packages/*`) adiciona um seed mínimo de postos
  por corredor + `matchFuelStations` em `@qualroteiro/tolls` (mesmo pacote que já
  guarda pedágios — não existe `packages/places` ainda; nota pra F2).
- `qualroteiro/api` importa `matchFuelStations` e popula `points.fuelStations`
  em `POST /routes/plan`. **Tem que esperar a unidade `root` desta jornada
  mergear.** Além disso, `apps/api` já tem duas outras unidades na fila (fix de
  eslint da T5, e T2 de ativação do ORS) — a unidade `api` **só é despachada
  depois que essas duas estiverem mergeadas**, pra não colidir no mesmo pacote.
- Contrato do campo não muda de shape (`FuelStation = { id, name, lng, lat }`,
  já documentado como "populá-lo não é mudança de contrato").

## Per-package scope

### qualroteiro/root
- **Scope:**
  - Em `packages/tolls/src/types.ts`: tipo `FuelStationSeed = { readonly id:
    string; readonly name: string; readonly lat: number; readonly lng: number }`
    (mesma forma do `FuelStation` do contrato). Adicionar campo opcional
    `readonly fuelStations?: readonly FuelStationSeed[]` em `Corridor` (aditivo —
    não quebra nenhum consumidor existente).
  - Popular **4 a 6 postos por corredor**, coordenadas plausíveis próximas ao
    `referencePolyline` real (o de T3, já mergeado — 305/389/110 vértices),
    nomes genéricos de bandeira (ex. "Posto Ipiranga — km X", "Posto Shell —
    km Y") marcados como dado demo, mesmo padrão de comentário `DEMO DATA` do
    seed de pedágio.
  - `matchFuelStations({ routeGeometry, corridorHint? }): { stations:
    FuelStationSeed[] }` em `packages/tolls/src/match.ts` (ou arquivo irmão),
    reusando `isWithinBuffer`/`TOLL_MATCH_BUFFER_METERS` de `@qualroteiro/geo`
    igual o `matchTolls` — mesmo buffer de 500 m, a menos que haja razão pra um
    valor diferente (documentar se mudar).
  - Exportar `FuelStationSeed` e `matchFuelStations` em `packages/tolls/src/index.ts`.
  - **Não** tocar `apps/api`, `apps/web`, config de raiz.
- **Acceptance:**
  - `pnpm --filter @qualroteiro/tolls build/typecheck/test` verdes; `pnpm -w test`
    verde (regressão dos 44 testes de tolls existentes).
  - Teste novo: `matchFuelStations` sobre o `referencePolyline` da Dutra devolve
    os postos daquele corredor (todos dentro do buffer); um traçado sintético
    sem postos por perto devolve `{ stations: [] }`.
  - Cada posto do seed está dentro do buffer do `referencePolyline` do seu
    próprio corredor (mesmo teste de auto-consistência que T3 fez pro pedágio).
  - Diff só em `packages/tolls/**`. SDD `aipe skill match --task-type feature
    --size small` (sdd-lite).

### qualroteiro/api
- **Scope:**
  - Em `apps/api/src/routes/plan.ts`: trocar o tipo `readonly fuelStations:
    readonly never[]` por `readonly fuelStations: readonly FuelStation[]`
    (`FuelStation` = mesma forma `{id,name,lng,lat}` — definir localmente ou
    importar de `@qualroteiro/tolls`, à escolha do dev, documentar).
  - Chamar `matchFuelStations` com a mesma `routeGeometry`/`corridorHint` usados
    em `matchTolls` pra cada alternativa, popular `points.fuelStations` com o
    resultado.
  - Atualizar `apps/api/specs/002-rota-custos-api/spec.md` — a linha
    "Deliberate limitations" sobre `fuelStations` sempre `[]` deixa de ser
    verdade; documentar o novo comportamento sem quebrar o resto do doc.
  - **Não** tocar `apps/web`, `packages/*`, config de raiz.
- **Acceptance:**
  - `pnpm --filter @qualroteiro/api test/typecheck/lint` verdes (34+ testes).
  - Teste de integração: `POST /routes/plan` SP→RJ (provider mockado, geometria
    Dutra) → `points.fuelStations` **não-vazio**, cada item com `{id,name,lng,lat}`.
  - Corredor sem postos semeados (se houver) → `points.fuelStations: []`, sem
    erro.
  - Diff só em `apps/api/**` + `apps/api/specs/**`.

## Sequencing

- **Wave 1:** `qualroteiro/root` (dev: Lane Pryce) → QA Bertram Cooper.
- **Wave 2:** `qualroteiro/api` (dev: Pete Campbell) → QA Joan Holloway. Abre só
  depois que Wave 1 **e** a fila de `apps/api` de outras jornadas (T5-eslint,
  T2-ORS) estiverem mergeadas.

## Per-unit dispatch envelopes

`aipe execution propose --journey j-20260914-bb` — `subagent/claude-code/standard/normal`
(cost-index 2) pras duas unidades: mecânico contra um padrão já existente
(espelha `matchTolls`/o seed de pedágio), sem julgamento arquitetural novo.
`--size small` → sdd-lite. QAs no mesmo envelope.

## Out of scope

- Preço de combustível real (ANP) — só localização + nome, dado demo.
- `packages/places` — a reorganização pra um pacote dedicado é nota pra F2, não
  faz parte desta jornada.
- Qualquer coisa em `apps/web` (o painel já renderiza a seção; só falta dado).
