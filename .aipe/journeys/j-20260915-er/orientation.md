# Orientation Spec — j-20260915-er (T2 — ativar roterização real)

> PE forneceu `ORS_API_KEY` (2026-09-15), confirmada em
> `repos/qualroteiro/apps/api/.env` (não lida/exibida pelo coordenador).

## Problem

`apps/api/src/providers/ors-routing.ts` é um adapter OpenRouteService real e
correto — parseia a geometria de estrada completa retornada pela API — mas
**nunca foi exercitado contra o serviço real** (sem `ORS_API_KEY` no ambiente).
Todos os testes usam fakes. T2 do `F1-COORDINATION.md`: rodar a **primeira
chamada real**, provar que o adapter funciona contra o vendor de verdade, e
corrigir o que essa chamada revelar.

## Cross-package contracts

Unidade única — `qualroteiro/api`. Nenhuma mudança de contrato **esperada**: o
shape de `PlannedRoute`/`Place` já está fixado em
`apps/api/specs/002-rota-custos-api/spec.md`, consumido por `apps/web`. Se a
chamada real revelar que o shape precisa mudar, **parar e escalar pro PE** —
não mudar o contrato sem aprovação (WAVE 3 do F1 já está construída contra ele).

## Per-package scope

### qualroteiro/api
- **Scope:**
  - Subir o `apps/api` localmente com a `ORS_API_KEY` já presente em
    `apps/api/.env` (não commitada — está no `.gitignore`).
  - Rodar `POST /routes/plan` de verdade: origem "São Paulo, SP", destino "Rio
    de Janeiro, RJ", veículo `{ type: "car", axleCategory: "car",
    consumptionKmPerL: 10 }`, `fuelPricePerL: 6`. Capturar a resposta completa
    como evidência (sem incluir a API key em nenhum log/output commitado).
  - Rodar também `GET /places/search?q=São Paulo` de verdade.
  - Corrigir o que a chamada real revelar: nome de campo divergente do
    documentado pela ORS, `profile` (`driving-car`/`driving-hgv`) incorreto,
    `alternative_routes` rejeitado/aceito diferente do esperado (o `D-107` no
    código já lida com rejeição via retry — confirmar que funciona de verdade),
    timeout, rate limit. Ajustes **dentro do comportamento já especificado** —
    não é permissão pra redesenhar o adapter.
  - Se a resposta real tiver um shape que quebra algum teste existente (os 34
    testes com fake devem continuar passando — o fake deve continuar
    representando fielmente o real), ajustar o fake pra bater com a realidade
    observada, com um teste que prove a divergência que foi corrigida.
  - **Não** commitar a `ORS_API_KEY` em lugar nenhum. `.env` já está gitignored
    — confirmar antes de qualquer commit (`git status` não deve listar `.env`).
- **Acceptance:**
  - `pnpm --filter @qualroteiro/api test/typecheck/lint` continuam verdes (os
    testes existentes usam fake, não a rede — não podem depender de rede pra
    passar em CI).
  - **Evidência de uma chamada real** documentada no PR/SDD: request + response
    (truncada se grande) do `POST /routes/plan` e do `GET /places/search`
    contra o ORS de verdade, mostrando geometria de estrada real (muitos
    pontos, não os 8 do seed antigo nem a reta).
  - Qualquer correção feita por causa da chamada real vem com um teste que a
    prova (RED antes, GREEN depois).
  - `git diff` não introduz `.env` nem qualquer segredo. `git diff --name-only`
    só mostra `apps/api/**`.
  - Se nada precisar de correção (adapter já está certo), o PR ainda documenta
    a evidência da chamada real — isso sozinho já é o valor de T2.
  - SDD: `aipe skill match --task-type feature --size small` (ou `medium` se
    a chamada real exigir mudanças reais — o dev decide e justifica).

## Sequencing

- **Wave 1:** `qualroteiro/api` (dev: Pete Campbell) → QA Joan Holloway.

Onda única. Roda em paralelo a T4/T5 (pacotes/fila distintos — `apps/api` estava
ocupado por T5-Wave1, já mergeado; agora livre).

## Per-unit dispatch envelopes

`aipe execution propose --journey j-20260915-er` — `subagent/claude-code/standard/normal`
(cost-index 2): exercitar um adapter já escrito contra um serviço real e corrigir
divergências pontuais é mecânico contra um alvo conhecido (o contrato já
existe); não é design novo. QA no mesmo envelope.

## Out of scope

- Mudar o shape do contrato HTTP sem aprovação do PE.
- Ativar Valhalla self-host (fica pra depois, conforme o ADR).
- CI usar a `ORS_API_KEY` (os testes de CI seguem com fake — sem segredo no
  pipeline nesta jornada).
- Trocar de provider.
