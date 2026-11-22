# QA de design — PR #66, layouts A/B

Veredito: **APROVADO COM RESSALVAS** após as correções documentais desta branch.

## Evidência verificada

- O mapa é montado atualmente por `AppShell` e recebe `layers`/`trace` do
  `mapStore` (`apps/web/src/core/shell/AppShell.tsx:169-179`); o store só
  contém estado de apresentação (`apps/web/src/core/map/mapStore.ts:37-64`).
- A consulta ainda guarda origem, destino, paradas e veículo em `useState`
  local (`apps/web/src/modules/rota-custos/NewQueryScreen.tsx:86-89`). Trocar
  o componente de shell sem elevar esse estado desmontaria o rascunho.
- O cliente já aceita `AbortSignal` e chama `POST /api/routes/plan`
  (`apps/web/src/core/api/client.ts:83-108`), porém a rota Fastify não tem
  limitador (`apps/api/src/routes/plan.ts:173-208`).
- A PR #65 expõe `tolls.unavailablePlazaIds`; este campo torna o total um
  limite inferior quando não está vazio. O plano agora exige sinalização de
  tarifa indisponível no hero/total e dependência explícita da PR #65.

As alterações do plano definem o `routeDraftStore`, mantêm o único
`MapCanvas` acima do shell lazy, incluem `resize()` no reposicionamento do
mapa, ordenam F2→F8→F9, e condicionam a prévia em produção a rate limit,
`429`/`Retry-After` e métrica. A estratégia de repetição da suíte foi
ajustada para comparar assinaturas contra a baseline instável existente.
