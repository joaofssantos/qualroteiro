# Resultados próximos: ocultar após seleção

Data: 2026-09-17  
Escopo: `apps/web/src/modules/{hospedagem,restaurantes,atividades}/**`

## Mudança

Os três painéis já mantinham a identificação da seleção em `selectedPlaceId` e a redefiniam para `null` ao começar uma busca. A lista de resultados, porém, não usava esse estado para sua visibilidade.

| Módulo | Antes | Depois | Evidência de teste |
| --- | --- | --- | --- |
| Hospedagem | `nearbyPlaces !== null` renderizava a lista mesmo com item selecionado. | A lista `Hospedagens encontradas` requer `selectedPlaceId === null`. | `hospedagem.test.tsx`: seleciona Hotel Atlântico, confirma que a lista não está no DOM e executa nova busca, que a restaura. |
| Restaurantes | `nearbyPlaces.length > 0` renderizava a lista mesmo com item selecionado. | A lista `Restaurantes encontrados` requer `selectedPlaceId === null`. | `restaurantes.test.tsx`: seleciona Casa do Porco, confirma a ausência da lista e a restauração após nova referência. |
| Atividades | `searchState === 'results'` renderizava a lista mesmo com item selecionado. | A lista `Atividades encontradas` requer `selectedPlaceId === null`. | `atividades.test.tsx`: seleciona Museu do Amanhã, confirma a ausência da lista e a restauração após nova busca. |

Os resultados continuam no estado e os marcadores continuam disponíveis: esconder a lista não descarta os dados nem muda o fluxo de seleção pelo mapa.

## Verificação

- Teste direcionado: 3 arquivos, 16 testes aprovados.
- `pnpm -w build`
- `pnpm -w typecheck`
- `pnpm -w lint`
- `pnpm -w test`

Os testes de cada módulo exercitam o DOM antes e depois da seleção (`findByRole('list')` antes; `queryByRole('list')` ausente depois) e uma segunda busca, que redefine `selectedPlaceId` e mostra a lista novamente.
