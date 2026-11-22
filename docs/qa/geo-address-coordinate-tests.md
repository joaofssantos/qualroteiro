# QA — edição manual de endereço após geocodificação

## Escopo

As suítes de Restaurantes, Atividades e Hospedagem cobrem a escolha de um
resultado geocodificado, a edição manual do endereço, o salvamento antes de
qualquer nova escolha e um novo resultado selecionado. Cada cenário de
"selecionar de novo" agora comprova que o payload intermediário persiste
`lat` e `lng` como `null`, impedindo o uso da coordenada anterior, e só então
comprova que a nova escolha substitui ambas pelas coordenadas do novo lugar.

Essa ordem torna a cobertura sensível à remoção de `setCoords(null)` no
`onChange` do endereço: nessa mutação, a asserção intermediária falha antes do
reselect, em vez de ser mascarada pelas coordenadas da nova escolha.

## Verificação

Executado em ambiente descartável com `agentop run --rm`:

- `./node_modules/.bin/vitest run src/modules/restaurantes/restaurantes.test.tsx src/modules/atividades/atividades.test.tsx src/modules/hospedagem/hospedagem.test.tsx` (em `apps/web`) — 31 testes aprovados.
- `./node_modules/.bin/tsc --noEmit` (em `apps/web`) — aprovado.
- `./node_modules/.bin/eslint src` (em `apps/web`) — aprovado.

O teste de reselect de Restaurantes tem timeout explícito de 15 s: ele executa
dois salvamentos completos para verificar o payload intermediário e evitar
flakiness sob carga. O teste instável pré-existente
`src/core/map/mapPersistence.test.tsx` fica fora deste escopo.

Resultado: aprovado.
