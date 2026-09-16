# F2e Planejamento de Viagem — delete item + rich display — SDD

## Escopo

`TripDetailScreen` (em `index.tsx`) ganha duas capacidades sobre itens já salvos de
qualquer módulo (`rota-custos`, `hospedagem`, `restaurantes`, `atividades`, e
módulos futuros de `moduleId` livre):

1. **Excluir um item** de um dia da viagem, recarregando a viagem em seguida para
   que a lista e o total do orçamento reflitam a remoção.
2. **Resumo por módulo**, substituindo o texto cru `{item.moduleId} · {item.kind}`
   por uma descrição legível quando o `payload` do item permite.

Não toca em `apps/api`, `packages/*`, nem nos módulos `hospedagem` /
`restaurantes` / `atividades` / `rota-custos` — apenas como
`planejamento-viagem` lê os payloads já salvos por eles.

## Contrato

### `deleteTripItem` (`core/api/trips.ts`)

```ts
deleteTripItem(getToken, tripId, dayId, itemId): Promise<void>
```

`DELETE /trips/:tripId/days/:dayId/items/:itemId`, mesmo estilo de
`createTripItem`/`getTrip` (usa o `request<T>` helper existente; `204` vira
`undefined`).

### Exclusão na UI

- Botão de ícone (`Trash2`) por item, com `window.confirm(...)` como guarda —
  aceitável para uma ação destrutiva simples, sem necessidade de um componente
  de diálogo dedicado.
- Ao confirmar: chama `deleteTripItem(auth.getToken, trip.id, day.id, item.id)`
  e então `getTrip` de novo para recarregar a viagem inteira (lista de itens e
  total do orçamento, que é derivado de `trip.days`, ficam consistentes sem
  lógica de remoção otimista local).
- Erros de exclusão reusam o mesmo padrão de `error` state já usado no
  carregamento da tela.

### `describeTripItem(item: TripItem): string`

Função pura, sem *casts* (`as`) sobre `unknown` sem *guard* — cada ramo faz
*narrowing* explícito checando presença e `typeof` dos campos antes de ler:

- `moduleId === 'rota-custos'`: usa `item.title` (já é o rótulo humano, ex.
  "São Paulo → Rio de Janeiro"); se o payload tiver `distanceKm`/`durationMin`
  numéricos, acrescenta `· 429,7 km · 5 h 43 min` usando `formatKm`/
  `formatDuration`.
- `moduleId === 'hospedagem'`: se o payload tiver `checkIn`/`checkOut`
  (strings ISO) e `pricePerNight` numérico, mostra `"N noites · R$X/noite"`
  (noites computadas por diferença de datas, sem repetir a lógica de
  `calc.ts` — é só apresentação).
- `moduleId === 'restaurantes'` ou `'atividades'`: se o payload tiver `people`
  e `pricePerPerson` numéricos, mostra `"N pessoas · R$X/pessoa"`.
- Qualquer outro `moduleId`, ou payload que não faz *narrow* de forma limpa:
  cai no texto cru `"{item.moduleId} · {item.kind}"` — nunca lança, nunca
  esconde o item.

## Testes

- `deleteTripItem` chamado com `tripId`/`dayId`/`itemId` corretos; após
  resolver, o item some da lista e o total do orçamento é recalculado (mock da
  segunda chamada de `getTrip` retorna a viagem sem o item).
- Item `moduleId: 'hospedagem'` com payload `LodgingStay`-shaped renderiza o
  resumo de noites/preço, não o texto cru.
- Item com `moduleId` desconhecido (ex. `'frete'`) renderiza sem lançar,
  caindo no texto cru.
