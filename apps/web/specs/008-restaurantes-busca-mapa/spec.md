# sdd-lite — Restaurantes: busca real e mapa (G4)

## Problema

O módulo Restaurantes permitia apenas o preenchimento manual. O usuário não
conseguia encontrar estabelecimentos reais perto de uma cidade, bairro ou
endereço, nem vê-los no mapa compartilhado já disponível no shell.

## Escopo

- `searchNearbyPlaces` chama `GET /places/nearby` com coordenadas resolvidas,
  categoria e raio opcional, retornando o contrato `PlaceResult` do G1.
- Restaurantes reutiliza `PlaceSearch` para resolver “Buscar perto de”, exibe
  loading, vazio, erro amigável e uma lista dos resultados.
- A lista publica uma camada `restaurant-results` no `mapStore`; clicar na
  lista ou em um marcador seleciona o mesmo resultado e preenche os campos
  existentes `placeName` e `address`.
- `restaurantesModule` declara `showMap: true`; no unmount, o painel limpa o
  `mapStore` completo.

## Fora de escopo

- Alterar o formulário/cálculo de custo, criar Place Details ou integrar uma
  viagem já salva como referência de busca.
- Alterar `PlaceSearch`, `MapCanvas`, API ou pacotes compartilhados.

## Aceite

- A busca usa `category=restaurantes` e as coordenadas do `PlaceSearch`.
- Seleção por lista e por marcador preenche nome e endereço.
- Falha de busca não impede o cálculo manual.
- Sem busca, o cálculo preserva o comportamento existente.
- Após unmount, `useMapStore.getState()` tem `layers: []`, `trace: null` e
  `onMarkerClick: undefined`.
