# Layout A e B alternáveis — spec de design

- Data: 2026-11-22 · Branch `feat/layout-a-b` · Tarefa Agentask `t-45b19826e8` / `s-8585a32852`
- Base: proposta em `docs/design/2026-11-layout-proposta/README.md` (PR #60, branch `docs/layout-proposta-2026-11`). Mockups em `mockups/` dessa branch.
- Pedido do dono (22/11): *"vou querer as duas opções, e quero poder mudar depois"*.
- Plano de execução: `docs/superpowers/plans/2026-11-22-layout-a-b.md`.
- Status: **spec de decisão tomada sem o dono** (indisponível). Cada escolha minha está marcada **[call]**.

## 1. Intenção

Entregar as duas direções da proposta no mesmo app, sobre os mesmos componentes, com uma chave que decide qual aparece. O dono não quer escolher agora; quer poder trocar depois e, no futuro, apagar uma das direções sem refazer nada.

- **A — mapa primeiro:** mapa em tela cheia, painel flutuante único (416 px) que muda de Consulta → Resultado → Praça; *rail* de 76 px no desktop; *bottom sheet* + *tab bar* no mobile.
- **B — custos primeiro, com mapa vivo:** barra superior com módulos; consulta como *hero* sobre o mapa; resultado como página (KPIs, mapa em cartão + praças, tabela de alternativas).
  - **Mapa vivo:** na consulta, o mapa de fundo põe os pinos assim que origem/destino têm coordenadas e enquadra neles. Com os dois definidos, desenha a **prévia do traçado antes do Calcular** (chamada de rota com *debounce*, cancelável, só com os 2 pontos com coordenadas).

## 2. Metas, não-metas, anti-metas

**Metas**
1. Um conjunto de componentes compartilhados; só o *shell* (composição) difere entre A e B.
2. Chave de layout: padrão de build (`VITE_LAYOUT=a|b`, padrão `a`) + escolha do usuário em **Ajustes**, salva em `localStorage`, aplicada **sem recarregar**.
3. Tokens semânticos claro/escuro; zero cor literal no mapa e nas classes de paleta (13 literais + `amber/emerald/white`).
4. Decisões D2–D8 da seção 9 do README aplicadas (tabela em §5) e as ressalvas do QA da proposta cobertas.
5. Remover uma direção = apagar uma pasta + uma entrada de registro (§4.3).

**Não-metas** (backlog, D8): "consultas recentes", compartilhar, exportar, tabela com parada extra além do que a API já devolve, novo provedor de mapa.

**Anti-metas** (falha mesmo que "funcione"): piorar a estabilidade da suíte web; duas cópias de um mesmo componente (uma por layout); uma direção importando da outra; reload para trocar layout; chamada de rota sem os 2 pontos ou sem cancelamento; segredo no cliente.

## 3. Estado atual relevante (lido no código)

- `core/shell/AppShell.tsx` (187 linhas): sidebar + `<main>`; monta `MapCanvas` uma vez, lendo `useMapStore` (layers, trace, onMarkerClick); mapa 4/5 + painel `md:w-1/5` com `.map-content-panel` e `!important` no `index.css`.
- `RotaCustosLayout` publica layers/trace no `mapStore` e chama `clearMap()` ao desmontar (contrato documentado no store).
- `NewQueryScreen` já chama `setEndpointMarkers` ao escolher origem/destino/paradas; `routeStore.endpointMarkers` → camada "Origem, destino e paradas". Ou seja: **pinos na consulta já existem**; faltam o *enquadramento* e a **prévia do traçado**.
- `planRoute(request, signal?)` (`core/api/client.ts`) já aceita `AbortSignal` (e funciona em modo demo).
- Não existe tela de Ajustes. Tema: `useTheme` (`qualroteiro:theme`, classe `dark` no `<html>`). Sem `Accordion`/`Segmented`/`Switch`; só `tabs`, `dialog`, `sheet`, `select`.
- Testes: vitest + jsdom, MapLibre stubado em `src/test/maplibre-stub.ts`; `AppShell.test`, `rotaCustos.test`, `MapCanvas*.test`, `mapPersistence.test` verificam nomes acessíveis. Suíte instável sob carga (timeouts em mapPersistence, demoMode, rotaCustos, TripDetail).

## 4. Arquitetura

### 4.1 Camadas

```
core/layout/            (novo)  config + store + Ajustes + registro de layouts
core/shell/AppShell.tsx         vira seletor fino: <ActiveShell>{children}</ActiveShell>
core/shell/layouts/a/   (novo)  ShellA: Rail, TabBar, FloatingPanel, BottomSheet
core/shell/layouts/b/   (novo)  ShellB: TopBar, ConsultaHero, ResultadoPage, MobileTotalBar
core/shell/shared/      (novo)  ModuleNav model (registry→itens), ThemeToggle, AuthSlot, DemoBadge
core/map/                       mapStore, MapCanvas, layers, theme.ts, mapStyle.ts (compartilhado)
modules/rota-custos/            QueryForm, ResultBlocks (TotalHero, CostBar, AltCard, TollRow…) compartilhados
```

Regra de dependência: `layouts/a` e `layouts/b` **só importam** de `shared/`, `core/map`, `modules/*/blocks` e `components/ui`. Nunca um do outro. Os módulos (`rota-custos`, hospedagem…) **não sabem** que layout existe, exceto por um *slot* de composição (§4.4).

### 4.2 Chave de layout

- `core/layout/layoutConfig.ts`: `type LayoutId = 'a' | 'b'`; `LAYOUT_STORAGE_KEY = 'qualroteiro:layout'`; `buildDefaultLayout(): LayoutId` lê `import.meta.env.VITE_LAYOUT` (inválido/ausente → `'a'`); `readStoredLayout()` (valor inválido → ignora).
- `core/layout/layoutStore.ts` (zustand): `{ layout: LayoutId; setLayout(id) }`. Inicial = armazenado ?? padrão do build. `setLayout` grava no `localStorage` e dispara re-render do shell — sem reload. Escuta o evento `storage` (outra aba).
- `core/layout/layouts.ts` (**o registro**): `LAYOUTS: Record<LayoutId, { id; label; description; Shell: ComponentType<{children}>; livePreview: boolean }>`. Shells por `React.lazy` → a direção não usada nem entra no chunk inicial **[call]**. **Invariante:** trocar o tipo do `Shell` não pode ser o dono da árvore da consulta: React desmonta os descendentes ao trocar o wrapper. O rascunho deve morar em `routeDraftStore`/controller acima dos shells, não no `useState` de `NewQueryScreen`.
- Ajustes: `SettingsDialog` (usa `ui/dialog` existente) aberto por botão "Ajustes" no rodapé do *rail*/barra; grupo de rádios "Layout: Mapa primeiro (A) / Custos primeiro (B)" + o tema. Escolhido em Ajustes → persiste e troca na hora. **[call]** diálogo e não rota/módulo, para não poluir o registry nem a navegação.
- `VITE_LAYOUT` documentado em `env.d.ts` e `.env.example`.

### 4.3 Como remover uma direção depois
1. apagar `core/shell/layouts/<x>/`; 2. remover a entrada em `layouts.ts` e a opção no `SettingsDialog` (a lista vem do registro, então basta a entrada); 3. se restar um layout só, apagar `layoutStore`/chave e deixar o shell sobrevivente direto em `AppShell`. Os componentes compartilhados não mudam. A fase F11 do plano escreve essa receita e **um teste que prova** que o registro com 1 só entrada funciona.

### 4.4 Slot de composição do módulo
Um módulo que quer layout diferente por direção expõe *blocos*, não telas. Para `rota-custos`: `QueryForm`, `ResultSummary`, `AlternativesList`, `TotalHero`, `CostBar`, `TollList`, `FuelSection`, `PointsSection`. As telas atuais (`NewQueryScreen`, `ResultScreen`) viram **composições finas** desses blocos, e cada shell escolhe a composição via `useLayoutComposition()` (`{ Consulta, Resultado }`), sem ramificação `if (layout==='b')` dentro dos blocos. Os blocos recebem apenas props/estado de store.

### 4.5 Mapa compartilhado
- `mapStore` ganha (aditivo): `preview: RouteTrace | null` (traçado de prévia, estilo "tracejado/desbotado"), `padding: {top,right,bottom,left}` (cada shell publica o espaço coberto por painel/sheet), `fitRequest` (enquadrar pinos/traço). `AppShell` mantém um único `MapCanvas` fora do componente lazy que troca; os shells recebem um `MapHost`/slot estável para posicionar o mesmo contêiner por CSS. A implementação chama `map.resize()` depois de cada reposicionamento/alteração de tamanho e testa que A↔B não cria outro `maplibregl.Map`; um portal que troca de contêiner, sozinho, não basta.
- Tokens → mapa: `core/map/theme.ts` lê CSS vars (`--route`, `--pin-*`, …) e reage à troca de tema (`MutationObserver` em `class`), atualizando por `setPaintProperty`, sem recriar o mapa.
- Estilo escuro: `core/map/mapStyle.ts` busca o estilo base (OpenFreeMap `liberty`) e **recolore** por *id/tipo de camada* com os tokens do mapa (D3-a). Falha de recolor → fallback ao estilo original sem filtro CSS e aviso no console, nunca tela em branco.

### 4.6 Prévia do traçado (B) — contrato
`usePlanPreview({ origin, destination, stops, vehicle, enabled })` em `modules/rota-custos/usePlanPreview.ts`:
- só dispara se `enabled` (layout com `livePreview`) **e** origem e destino têm `place` com coordenadas (`{lng,lat}`); texto livre **não** dispara.
- *debounce* de 700 ms **[call]**; cada nova mudança cancela timer e `AbortController` anterior; desmontar cancela.
- cache em memória por chave `origem|destino|paradas|veículo|preço` (coordenadas arredondadas a 5 casas) — voltar à mesma consulta não refaz a chamada; guarda também a promessa em voo para impedir duplicata ao alternar A↔B. Cada nova chave aborta a anterior e há no máximo **1 chamada em voo** por aba.
- usa `planRoute(req, signal)` com o **request completo** (`origin`, `destination`, paradas, veículo e `fuelPricePerL`, obrigatório no contrato atual) e `vehicle` padrão se inválido; só lê `routes[0].geometry` (+ tempo/km para um chip "≈ 412 km · 5 h 10"); **não** grava em `routeStore.routes` (o resultado oficial continua só do Calcular), nem navega.
- erro/aborto/422 → silencioso (prévia some; o Calcular continua como fonte de erro). Nunca mostra toast.
- Publica em `mapStore.preview`; limpa ao `clearMap()`, ao apagar um ponto e ao navegar.
- **Custo/cota [call]:** cada prévia é uma chamada ao mesmo `POST /routes/plan` do Calcular (OpenRouteService no servidor), que também resolve/decora custos. Hoje esse handler não tem rate limit nem quota/circuit breaker para routing; debounce no navegador não protege múltiplas abas/usuários. Antes de habilitar fora do demo, a API precisa impor limite por IP/sessão, devolver `429`/`Retry-After` e emitir métrica; a UI trata `429` silenciosamente como qualquer erro de prévia. Mantêm-se debounce, cache, 1 em voo, só B e `VITE_LIVE_PREVIEW=false`.

## 5. Decisões da seção 9 do README

| # | Decisão adotada | Onde |
|---|---|---|
| D1 | **Ambas**, A padrão. | §4.2 |
| D2 | Manter petróleo + âmbar; só adicionar papéis semânticos. | F1 |
| D3 | (a) recolorir OpenFreeMap com tokens; **fase 0 = prova técnica** com critério objetivo (§6). (c) filtro CSS removido só após F0 passar; se reprovar, cair em (b) via nova decisão do dono. | F0, F3 |
| D4 | Bottom sheet **próprio** (3 alturas, sem dependência). | F7 |
| D5 | Tabs → Accordion **só no resultado de rota-custos**; `Tabs` permanece nos outros módulos. Testes atualizados na mesma PR. | F5 |
| D6 | Camada "Postos" **desligada** por padrão (`defaultVisible:false`). Mudança de comportamento: mencionar no PR. | F5 |
| D7 | Rótulos das alternativas **derivados no cliente** (`deriveAlternativeLabels`: menor tempo → "Mais rápida", menor total → "Mais barata", sem pedágio → "Sem pedágio", resto "Alternativa N"); pura e testada. | F5 |
| D8 | "Consultas recentes"/"Compartilhar" ficam em backlog; B desenhada sem eles (o *hero* mostra só a busca). | — |

## 6. Ressalvas do QA da proposta

1. **Recolorimento do OpenFreeMap não validado.** F0 é um *spike* com saída objetiva: script que carrega `liberty`, aplica tokens escuros por camada e gera 3 capturas (SP, cidade, rodovia) + checagem de contraste de rótulos ≥ 4,5:1 (sobre o halo) + lista de ids de camada tratados/ignorados. **Pronto = relatório em `docs/qa/` com veredito "passa/falha"**; sem "passa", F3 não remove o filtro CSS.
2. **Navegação mobile da B sem teste.** Em B mobile não há *tab bar*; navega-se por barra superior compacta + menu (`dialog`/`sheet`). F10 inclui um teste de navegação: de 390 px, alcançar os 5 módulos, voltar, abrir Ajustes e trocar para A, tudo por teclado/ARIA, com nomes acessíveis únicos (sem link duplicado — mesma lição do `AppShell`).

## 7. Tokens

Fonte: `mockups/assets/tokens.css` da proposta (§7 do README). Camadas: (i) variáveis CSS HSL em `index.css` `:root`/`.dark` (superfícies, texto, marca, ação, foco, status+soft, custo fuel/toll, mapa, rota/pinos); (ii) `tailwind.config.js` mapeia para classes (`bg-success-soft`, `text-cost-toll`, …); (iii) `core/map/theme.ts` para o mapa. Mantêm-se os nomes shadcn atuais (`--primary`, `--accent`) como *aliases* para não quebrar componentes existentes. Critério mecânico: um teste `tokens.test.ts` falha se encontrar `#hex`/`hsl(`/`rgb(` literal em `core/map/**` (exceto `theme.ts` fallbacks e o arquivo de tokens) ou classes `(amber|emerald|red|green|blue)-\d+`/`bg-white` em `src/**/*.tsx`.

## 8. Estratégia de testes (restrição dura: não piorar a instabilidade)

- **Sem render do app inteiro** nos testes novos: testar *unidades* (reducers, hooks, funções puras) e **componentes isolados** com stores resetados; um único teste de integração por shell, com MapLibre stub.
- **Timeouts explícitos** em todo `findBy*`/`waitFor` (`{ timeout: 3000 }`) e `it(..., 10_000)` só onde necessário; **proibido** `setTimeout` real em teste: debounce/animação via `vi.useFakeTimers()` (+ `afterEach(vi.useRealTimers)`).
- Fluxos curtos: ≤ 5 interações por teste; um comportamento por `it`.
- Isolamento: `localStorage.clear()`, `useLayoutStore.setState(initial)`, `useMapStore.getState().clearMap()` no `beforeEach`; sem dependência de ordem.
- Nenhuma fase altera `vitest.config.ts` globalmente. Cada PR roda, antes e depois, `pnpm --filter web test` **3 vezes** e registra tempo total e falhas; **a PR não passa se o tempo total crescer > 10 %** ou se surgir teste novo instável (falha em qualquer das 3). `agentop run --rm` para todos os comandos.
- E2E Playwright (já existe `e2e/`): só F11, 1 worker, dentro de `agentop run --rm`, perfil descartável com `--use-mock-keychain`.
- QA: autor ≠ revisor (modelos diferentes), conforme AGENTS do repo.

## 9. Riscos

| Risco | Mitigação |
|---|---|
| Prévia consome cota do ORS | debounce+cache+1 em voo+chave de desligar+teste de contagem (§4.6) |
| Mapa único reposicionado entre B-página e A-tela cheia | `MapHost` único; teste de que `new maplibregl.Map` é chamado 1× ao trocar layout |
| Trocar layout no meio de uma consulta perde estado | o resultado já vive em `routeStore`/`mapStore`; o rascunho precisa ir para `routeDraftStore`; teste de troca A→B→A preservando origem/destino/resultado |
| Trocar layout desmonta formulário/mapa | hoje `NewQueryScreen` guarda rascunho local e trocar `Shell` pode desmontar os filhos; criar `routeDraftStore` acima dos shells e manter `MapCanvas` fora do lazy shell, com teste de rascunho + `new Map` 1× |
| Prévia aumenta carga sem proteção no servidor | `POST /routes/plan` atual não limita requisições; adicionar rate limit/`429`/`Retry-After` e métrica antes de habilitar produção |
| Total parece definitivo com praça sem tarifa | consumir `tolls.unavailablePlazaIds`; quando não vazio, marcar total de pedágios e da viagem como parcial/"tarifa indisponível" e listar as praças afetadas |
| `.map-content-panel` + `!important` quebram B | removidos em F6; B nunca usa a classe |
| Testes por nome acessível quebram (Tabs→Accordion) | atualizados na mesma PR (F5), nomes acessíveis preservados quando possível |
| Bundle maior | shells por `lazy`; medir antes/depois em F11 |

## 10. Deixado ao construtor

Valores exatos de espaçamento/raios (seguir `tokens.css` e os mockups); ícones; textos secundários em pt-BR; escolha de `Radix` (`accordion`, `switch`, `toggle-group`, `radio-group`) — adicionar só os usados; curva de animação do sheet (respeitar `prefers-reduced-motion`).
