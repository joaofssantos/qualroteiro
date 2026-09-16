# F2f Planejamento de Viagem — reordenar timeline — SDD

## Escopo

`TripDetailScreen` passa a permitir reordenar dias e itens salvos usando
`@dnd-kit`. A mudança é otimista: a UI muda imediatamente no drop, persiste via
PATCH e volta ao snapshot anterior se a API recusar.

## Contrato

`core/api/trips.ts` adiciona:

```ts
updateTripDay(getToken, tripId, dayId, { date?, order? }): Promise<TripDay>
updateTripItem(getToken, tripId, dayId, itemId, { order?, tripDayId? }): Promise<TripItem>
```

Rotas:

- `PATCH /trips/:id/days/:dayId`
- `PATCH /trips/:id/days/:dayId/items/:itemId`

Para mover item entre dias, a URL usa o dia de origem e o body leva o
`tripDayId` destino.

## UI

- Dias e itens têm handles com `GripVertical`.
- Reordenar dias persiste a nova `order` dos dias afetados.
- Reordenar itens persiste a nova `order`; mover entre dias também persiste o
  novo `tripDayId`.
- Erro de ação aparece inline, sem transformar a tela em erro fatal.

## Testes

- Client PATCH de dia e item.
- Item reordenado dentro do mesmo dia chama `updateTripItem` com `order`.
- Item movido para outro dia chama `updateTripItem` com `tripDayId`.
- Falha no PATCH faz rollback visual e mostra erro.
- Dia reordenado chama `updateTripDay` com a nova `order`.
