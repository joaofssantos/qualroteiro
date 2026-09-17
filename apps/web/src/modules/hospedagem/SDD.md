# F2b Hospedagem — SDD

## Escopo

O módulo `hospedagem` é uma calculadora web standalone para estimar custo de estadia. Ele não usa `apps/api`, pacote novo de domínio, geocoding nem rede.

Além do preenchimento manual, o usuário pode escolher uma referência no `PlaceSearch` e consultar
`GET /places/nearby` na categoria fixa `hospedagem`. Os resultados aparecem em lista e na camada
compartilhada do mapa; escolher um deles, pela lista ou marcador, preenche nome, endereço e
coordenada (`lat`/`lng`) sem alterar o cálculo. Editar o endereço manualmente depois de uma
seleção — ou nunca selecionar um resultado de busca — mantém `lat`/`lng` em `null`: nunca
inventamos coordenada por geocoding reverso ou heurística. Falha ou lista vazia não bloqueia a
calculadora. Ao desmontar, o módulo chama `clearMap()` para não deixar marcadores no próximo
módulo.

### Raio configurável e filtro de tipo (j-20260917-qv, Wave 2)

O card "Buscar perto de" ganhou `NearbySearchControls` (`@/core/components/NearbySearchControls`,
compartilhado com Restaurantes/Atividades): um `<Select>` de raio (marcos 1/3/5/10/20 km,
`RADIUS_OPTIONS` em `@/core/api/placeTypes.ts`, default 3 km — o mesmo default do backend) e chips
de tipo (multi-seleção, lista curada de 6 tipos de `PLACE_TYPE_OPTIONS.hospedagem`, mesmos valores
do `PLACE_TYPE_ALLOWLIST.hospedagem` de `apps/api`). Nenhum chip selecionado mantém o comportamento
de hoje (tipo-base `lodging`, sem enviar `types`); um ou mais chips substituem (não somam) o tipo-base.

Mudar o raio ou os tipos selecionados **re-dispara a busca automaticamente** — ambos entram na
dependência do mesmo `useEffect` que já reage a `reference.place`, o mesmo padrão do efeito
existente, sem exigir um clique extra em "buscar". `radiusMeters` e `types` vão para
`searchNearbyPlaces()` a cada busca.

Este controle não interfere no comportamento de esconder a lista quando `selectedPlaceId !== null`
(PR #46) nem na propagação de `lat`/`lng` do lugar selecionado (`j-20260917-up` Wave 1) — nenhum dos
dois estados é tocado por esta mudança.

## Contrato

- `calculateLodgingCost(stay)` calcula `nights` pela diferença entre `checkIn` e `checkOut`, em datas ISO `YYYY-MM-DD`.
- `checkOut <= checkIn` lança erro.
- `pricePerNight < 0` lança erro defensivo para evitar custo negativo.
- `totalCost = nights * pricePerNight`.

## Integração com Trips

Quando o usuário está logado, `SaveStayToTripDialog` segue o mesmo fluxo do Rota & Custos:

- escolher viagem existente ou criar uma rápida;
- escolher dia existente ou criar um dia;
- chamar `createTripItem` com `moduleId: 'hospedagem'`, `kind: 'stay'`, `title = placeName`, `payload = LodgingStay` (já inclui `lat`/`lng`, `null` quando não vieram de uma seleção de busca), `costEstimate = totalCost`.

Usuário deslogado continua usando a calculadora; o botão de salvar não aparece.
