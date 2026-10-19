# Orientation Spec — j-20260915-bp (F2f — Roteiro: reordenar dias/itens)

> PE confirmou: F2f inteira via Claude/AIPe (2026-09-16). Último pedaço do F2
> original ("timeline arrastável").

## Problem

O `TripDetailScreen` mostra dias e itens em ordem fixa (a ordem em que foram
criados). F2f adiciona reordenar: arrastar itens dentro de um dia, mover item
pra outro dia, e reordenar os próprios dias. É a peça de "timeline de verdade"
que F2e deixou de fora de propósito (precisa de contrato de API novo).

## Cross-package contracts

- **`qualroteiro/api` → `qualroteiro/web`**: dois endpoints novos, mesmo
  padrão de autenticação/ownership de tudo que já existe em `/trips*` (Clerk
  bearer token, `404` se não existe ou não é do usuário — nunca `403`, nunca
  vaza existência).
  - `PATCH /trips/:id/days/:dayId` — body `{ date?: string | null, order?:
    number }` → `200 TripDay`.
  - `PATCH /trips/:id/days/:dayId/items/:itemId` — body `{ order?: number,
    tripDayId?: string }` (`tripDayId` presente = mover o item pra outro dia;
    **tem que pertencer à mesma trip** — `400`/`404` se não pertencer, decisão
    do dev qual dos dois, documentar) → `200 TripItem`.
  - Erro sempre `{ "error": "..." }`, mesmo padrão dos outros endpoints.
  - `web` (Wave 2) só é despachada depois que `api` (Wave 1) estiver
    `verified`/`merged`.

## Per-package scope

### qualroteiro/api
- **Scope:**
  - Adicionar os dois `PATCH` acima em `apps/api/src/routes/trips.ts` (ou
    onde os outros endpoints de trips já vivem), reusando o `TripStore`/
    `AuthVerifier` existentes de A2 — **não redesenhar o que já existe**, só
    estender.
  - Ownership: mesma disciplina de A2 — toda operação passa `userId`
    primeiro, `404` idêntico ao de recurso inexistente pra quem não é dono.
  - Validar com `@qualroteiro/trips` (mesmas funções de validação de `order`
    já existentes ali, se servirem — não duplicar lógica de validação que já
    existe no pacote de domínio).
  - Se `tripDayId` for passado num `PATCH` de item e não pertencer à mesma
    trip do item, recusar (não mover item entre trips diferentes).
  - **Não** tocar `apps/web`, `packages/*`, config de raiz.
- **Acceptance:**
  - `pnpm --filter @qualroteiro/api test/typecheck/lint` verdes.
  - Teste: `PATCH` de `order` num dia e num item persiste e reflete no `GET
    /trips/:id` seguinte.
  - Teste: mover item pra outro dia da mesma trip funciona; pra um dia de
    **outra** trip é recusado.
  - Teste: `PATCH` em recurso de outro usuário → `404`, corpo idêntico ao de
    id inexistente.
  - Teste: sem `Authorization` → `401`.
  - `git diff --name-only origin/dev..HEAD` só `apps/api/**`.
  - SDD: `aipe skill match --task-type feature --size medium`.

### qualroteiro/web
- **Scope:**
  - `core/api/trips.ts`: adicionar `updateTripDay(getToken, tripId, dayId,
    input)` e `updateTripItem(getToken, tripId, dayId, itemId, input)`
    chamando os `PATCH` acima, mesmo padrão de `request<T>` já usado.
  - `TripDetailScreen`: arrastar-e-soltar pra reordenar itens dentro de um
    dia, mover item pra outro dia, e reordenar os dias. **Biblioteca
    sugerida: `@dnd-kit/core` + `@dnd-kit/sortable`** (moderna, acessível,
    sem dependência de jQuery) — o dev pode escolher outra se justificar por
    que é melhor, documentar a escolha no SDD.
  - **Atualização otimista**: ao soltar, atualiza a UI imediatamente e chama
    o `PATCH` em paralelo; se a chamada falhar, desfaz a mudança visual e
    mostra uma mensagem de erro (não deixa a UI mentir sobre o estado real).
  - **Não** tocar `apps/api`, `packages/*`, config de raiz, nem os módulos
    `hospedagem`/`restaurantes`/`atividades`/`rota-custos`.
- **Acceptance:**
  - `pnpm --filter @qualroteiro/web build/typecheck/lint/test` verdes.
  - Teste: arrastar um item pra outra posição dentro do dia chama
    `updateTripItem` com a `order` certa.
  - Teste: arrastar um item pra outro dia chama `updateTripItem` com
    `tripDayId` novo.
  - Teste: se o `PATCH` falhar (mock de erro), a UI volta pro estado anterior
    e mostra o erro — não fica com uma ordem que não foi salva de verdade.
  - Teste: reordenar dias chama `updateTripDay` com a `order` certa.
  - `git diff --name-only origin/dev..HEAD` só `apps/web/**`.
  - SDD sdd-lite.

## Sequencing

- **Wave 1:** `qualroteiro/api` (dev: Pete Campbell) → QA Joan Holloway.
- **Wave 2:** `qualroteiro/web` (dev: Peggy Olson) → QA Stan Rizzo. Só abre com
  Wave 1 `verified`/`merged`.

## Per-unit dispatch envelopes

`aipe execution propose --journey j-20260915-bp`:

- **`qualroteiro/api`** — `subagent/claude-code/reasoning/normal` (cost-index
  4). Mesma razão de A2: superfície de ownership/dado persistido, decisão de
  design real (o que acontece se `tripDayId` não pertence à trip). Descartado
  `standard` — não é mecânico, tem julgamento de segurança/dado envolvido.

- **`qualroteiro/web`** — `subagent/claude-code/reasoning/normal` (cost-index
  4). Drag-and-drop com atualização otimista + rollback é design de estado
  real (não é forma+cálculo como F2b/c/d/e), primeira vez que o projeto usa
  uma lib de DnD. Descartado `standard`.

- **QAs** — `subagent/claude-code/standard/normal` (cost-index 2) cada:
  mecânico contra critério explícito.

## Out of scope

- Reordenar módulos dentro do registry (`moduleRegistry` não muda).
- Editar título/datas da viagem na UI (`PATCH /trips/:id` já existe na API,
  não ligado — pode virar outra unidade pequena se quiser).
- Undo/histórico de reordenação além do rollback em caso de erro de rede.
