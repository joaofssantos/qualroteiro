# QA — edição manual de endereço após geocodificação

## Escopo

As suítes de Restaurantes, Atividades e Hospedagem cobrem a escolha de um
resultado geocodificado, a edição manual do endereço e um novo resultado
selecionado. Os testes de edição já verificam que o envio persiste `lat` e
`lng` como `null`, impedindo o uso da coordenada anterior; os novos cenários
verificam que uma nova escolha substitui ambas pelas coordenadas do novo lugar.

## Verificação

Executado em ambiente descartável com `agentop run --rm`:

- `pnpm --dir apps/web test` — 27 arquivos, 188 testes aprovados.
- `pnpm --dir apps/web typecheck` — aprovado.
- `pnpm --dir apps/web lint` — aprovado.

Resultado: aprovado.
