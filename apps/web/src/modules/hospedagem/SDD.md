# F2b Hospedagem — SDD

## Escopo

O módulo `hospedagem` é uma calculadora web standalone para estimar custo de estadia. Ele não usa `apps/api`, pacote novo de domínio, geocoding nem rede.

Além do preenchimento manual, o usuário pode escolher uma referência no `PlaceSearch` e consultar
`GET /places/nearby` na categoria fixa `hospedagem`. Os resultados aparecem em lista e na camada
compartilhada do mapa; escolher um deles, pela lista ou marcador, preenche nome e endereço sem
alterar o cálculo. Falha ou lista vazia não bloqueia a calculadora. Ao desmontar, o módulo chama
`clearMap()` para não deixar marcadores no próximo módulo.

## Contrato

- `calculateLodgingCost(stay)` calcula `nights` pela diferença entre `checkIn` e `checkOut`, em datas ISO `YYYY-MM-DD`.
- `checkOut <= checkIn` lança erro.
- `pricePerNight < 0` lança erro defensivo para evitar custo negativo.
- `totalCost = nights * pricePerNight`.

## Integração com Trips

Quando o usuário está logado, `SaveStayToTripDialog` segue o mesmo fluxo do Rota & Custos:

- escolher viagem existente ou criar uma rápida;
- escolher dia existente ou criar um dia;
- chamar `createTripItem` com `moduleId: 'hospedagem'`, `kind: 'stay'`, `title = placeName`, `payload = LodgingStay`, `costEstimate = totalCost`.

Usuário deslogado continua usando a calculadora; o botão de salvar não aparece.
