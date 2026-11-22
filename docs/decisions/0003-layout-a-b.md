# 0003 — Layouts A/B coexistentes e receita de remoção

**Status:** aceito (2026-11-22) · implementado nas fases F1–F11 do plano
`docs/superpowers/plans/2026-11-22-layout-a-b.md`; spec em
`docs/superpowers/specs/2026-11-22-layout-a-b-design.md`.

## Contexto

O shell único (sidebar + mapa 4/5 + painel 1/5) foi substituído por duas direções de
layout que ficam no app ao mesmo tempo até o dono escolher uma:

- **A — "Mapa primeiro"** (padrão): mapa em tela cheia, *rail* de módulos, painel flutuante
  (416 px) no desktop; *bottom sheet* + *tab bar* no mobile (< 768 px).
- **B — "Custos primeiro"**: barra superior, consulta como *hero*, resultado como página
  (total, barra de custo, pedágios, tabela de alternativas) e **prévia ao vivo** do traçado
  no mapa antes do "Calcular rota".

## Decisões

1. **As duas coexistem**, com A como padrão. Escolha: `VITE_LAYOUT=a|b` (build; inválido →
   `a`) e a opção em **Ajustes** (grava `localStorage['qualroteiro:layout']`, vence o build).
   A troca é imediata, sem recarregar, com um único `MapLibre.Map` e o rascunho/resultado
   preservados (provado em `AppShell.layout.test.tsx` e no E2E `layout-a.spec.ts`).
2. **O registro é derivado de `LAYOUT_META`** (`core/layout/layoutConfig.ts`): `LAYOUTS`,
   as opções dos Ajustes e o *fallback* de uma escolha salva que aponta para um layout
   removido (`resolveLayoutId`) saem dele. Com **uma só** entrada, os Ajustes escondem o grupo
   de layout (`core/layout/singleLayout.test.tsx`).
3. **Componentes compartilhados não duplicam por layout:** `QueryForm`, blocos do resultado
   (`TotalHero`, `CostBar`, `TollRow`, `AltCard`…), `MapCanvas`/`mapStore`, `shared/`
   (navegação de módulos, tema, auth, selo demo). Nenhuma direção importa da outra.
4. **Prévia do traçado só no B** (`livePreview`) e desligável por `VITE_LIVE_PREVIEW=false`.
   Debounce de 700 ms, cancelamento, só com 2 pontos com coordenadas, no máximo 1 chamada em
   voo, cache em memória com **teto de 50 entradas** (descarta a mais antiga).
5. **Pino numerado:** o mapa mostra o número **como recebido** (`MapMarkerSpec.index`, 1-based);
   quem publica converte. `RotaCustosLayout` publica `índice + 1`, igual ao número da lista
   de praças (`TollRow`). Lado escolhido porque o mapa não sabe se a lista começa em 0 ou 1,
   e a lista (o que o usuário lê) é a referência.

## Pré-requisito para ligar a prévia em produção (NÃO ativado)

Cada prévia é uma chamada ao mesmo `POST /routes/plan` do "Calcular", que consome cota do
OpenRouteService no servidor. Debounce e cache no navegador não protegem contra várias abas
ou usuários. **O limitador de taxa da API (#68) é pré-requisito** para habilitar a prévia fora
do modo demo: limite por IP/sessão, `429` com `Retry-After` e métrica. A UI já trata `429`
em silêncio (a prévia some; o "Calcular" continua sendo a fonte de erro).

Até #68 entrar: **nenhuma flag é ligada em produção** (`VITE_LAYOUT` permanece `a`, que não
tem prévia). O B só aparece para quem o escolhe em Ajustes e, sem #68, deve ficar com
`VITE_LIVE_PREVIEW=false` em qualquer ambiente com API real.

## Receita de remoção de uma direção

O teste `core/layout/singleLayout.test.tsx` prova o estado final (registro com 1 entrada).
Passos, na ordem; rode `pnpm --filter @qualroteiro/web typecheck && pnpm --filter @qualroteiro/web test`
no fim.

### Remover o **B** (fica o A)

1. Apagar `apps/web/src/core/shell/layouts/b/` e `apps/web/src/modules/rota-custos/layoutB/`.
2. `core/layout/layoutConfig.ts`: remover `b` de `LAYOUT_META` e do tipo `LayoutId`
   (`'a'`); `core/layout/shellLoaders.ts`: remover o carregador `b`.
3. `modules/rota-custos/index.tsx`: remover `LayoutBConsulta`/`LayoutBResultado` e a entrada
   `b` de `COMPOSITIONS`.
4. Prévia (só B): apagar `usePlanPreview.ts` (+ teste), a chamada em `QueryForm` e
   `livePreview` de `LAYOUT_META`; remover `preview` de `mapStore`/`MapCanvas` se nada mais usar.
5. `test/setup.ts`: tirar `b` do mock de `shellLoaders`; apagar os trechos de `b` em
   `AppShell.layout.test.tsx`, `e2e/layout-b.spec.ts` e o ramo `layout === 'b'` do
   `e2e/layout-suite.ts`. Remover `VITE_LIVE_PREVIEW` de `env.d.ts`/`.env.example`.
6. Opcional (só sobra um layout): apagar `layoutStore`/`SettingsDialog` do grupo de layout e a
   chave `qualroteiro:layout`, e montar o `ShellA` direto em `AppShell` (o seletor deixa de existir).

### Remover o **A** (fica o B)

1. Apagar `apps/web/src/core/shell/layouts/a/`.
2. `layoutConfig.ts`: remover `a` de `LAYOUT_META`; o padrão de `buildDefaultLayout` passa a
   ser `'b'`. `shellLoaders.ts`: remover `a`.
3. `modules/rota-custos/index.tsx`: a composição do B vira a única (apagar `DEFAULT_COMPOSITION`
   e `NewQueryScreen`/`ResultScreen` **se** ninguém mais os usar — o B usa `QueryForm` e os blocos).
4. `index.css`: remover `.map-content-panel` e o que for só do painel flutuante do A; o
   `mapStore.padding` continua sendo usado pelo B (cards sobre o mapa).
5. `test/setup.ts` e os testes/E2E do A, como no B.

### O que **não** muda

`QueryForm`, `blocks/*`, `MapCanvas`, `mapStore`, `core/shell/shared/*`, tokens de cor e o
`routeDraftStore`. Se um passo acima exigir mexer num deles, a regra "nenhuma direção importa
da outra" foi violada — corrija antes de remover.

### Dívida conhecida

`core/shell/layouts/legacy/LegacyShell.tsx` não é usado por nenhum layout registrado (só pelo
`AppShell.test.tsx`, que o monta via mock de `shellLoaders`). Pode ser apagado junto com a
direção que for removida, migrando/descartando esses testes.

## Consequências

- Duas direções custam bundle (chunks separados: o usuário baixa só o shell escolhido) e
  testes duplicados até a escolha; o relatório `docs/qa/2026-11-layout-ab-qa.md` mede os dois.
- A remoção é mecânica (apagar pastas + entradas de registro), mas **não** tão pequena quanto
  "uma pasta": o B espalha-se por `layouts/b`, `rota-custos/layoutB`, `usePlanPreview` e a
  composição do módulo; o A, por `layouts/a` e o CSS do painel. A lista acima é a fonte.
