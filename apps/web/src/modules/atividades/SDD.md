# F2d Atividades — SDD

## Escopo

O módulo `atividades` é uma calculadora web standalone para estimar custo de uma
atividade (passeio, ingresso, tour) por pessoa. A calculadora continua
standalone, mas o usuário também pode procurar atividades reais perto de um
ponto de referência resolvido pelo autocomplete. A busca usa
`GET /places/nearby` e publica os resultados no mapa persistente compartilhado.

## Contrato

- `calculateActivityCost(plan)` calcula `totalCost = pricePerPerson * people`.
- `people < 1` lança erro.
- `pricePerPerson < 0` lança erro defensivo para evitar custo negativo.
- `date` é opcional (ISO `YYYY-MM-DD` ou `null`) e não é validado por `calc.ts` —
  é apenas repassado no payload.
- Cálculo é ao vivo (sem submit, sem chamada de rede) conforme o usuário digita.
- `PlaceSearch` resolve cidade, bairro ou endereço em coordenadas; só então
  `searchNearbyPlaces(lat, lng, 'atividades')` é chamado.
- Cada resultado da busca aparece na lista e em uma camada `atividade-lugares`
  do mapa. Selecionar pela lista ou pelo marcador preenche `placeName`,
  `address` e a coordenada (`lat`/`lng`); preço, data e pessoas seguem
  manuais. Editar o endereço manualmente depois de uma seleção — ou nunca
  selecionar um resultado de busca — mantém `lat`/`lng` em `null`: nunca
  inventamos coordenada por geocoding reverso ou heurística.
- Loading, lista vazia e indisponibilidade do backend são estados explícitos.
  Em uma falha, a calculadora manual permanece editável.
- O módulo chama `clearMap()` no unmount para não deixar marcadores no próximo
  módulo que o usuário visitar.
- `NearbySearchControls` (`@/core/components/NearbySearchControls`, compartilhado com
  Hospedagem/Restaurantes) adiciona um `<Select>` de raio (1/3/5/10/20 km, default 3 km) e
  chips de tipo (multi-seleção, `PLACE_TYPE_OPTIONS.atividades` — 8 tipos curados, mesmos
  valores de `PLACE_TYPE_ALLOWLIST.atividades` em `apps/api`). Nenhum chip selecionado mantém
  o tipo-base `tourist_attraction`; um ou mais chips substituem-no. Mudar o raio ou os tipos
  re-dispara `searchNearbyPlaces()` automaticamente (mesmo `useEffect` que já reage a
  `reference.place`), sem exigir um novo clique em buscar.

## Integração com Trips

Quando o usuário está logado, `SaveActivityToTripDialog` segue o mesmo fluxo do
Rota & Custos / Hospedagem:

- escolher viagem existente ou criar uma rápida;
- escolher dia existente ou criar um dia;
- chamar `createTripItem` com `moduleId: 'atividades'`, `kind: 'activity'`,
  `title = plan.placeName`, `payload = ActivityPlan` (já inclui `lat`/`lng`,
  `null` quando não vieram de uma seleção de busca), `costEstimate = totalCost`.

Usuário deslogado continua usando a calculadora; o botão de salvar não aparece
(`if (!auth.isSignedIn) return null;`).

## Fora de escopo

- Usar automaticamente o destino de uma viagem salva como referência.
- Place Details (foto, telefone ou horário).
- Persistência de rascunho.
- Qualquer alteração em `apps/api`, `packages/*` ou config raiz.

## Aceite

- `calc.ts`: caso normal, `people < 1` lança, `pricePerPerson < 0` lança.
- Tela computa `totalCost` ao vivo (sem `fetch`).
- Busca próxima envia as coordenadas escolhidas e `category=atividades`, mostra
  lista e marcadores, e ambos os caminhos de seleção preenchem o formulário.
- Selecionar um resultado de busca preenche `lat`/`lng` no `ActivityPlan`;
  editar manualmente sem selecionar mantém ambos `null`; salvar na viagem
  persiste os dois campos no payload enviado a `createTripItem`.
- Falha ou lista vazia não impede o cálculo manual; o unmount limpa a store de
  mapa com assert direto em `useMapStore.getState()`.
- `SaveActivityToTripDialog`: logado salva com `costEstimate`/`payload`
  corretos; deslogado não renderiza a ação.
- Mudar o raio no `<Select>` reenvia `radiusMeters` atualizado; marcar/desmarcar
  chips de tipo reenvia `types` (ou o omite quando nenhum chip está marcado).
- `pnpm --filter @qualroteiro/web build/typecheck/lint/test` verdes.
