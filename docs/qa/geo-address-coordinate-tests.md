# QA — edição manual de endereço após geocodificação

## Escopo

As suítes de Restaurantes, Atividades e Hospedagem cobrem, em dois testes
enxutos por módulo (um único salvamento cada):

1. **Edição manual** — escolhe um resultado geocodificado, edita o endereço à
   mão, salva e comprova que o payload persiste `lat`/`lng` como `null`.
2. **Nova escolha** — escolhe um resultado, edita o endereço, escolhe outro
   lugar e comprova que o payload salvo traz o endereço e as coordenadas do
   novo lugar.

Os testes usam `userEvent.setup({ delay: null })`, `findBy*`/`waitFor` com
`timeout` explícito de 10 s e timeout de teste de 30 s, para tolerar carga
alta da máquina.

Proteção: removendo o `setCoords(null)` do `onChange` do endereço nos três
módulos, os testes "clears stale coordinates when the address is edited by hand…"
(e os já existentes "clears selected coordinates…") falham — verificado e
restaurado. O teste de nova escolha, sozinho, não detecta essa mutação (as
coordenadas novas sobrescrevem as antigas); quem a detecta é o de edição manual.

## Verificação

Executado em ambiente descartável com `agentop run --rm` (node 20.19.0,
binários de `node_modules`), com load average da máquina entre ~24 e ~50:

- Os 3 arquivos dos módulos (`restaurantes`, `atividades`, `hospedagem`), 3 execuções:
  34/34 testes aprovados nas 3 vezes.
- Suíte web completa, 2 execuções:
  - 1ª: 191/191 aprovados.
  - 2ª (load ~50): **12 falhas de 191**, todas em testes de timeout sob carga —
    `rotaCustos` (2), `demoMode` (3) e testes **pré-existentes** de
    restaurantes/atividades/hospedagem (7). Os testes novos desta PR passaram.
- `tsc --noEmit` e `eslint src` (em `apps/web`) — aprovados.

## Instabilidade conhecida

A suíte web é instável sob carga alta, independentemente desta PR. Em
`origin/main`, sem estas mudanças, ocorreram 12–13 falhas por timeout
(`demoMode`, `mapPersistence`, `TripDetailScreen`, `rotaCustos`). Portanto a
suíte completa **não** pode ser declarada estável; só os arquivos dos módulos
foram aprovados de forma consistente (3/3). Recomenda-se elevar o
`testTimeout` global ou limitar o paralelismo em ambientes sobrecarregados —
fora do escopo desta PR.

Resultado: testes novos estáveis (3/3 nos módulos); suíte completa com
instabilidade por timeout sob carga, preexistente.
