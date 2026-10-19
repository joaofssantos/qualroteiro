# Orientation Spec — j-20260916-gl (G2 — mapa persistente compartilhado)

> Segunda unidade da fase G (dados reais + busca geográfica), decidida com o
> PE em 2026-09-16. G1 (`.aipe/journeys/j-20260916-sw`) já fechou o backend
> de busca; esta unidade é a fundação de `apps/web` que G3/G4/G5 (busca
> ligada em Hospedagem/Restaurantes/Atividades — briefs já rascunhados em
> `G-COORDINATION.md`) vão consumir.
>
> **Decisão de escopo tomada pelo coordenador, não pelo PE — documentada
> aqui em vez de perguntada**: o pedido original do PE foi "quero que o mapa
> sempre faça parte da jornada" de todo módulo. Investigando o código antes
> de escrever este spec, achei que `apps/web/src/core/shell/AppShell.tsx` já
> envolve TODO módulo (é o shell — nav + content well), e `MapCanvas`
> (`core/map/MapCanvas.tsx`) já é um componente de mapa genérico e
> reutilizável (não sabe o que é pedágio, só sabe camadas/marcadores) — só
> está montado hoje dentro de `RotaCustosLayout`, não no shell. Então G2 não
> precisa CRIAR um mapa novo, só **extrair a montagem do `MapCanvas` pro
> nível do shell** (pra sobreviver à troca de módulo) e dar a cada módulo um
> jeito de publicar seus próprios marcadores nele.
>
> A parte que decidi sozinho: em vez de forçar TODOS os módulos a ganharem
> uma UI de mapa dividido nesta unidade (Hospedagem/Restaurantes/Atividades
> hoje são formulário de coluna única, sem nada pra mostrar no mapa ainda —
> a busca deles só chega em G3-5), G2 constrói o **mecanismo** (store
> compartilhada + mapa no nível do shell) e liga isso só em `rota-custos`
> (que já usa mapa hoje — zero mudança visual pra quem já usa o produto).
> Ativar o mapa em cada um dos outros 3 módulos vira parte do escopo de
> G3/G4/G5 respectivamente — cada um liga o interruptor E publica marcadores
> reais de busca ao mesmo tempo, em vez de dois momentos separados sem
> propósito visível entre eles. Ver `G-COORDINATION.md` pra esse
> encadeamento.

## Problem

Hoje o mapa (`MapCanvas`, MapLibre) só existe dentro de `RotaCustosLayout` —
sai do DOM (e destrói o contexto WebGL) toda vez que o usuário navega pra
outro módulo. G2 faz o mapa sobreviver à navegação entre módulos e dá a
qualquer módulo (presente ou futuro) um jeito de publicar seus próprios
marcadores nele, sem que o shell precise saber o que é um pedágio, uma
hospedagem ou um restaurante — mesma filosofia de extensibilidade que já
rege `moduleRegistry`.

## Cross-package contracts

Unidade única, `qualroteiro/web`. Nenhum contrato de `apps/api` muda. Não
depende de G1 tecnicamente (G1 é `apps/api`), mas é sequencial por decisão
do PE — G3-5 (que SIM consomem G1) dependem desta unidade.

- **`ModuleDefinition`** (`core/registry/types.ts`) ganha um campo novo,
  opcional: `showMap?: boolean` (default `false` quando ausente). Interruptor
  puro — não muda o shape de `mapLayers` (que já existe) nem cria um
  contrato de dados novo.
- **Nova store compartilhada** (`core/map/mapStore.ts` ou nome equivalente
  que o dev escolher, documentar a escolha) — o mecanismo pelo qual QUALQUER
  módulo publica o que o mapa deve mostrar enquanto ele está montado:
  `setMapLayers(layers: readonly (MapLayerData & {visible: boolean})[])`,
  `setMapTrace(trace: RouteTrace | null)`, `clearMap()`. Módulo nenhum além
  do próprio módulo ativo deve conseguir "vazar" marcadores pro mapa depois
  de navegar pra outro lugar — `clearMap()` (ou equivalente) tem que rodar
  na saída de cada módulo que usa o mapa (efeito de cleanup do React).
- `AppShell` passa a renderizar `MapCanvas` lendo dessa store, num painel
  persistente, só quando o módulo ativo (`module.showMap === true`) pedir.
  Módulos com `showMap` ausente/`false` continuam exatamente como hoje
  (largura cheia, sem painel de mapa) — **zero mudança visual pra eles nesta
  unidade**.

## Per-package scope

### qualroteiro/web

