# sdd-lite — Planejamento de Viagem: mapa da viagem + reabrir rota (j-20260917-up Wave 3)

## Problema

`TripDetailScreen` listava os itens salvos de uma viagem (Hospedagem, Rota &
Custos, Restaurantes, Atividades) só como texto — sem o padrão 80/20
mapa+conteúdo já usado pelos outros quatro módulos, e sem nenhuma forma de
voltar a ver uma rota salva sem recalculá-la do zero. Wave 1 (deste journey)
passou a salvar `lat`/`lng` por item; Wave 2 passou a salvar a `query` junto
da rota e adicionou `routeStore.restoreRoute(route, query)`. Esta unidade é a
última da jornada: consome as duas.

## Escopo

1. `planejamentoViagemModule` declara `showMap: true` — o módulo inteiro (Tela
   de lista e Tela de detalhe) herda o split 80/20 do shell, como todo módulo
   `showMap: true` já faz (não existe `showMap` por rota — ver
   `docs/decisions/0002-ui-shell-theme-and-map-layout.md`). Na lista, o mapa
   fica na visão nacional padrão até abrir uma viagem; o foco desta unidade é
   a tela de detalhe.
2. `tripItemGeo.ts` (novo): `extractTripItemCoordinate(item)` extrai
   `lat`/`lng` por `moduleId`, mesma disciplina de `describeTripItem.ts`
   (presença + `typeof`, sem `as`, nunca lança):
   - `hospedagem`/`restaurantes`/`atividades`: `payload.lat`/`payload.lng`
     (campo plano, já existe desde Wave 1).
   - `rota-custos`: o payload não tem `lat`/`lng` plano — o ponto natural é a
     origem da `query` salva (Wave 2). Só é pinado quando a rota tem uma
     `query` salva **e** essa origem foi geocodificada (`LngLat`, não uma
     string livre) — a mesma condição que permite reabri-la (item 4).
   - Item sem coordenada (busca manual, ou payload salvo antes da Wave 1)
     simplesmente não aparece no mapa — sem erro, sem pin fantasma.
3. `TripDetailScreen` monta um `MapLayerData` com um marcador por item de
   **todos os dias** da viagem atual (não só o dia em foco) e publica via
   `mapStore.setMapLayers`; limpa no unmount (`clearMap()`), mesmo contrato
   dos outros quatro módulos.
4. `tripItemGeo.ts`: `extractSavedRoute(item)` extrai `{ route, query }` de um
   item `moduleId === 'rota-custos'` cujo payload tem uma `query` válida —
   `route` é o payload **sem** a chave `query` (exatamente o shape que
   `/routes/plan` devolveria, não isso mais uma chave solta). Um item assim
   ganha um botão "Reabrir rota" (`aria-label="Reabrir rota {título}"`) na
   lista: clicar chama `routeStore.restoreRoute(route, query)` e navega para
   `/rota-custos/resultado`.
5. Item de rota **sem** `query` salva (Wave 1/pré-Wave 2) — narrado
   normalmente pela lista (`describeTripItem` já cobria esse caso), só sem o
   botão "Reabrir rota". Escolha: omitir o affordance por completo em vez de
   um botão desabilitado com tooltip — não há nada de errado a explicar,
   só uma capacidade que esse item específico não tem.

## Fora de escopo

- Reabrir uma tela de **edição** de Hospedagem/Restaurantes/Atividades a
  partir de um item salvo — só o pin no mapa conta para esses três módulos.
- Migração/backfill de trips salvas antes desta jornada.
- Qualquer mudança em `apps/api`/schema, ou em `MapCanvas`/`mapStore` (a
  extensão usa exatamente o canal que já existe).

## Aceite

- Uma viagem com itens de Hospedagem + Rota & Custos + Restaurantes, alguns
  com coordenada e outros sem, mostra no mapa exatamente os que têm — mesma
  contagem, nenhum a mais nem a menos.
- Clicar "Reabrir rota" num item com `query` salva chama `restoreRoute` e
  navega para `/rota-custos/resultado`; o `routeStore` reflete a rota salva
  (mesma distância/pedágio/combustível do payload, sem chamar `/routes/plan`).
- Item de rota sem `query` (payload pré-Wave-2) não quebra a tela nem mostra
  o botão de reabrir.
- Nenhuma regressão nos outros módulos que usam o mapa compartilhado — trocar
  de/para a tela de detalhe não deixa marcador residual de outro módulo, nem
  vice-versa.
