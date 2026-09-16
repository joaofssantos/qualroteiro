# F2d Atividades — SDD

## Escopo

O módulo `atividades` é uma calculadora web standalone para estimar custo de uma
atividade (passeio, ingresso, tour) por pessoa. Ele não usa `apps/api`, pacote
novo de domínio, geocoding nem rede. Tela única, sem split/mapa — mesmo formato
de `hospedagem`.

## Contrato

- `calculateActivityCost(plan)` calcula `totalCost = pricePerPerson * people`.
- `people < 1` lança erro.
- `pricePerPerson < 0` lança erro defensivo para evitar custo negativo.
- `date` é opcional (ISO `YYYY-MM-DD` ou `null`) e não é validado por `calc.ts` —
  é apenas repassado no payload.
- Cálculo é ao vivo (sem submit, sem chamada de rede) conforme o usuário digita.

## Integração com Trips

Quando o usuário está logado, `SaveActivityToTripDialog` segue o mesmo fluxo do
Rota & Custos / Hospedagem:

- escolher viagem existente ou criar uma rápida;
- escolher dia existente ou criar um dia;
- chamar `createTripItem` com `moduleId: 'atividades'`, `kind: 'activity'`,
  `title = plan.placeName`, `payload = ActivityPlan`, `costEstimate = totalCost`.

Usuário deslogado continua usando a calculadora; o botão de salvar não aparece
(`if (!auth.isSignedIn) return null;`).

## Fora de escopo

- Geocoding/validação de endereço.
- Persistência de rascunho.
- Qualquer alteração em `apps/api`, `packages/*` ou config raiz.

## Aceite

- `calc.ts`: caso normal, `people < 1` lança, `pricePerPerson < 0` lança.
- Tela computa `totalCost` ao vivo (sem `fetch`).
- `SaveActivityToTripDialog`: logado salva com `costEstimate`/`payload`
  corretos; deslogado não renderiza a ação.
- `pnpm --filter @qualroteiro/web build/typecheck/lint/test` verdes.
