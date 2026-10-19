# Orientation Spec — j-20260915-61 (F2e — Roteiro: remover item + exibição rica)

> PE aprovou o recorte (2026-09-16): fecha com remover item/dia + exibição rica
> por módulo, ambos já 100% `apps/web`. Reordenar (drag-and-drop) fica pra uma
> jornada separada (F2f) por mexer em contrato de API.

## Problem

O `TripDetailScreen` (módulo `planejamento-viagem`, de F2a) já agrupa itens por
dia e mostra orçamento consolidado — descoberto ao revisar antes de decompor
F2e. Falta: (1) remover item/dia da UI (a API já tem `DELETE`, só não está
ligada), (2) cada item hoje mostra texto cru (`moduleId · kind`) em vez de um
resumo específico do módulo (ex. datas da hospedagem, pessoas do restaurante).

## Cross-package contracts

Unidade única, `qualroteiro/web`. **Nenhum contrato de API novo** — usa
`DELETE /trips/:id/days/:dayId/items/:itemId` que já existe (só falta a
função `deleteTripItem` no client `core/api/trips.ts`, que hoje só tem
list/create/get, sem nenhuma função de delete).

## Per-package scope

### qualroteiro/web
- **Scope:**
  1. **`core/api/trips.ts`**: adicionar
     `deleteTripItem(getToken, tripId, dayId, itemId): Promise<void>`
     (`DELETE /trips/:id/days/:dayId/items/:itemId`, mesmo padrão de
     `request<T>` já usado pelas outras funções, `204` vira `undefined`).
  2. **`TripDetailScreen`** (`modules/planejamento-viagem/index.tsx`):
     botão de remover por item (ícone `Trash2` do lucide, com confirmação leve
     — não precisa de modal, um `window.confirm` é aceitável aqui já que é
     ação destrutiva simples) chamando `deleteTripItem` e recarregando a
     viagem (`getTrip`) pra refletir a remoção e o orçamento atualizado.
  3. **Exibição rica por item** — trocar a linha `{item.moduleId} · {item.kind}`
     por um resumo específico, lendo `item.payload` com checagem de tipo em
     runtime (não um cast cego — `payload` é `unknown` de propósito):
     - `moduleId === 'rota-custos'`: usar `item.title` como está (já carrega
       "Origem → Destino") + opcionalmente `distanceKm`/`durationMin` do
       payload se a forma bater.
     - `moduleId === 'hospedagem'`: ler `checkIn`/`checkOut`/`pricePerNight` do
       payload (mesma forma de `LodgingStay` em
       `modules/hospedagem/calc.ts`) → algo como "3 noites · R$150/noite".
     - `moduleId === 'restaurantes'` / `'atividades'`: ler `people`/
       `pricePerPerson` do payload (mesma forma de `RestaurantVisit`/
       `ActivityPlan`) → "4 pessoas · R$80/pessoa".
     - **Qualquer `moduleId` desconhecido** (módulo futuro, ex. `frete`):
       cai de volta pro texto cru atual (`moduleId · kind`) — nunca quebrar
       nem esconder o item. `moduleId` é livre de propósito (decisão de A2),
       essa unidade não pode assumir que só existem os 4 módulos de hoje.
  4. **Não** tocar `apps/api`, `packages/*`, config de raiz, nem os módulos
     `hospedagem`/`restaurantes`/`atividades`/`rota-custos` em si (só o jeito
     como `planejamento-viagem` lê o payload deles).
- **Acceptance:**
  - `pnpm --filter @qualroteiro/web build/typecheck/lint/test` verdes.
  - Teste: clicar em remover chama `deleteTripItem` com os ids certos e a tela
    recarrega sem o item (e o orçamento total cai de acordo).
  - Teste: um item `moduleId: 'hospedagem'` com payload de `LodgingStay`
    mostra o resumo de noites/preço, não o texto cru.
  - Teste: um item com `moduleId` desconhecido (ex. `'frete'`) não quebra a
    tela — cai no fallback de texto cru.
  - Diff só em `apps/web/**`.
  - SDD sdd-lite commitado.

## Sequencing

- **Wave 1 (única):** `qualroteiro/web` (dev: Peggy Olson) → QA Stan Rizzo.

## Per-unit dispatch envelopes

`aipe execution propose --journey j-20260915-61` — `subagent/claude-code/standard/normal`
(cost-index 2): mecânico contra padrão já estabelecido (lê payloads cujas
formas já existem nos módulos irmãos), sem arquitetura nova. `--size small`.

## Out of scope

- Reordenar dias/itens (drag-and-drop) — F2f, precisa de PATCH novo na API.
- Editar título/datas da viagem na UI (API já tem `PATCH /trips/:id`, não
  ligado — pode entrar em F2f também).
- Qualquer mudança nos módulos `hospedagem`/`restaurantes`/`atividades`/
  `rota-custos` além de como seus payloads são lidos por esta unidade.
