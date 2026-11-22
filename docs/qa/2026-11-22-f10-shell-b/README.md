# F10 — Shell B (custos primeiro + mapa vivo) — evidências

Veredito: **PRONTO PARA QA** (autor: Claude Sonnet 5.5; QA deve ser outro modelo).

## TDD

- **RED** (testes escritos antes do código, `agentop run --rm`, node 20.19.0):
  `Test Files 5 failed (5) | Tests 2 failed (2)` — `CompareTable`, `MobileMenu`,
  `ConsultaHero`, `ResultadoPage`, `ShellB` não carregavam (módulos inexistentes).
- **GREEN**: 5 arquivos / 17 testes de B; depois da refatoração para respeitar
  `architecture.test.ts` (core não importa `modules`), a suíte inteira fica verde.
- Descobertas durante o ciclo (corrigidas):
  1. importar `QueryForm` a partir de `layouts/b` cria o ciclo
     `shellLoaders → layouts/b → QueryForm → layouts → shellLoaders`, que **trava a
     coleta** dos testes (mock assíncrono de `shellLoaders` em `setup.ts`);
  2. `architecture.test.ts` exige `core → modules` unidirecional, e o plano pedia
     `ConsultaHero/ResultadoPage` em `core/shell/layouts/b`. Eles foram para
     `modules/rota-custos/layoutB/`; o módulo escolhe a composição pelo layout
     ativo (`modules/rota-custos/index.tsx`). O core B só tem peças genéricas.

## Estabilidade da suíte (`pnpm --filter web test`, 3×, load ≤ 8)

| | arquivos / testes | durações | falhas |
|---|---|---|---|
| base (merge F1+F2+F3+F4+F5+F8+F9, sem F10) | 49 / 291 | 22 s, 24 s, 27 s | 0 |
| F10 | 54 / 308 | 21 s, 21 s, 24 s | 0 |

(Medições na mesma máquina, em sequência; a base não apresentou assinatura de
timeout, logo não há assinatura nova a comparar. Uma execução extra do commit
final: 54 / 308 verdes, 17 s.) Num subconjunto (`src/core src/modules/rota-custos`) houve **1 falha em ~12 execuções** logo após o commit final, não reproduzida em 7 reruns (nome do teste não capturado; hipótese não verificada: flakiness conhecida da suíte). Não rodei E2E (é a F11).

## Capturas (Chrome descartável, `--use-mock-keychain`, `agentop run --rm`, modo demo)

`{desktop,mobile-390x844}-{light,dark}-{1-consulta,2-previa,3-resultado}.png` e
`mobile-390x844-{light,dark}-4-menu.png`. A prévia (2) mostra o traçado tracejado e
o chip "≈ 430 km · 5 h 43" **antes** do Calcular.

## Observações para a QA / outras fases

- **Pinos numerados começam em 0** no mapa enquanto a lista de praças começa em 1
  (`RotaCustosLayout.tsx` publica `index` 0-based; `MapCanvas` mostra o valor cru).
  Contrato F3×F5, fora da F10 (dona F5: publicar `index + 1`). Visível em `*-3-resultado.png`.
- Salvar na viagem só aparece com login (`SaveRouteToTripDialog` retorna `null` sem
  sessão): por isso as capturas em modo demo não mostram o botão; o teste cobre o caso logado.
- No tema escuro a barra superior herda `bg-primary` (ciano) com texto escuro — igual ao
  `LegacyShell`; contraste não auditado aqui (F11).
- A flag de produção **não** foi ativada: `livePreview` só vale no layout B, `VITE_LAYOUT`
  padrão continua `a`, `VITE_LIVE_PREVIEW` não foi tocada; limitador (#68) segue pré-requisito.
