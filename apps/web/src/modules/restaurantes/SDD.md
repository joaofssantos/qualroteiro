# F2c Restaurantes — SDD

## Escopo

O módulo `restaurantes` é uma calculadora web standalone para estimar o custo de uma
refeição por pessoa. Além do preenchimento manual, o usuário pode escolher uma
referência no `PlaceSearch` e consultar `GET /places/nearby` na categoria fixa
`restaurantes`. Os resultados aparecem em lista e na camada compartilhada do mapa
(`restaurant-results`); escolher um deles, pela lista ou pelo marcador, preenche
nome, endereço e coordenada (`lat`/`lng`) sem alterar o cálculo. Editar o endereço
manualmente depois de uma seleção — ou nunca selecionar um resultado de busca —
mantém `lat`/`lng` em `null`: nunca inventamos coordenada por geocoding reverso ou
heurística. Falha ou lista vazia não bloqueia a calculadora. Ao desmontar, o módulo
chama `clearMap()` para não deixar marcadores no próximo módulo.

### Raio configurável e filtro de tipo (j-20260917-qv, Wave 2)

O card "Buscar perto de" tem `NearbySearchControls` (`@/core/components/NearbySearchControls`,
compartilhado com Hospedagem/Atividades): um `<Select>` de raio (marcos 1/3/5/10/20 km,
`RADIUS_OPTIONS` em `@/core/api/placeTypes.ts`, default 3 km — o mesmo default do backend) e
chips de tipo (multi-seleção, `PLACE_TYPE_OPTIONS.restaurantes` — 8 tipos curados, mesmos
valores de `PLACE_TYPE_ALLOWLIST.restaurantes` em `apps/api`). Nenhum chip selecionado mantém
o comportamento de hoje (tipo-base `restaurant`, sem enviar `types`); um ou mais chips
substituem (não somam) o tipo-base.

Mudar o raio ou os tipos selecionados re-dispara a busca automaticamente — ambos entram na
dependência do mesmo `useEffect` que já reage a `reference.place`, sem exigir um clique extra
em "buscar". `radiusMeters` e `types` vão para `searchNearbyPlaces()` a cada busca.

Este controle não interfere no comportamento de esconder a lista quando `selectedPlaceId !== null`
(PR #46) nem na propagação de `lat`/`lng` do lugar selecionado (`j-20260917-up` Wave 1) — nenhum
dos dois estados é tocado por esta mudança.

## Contrato

- `calculateRestaurantCost(visit)` calcula `totalCost = pricePerPerson * people`.
- `people < 1` lança erro.
- `pricePerPerson < 0` lança erro defensivo para evitar custo negativo.
- `date` é opcional (ISO `YYYY-MM-DD` ou `null`) e não é validado por `calc.ts` —
  é apenas repassado no payload.
- Cálculo é ao vivo (sem submit, sem chamada de rede) conforme o usuário digita.

## Integração com Trips

Quando o usuário está logado, `SaveRestaurantToTripDialog` segue o mesmo fluxo do
Rota & Custos / Hospedagem / Atividades:

- escolher viagem existente ou criar uma rápida;
- escolher dia existente ou criar um dia;
- chamar `createTripItem` com `moduleId: 'restaurantes'`, `kind: 'meal'`,
  `title = visit.placeName`, `payload = RestaurantVisit` (já inclui `lat`/`lng`,
  `null` quando não vieram de uma seleção de busca), `costEstimate = totalCost`.

Usuário deslogado continua usando a calculadora; o botão de salvar não aparece.

## Fora de escopo

- Usar automaticamente o destino de uma viagem salva como referência.
- Place Details (foto, telefone ou horário).
- Persistência de rascunho ou da preferência de raio/tipo entre buscas.
- Qualquer alteração em `apps/api`, `packages/*` ou config raiz.

## Aceite

- `calc.ts`: caso normal, `people < 1` lança, `pricePerPerson < 0` lança.
- Tela computa `totalCost` ao vivo (sem `fetch`).
- Busca próxima envia as coordenadas escolhidas, `category=restaurantes` e o raio
  atual (default 3000m), mostra lista e marcadores, e ambos os caminhos de seleção
  preenchem o formulário.
- Selecionar um resultado de busca preenche `lat`/`lng` no `RestaurantVisit`;
  editar manualmente sem selecionar mantém ambos `null`; salvar na viagem persiste
  os dois campos no payload enviado a `createTripItem`.
- Mudar o raio no `<Select>` reenvia `radiusMeters` atualizado; marcar/desmarcar
  chips de tipo reenvia `types` (ou o omite quando nenhum chip está marcado).
- Falha ou lista vazia não impede o cálculo manual; o unmount limpa a store de mapa.
- `SaveRestaurantToTripDialog`: logado salva com `costEstimate`/`payload` corretos;
  deslogado não renderiza a ação.
- `pnpm --filter @qualroteiro/web build/typecheck/lint/test` verdes.
