# Evidências — Restaurantes: busca real e mapa (G4)

## Cobertura

- `client.test.ts` verifica URL, categoria, raio opcional e `AbortSignal` de
  `searchNearbyPlaces`.
- `restaurantes.test.tsx` resolve São Paulo pelo `PlaceSearch`, confirma a
  chamada a `/places/nearby?lat=-23.5505&lng=-46.6333&category=restaurantes`,
  verifica os markers publicados e testa seleção via lista e callback do mapa.
- O mesmo arquivo cobre erro `502` mantendo `calculateRestaurantCost` utilizável
  e faz o assert direto na `useMapStore.getState()` após unmount.

## Verificação

Executar a partir da raiz:

```sh
pnpm build
pnpm --filter @qualroteiro/web typecheck
pnpm --filter @qualroteiro/web lint
pnpm --filter @qualroteiro/web test
```

Executado nesta branch com sucesso: `pnpm build` (7 pacotes), `typecheck`,
`lint` e a suíte do web (22 arquivos, 118 testes). O Vitest emite apenas os
avisos já existentes de future flags do React Router.