- **Scope:**
  1. Campo `showMap?: boolean` em `ModuleDefinition` (`core/registry/types.ts`).
  2. Store compartilhada de mapa (novo arquivo em `core/map/`), Zustand —
     mesmo padrão de `routeStore.ts` (leia esse arquivo primeiro pra
     entender o porquê de Zustand aqui: `MapCanvas` lê fora do ciclo de
     render do React). **Não** misturar com `routeStore` — ele continua
     dono do estado de rota-custos (query/routes/plaza); a store nova é só
     o canal genérico pro mapa, sem saber o que é uma rota.
  3. `AppShell.tsx`: quando `listModules()` acha o módulo cujo `path`
     corresponde à rota ativa e `showMap === true`, renderiza um painel de
     mapa persistente (mesma estrutura visual/responsiva que
     `RotaCustosLayout` já tem hoje — `h-[38vh]` mobile / `flex-1` desktop,
     reaproveitar as classes existentes) lendo `MapCanvas` da store nova,
     ao lado de `children`. Quando `showMap` for `false`/ausente, layout
     igual ao de hoje (`children` ocupa tudo).
  4. `RotaCustosLayout.tsx`: para de montar seu próprio `<MapCanvas>` e sua
     própria divisão de layout — em vez disso, escreve na store nova
     (mesmo cálculo de `mapLayers`/`trace` que já existe hoje, só que via
     `setMapLayers`/`setMapTrace` em vez de prop direto pro `MapCanvas`) e
     `showMap: true` no `rotaCustosModule` (`modules/rota-custos/index.tsx`).
     `onMarkerClick` (que hoje abre o `PlazaDrawer`) precisa continuar
     funcionando — decida com a store como o callback chega até o
     `AppShell`/`MapCanvas` (pode ser mais um campo na store, ex.
     `onMarkerClick`, documentar a escolha).
  5. **Prova de extensibilidade real**, mesmo espírito de
     `extensibility.test.tsx`: um módulo fake registrado dentro do próprio
     teste, com `showMap: true`, consegue publicar marcadores e vê-los no
     mapa persistente, sem editar `AppShell`/`RotaCustosLayout`/qualquer
     arquivo core pra isso funcionar.
  - **Não** tocar `apps/api`, `packages/*`. **Não** ativar `showMap` em
    `hospedagem`/`restaurantes`/`atividades`/`planejamento-viagem` — fica
    pra G3/G4/G5 (cada um religa seu próprio módulo quando tiver dado real
    de busca pra mostrar). **Não** construir UI de toggle de camadas
    (layer manager visual) — não foi pedido, `listRegisteredLayers()`
    continua existindo mas sem consumidor visual novo nesta unidade.
- **Acceptance:**
  - `pnpm --filter @qualroteiro/web build/typecheck/lint/test` verdes.
  - **Regressão zero em Rota & Custos**: `rotaCustos.test.tsx` continua
    provando trace + camadas de pedágio/posto + clique-abre-`PlazaDrawer`
    exatamente como hoje. Se o `data-testid="rota-custos-map-container"`
    precisar mudar de dono (de `RotaCustosLayout` pro `AppShell`), o teste
    pode ser ajustado, mas o comportamento observável (o que aparece na
    tela, o que abre ao clicar) tem que ser idêntico — não é aceitável só
    "o teste passa porque foi reescrito pra combinar com o código novo".
  - Teste novo: módulo fake com `showMap: true`, registrado só dentro do
    teste (`registerModule`), publica marcadores via a store nova e
    `MapCanvas` os recebe — sem editar nenhum arquivo core pra isso passar.
  - Teste: navegar de um módulo com `showMap: true` pra um com
    `showMap: false` (ou vice-versa) não deixa marcador do módulo anterior
    vazando nem quebra o layout — a store limpa no unmount.
  - Teste: alternar entre dois módulos com `showMap: true` (rota-custos +
    o módulo fake do teste de extensibilidade) não mistura os marcadores
    de um com os do outro.
  - `extensibility.test.tsx` (o já existente) continua passando sem
    modificação.
  - `git diff --name-only origin/dev..HEAD` só `apps/web/**`.
  - SDD: `aipe skill match --task-type feature --size medium`.

## Sequencing

- **Wave 1 (única):** `qualroteiro/web` (dev: Peggy Olson) → QA: Stan Rizzo.

G3/G4/G5 (ligar busca do G1 + mapa desta unidade em Hospedagem/
Restaurantes/Atividades) dependem desta unidade `merged`. Os 3 briefs já
estão rascunhados em `G-COORDINATION.md`, marcados bloqueados até aqui
fechar — vou revisá-los contra o que for realmente construído antes de
liberar pro Codex.

## Per-unit dispatch envelopes

`aipe execution propose --journey j-20260916-gl` —
`subagent/claude-code/reasoning/normal` (cost-index 4). Razão: é refactor de
shell/core compartilhado por todo módulo existente — o risco real é
regressão silenciosa em Rota & Custos (já em produção, já testado), e a
forma da store nova (o que ela expõe, como o cleanup evita vazamento entre
módulos) é uma decisão de arquitetura de estado, não um trabalho mecânico.
Descartado `standard`. QA em `standard` (mecânico contra critério explícito,
mas com atenção redobrada em provar regressão zero — comparar comportamento
antes/depois, não só rodar o teste que o dev escreveu).

## Out of scope

- Ativar `showMap` em `hospedagem`/`restaurantes`/`atividades`/
  `planejamento-viagem` — G3/G4/G5.
- UI de toggle/gerenciador de camadas visível ao usuário.
- Qualquer coisa em `apps/api`/`packages/*`.
- Identidade visual (ícones, cores) — backlog futuro separado, não agora.
