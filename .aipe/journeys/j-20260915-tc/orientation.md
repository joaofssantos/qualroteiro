# Orientation Spec — j-20260915-tc (F2d — Atividades, via Claude/AIPe)

> Escopo já negociado e publicado em `F2-COORDINATION.md` §10 (o mesmo brief
> que seria dado ao Codex) — o PE pediu pra esta unidade rodar no Claude em vez
> de Codex, pra paralelizar com F2b/F2c que já estão no Codex.

## Problem

F2d é o terceiro módulo standalone de F2 (depois de Hospedagem/F2b e
Restaurantes/F2c): "Atividades" — outro item de custo simples (preço/pessoa ×
pessoas) que o usuário registra e opcionalmente salva numa viagem. Mesma forma
de F2b/F2c, deliberadamente — não inventar diferenciação.

## Cross-package contracts

Unidade única, `qualroteiro/web`. **Nenhum contrato novo** — reusa
integralmente o que F2a já publicou (`@qualroteiro/trips` types, os endpoints
`/trips*` de `apps/api`, o padrão de "salvar na viagem" que
`SaveRouteToTripDialog.tsx` já estabeleceu).

**Risco de colisão de arquivo, não de contrato:** F2b e F2c (Codex, em
paralelo) também tocam `apps/web/src/modules/index.ts` (cada uma adiciona uma
linha registrando seu módulo). O coordenador resolve isso na hora do merge de
cada PR — não é um bloqueio de dispatch.

## Per-package scope

### qualroteiro/web
- **Scope:**
  - `apps/web/src/modules/atividades/calc.ts`:
    ```ts
    export interface ActivityPlan {
      readonly placeName: string;
      readonly address: string | null;
      readonly date: string | null;      // ISO date, opcional
      readonly pricePerPerson: number;
      readonly people: number;            // mínimo 1
    }
    export interface ActivityCost {
      readonly totalCost: number;         // pricePerPerson * people
    }
    export function calculateActivityCost(plan: ActivityPlan): ActivityCost
    ```
    Erro se `people < 1` ou `pricePerPerson < 0`.
  - Módulo `atividades`, mesmo padrão de `rota-custos`
    (`apps/web/src/modules/rota-custos/module.ts` +
    `apps/web/src/modules/index.ts`): tela única (nome, endereço opcional,
    data opcional, preço/pessoa, nº de pessoas) calculando `totalCost` ao vivo,
    sem rede, funciona sem login.
  - "Salvar na viagem": **mirror de
    `apps/web/src/modules/rota-custos/SaveRouteToTripDialog.tsx`** —
    mesmo fluxo (escolher/criar Trip, escolher/criar Day, `createTripItem`
    com `moduleId: 'atividades'`, `kind: 'activity'`, `payload` = o
    `ActivityPlan`, `costEstimate` = `totalCost`). Só aparece logado
    (`auth.isSignedIn`).
  - Reusa os componentes shadcn já existentes (`button`, `card`, `input`,
    `label`, `dialog`, `select`).
  - **Não** tocar `apps/api`, `packages/*`, config de raiz.
- **Acceptance:**
  - `pnpm --filter @qualroteiro/web build/typecheck/lint/test` verdes.
  - `calculateActivityCost`: teste normal + `people < 1` (erro) +
    `pricePerPerson < 0` (erro).
  - Módulo calcula ao vivo sem submeter, sem chamada de rede.
  - Logado: "salvar na viagem" cria/usa Trip+Day, chama `createTripItem` com o
    payload certo — teste espelhando
    `SaveRouteToTripDialog.test.tsx` (inclusive o caso deslogado, onde a ação
    de salvar não aparece).
  - Diff só em `apps/web/**`.
  - SDD sdd-lite commitado.

## Sequencing

- **Wave 1 (única):** `qualroteiro/web` (dev: Peggy Olson) → QA Stan Rizzo.

## Per-unit dispatch envelopes

`aipe execution propose --journey j-20260915-tc` — `subagent/claude-code/standard/normal`
(cost-index 2): mecânico, espelha F2b/F2c e o padrão já estabelecido do
`SaveRouteToTripDialog` — sem julgamento arquitetural novo. `--size small` →
sdd-lite.

## Out of scope

- F2b (Hospedagem) e F2c (Restaurantes) — rodando em paralelo no Codex.
- F2e (Roteiro/timeline) — aguarda pelo menos uma de b/c/d mergeada.
- Qualquer diferenciação de campo entre `atividades` e `restaurantes` que não
  seja o nome/rótulo — a forma do custo é a mesma de propósito.
