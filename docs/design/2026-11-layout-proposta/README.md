# Qual roteiro — proposta de novo layout (nov/2026)

> Pedido do dono: *"Vamos rever o layout, quero uma nova proposta, com base nos seguintes: Mapeia, Rotas Brasil e QualP."*
> Entrega: **proposta** (pesquisa, auditoria, duas direções, tokens, plano em fases) + mockups navegáveis. **Nenhum código do app (`apps/web`) foi alterado.**

- Tarefa Agentask: `t-45b19826e8` / subtarefa `s-fe615b6ae6`. Branch `docs/layout-proposta-2026-11`.
- Mockups: abra [`mockups/index.html`](mockups/index.html) (estáticos, sem build, responsivos, claro/escuro). Dados e mapa **fictícios** (arte original, sem tiles).
- Screenshots dos mockups: [`screens/`](screens/) · da auditoria do app atual: [`audit/`](audit/).
- As capturas dos três sites de referência ficam **só localmente** (`refs/`, ignoradas pelo git): são material de estudo interno, não serão publicadas nem reproduzidas (sem marca, logo, texto ou arte).

## 1. Resumo executivo

| | Hoje | Proposta |
|---|---|---|
| Desktop | Mapa 80 % + painel de **20 %** (≈ 240 px) à direita; sidebar de 224 px | Mapa de tela cheia, **painel flutuante único de 416 px** (consulta → resultado no mesmo painel) e *rail* de 76 px |
| Mobile | Mapa fixo de 30 vh em cima, formulário/resultado rolando embaixo | Mapa tela cheia + **bottom sheet** com 3 alturas (peek/half/full) e barra de abas inferior |
| Resultado | 4 abas (Pedágios / Combustível / Pontos / Alternativas) quebradas em 2 linhas | **Total em destaque** (combustível + pedágios), alternativas como cartões, **acordeões** e praças numeradas iguais aos pinos do mapa |
| Tema escuro | `filter: brightness()` no canvas + 13 cores literais no TS do mapa | **Tokens semânticos** lidos pelo CSS *e* pelo MapLibre; estilo de mapa por tema |

**Direção recomendada: A — "Mapa-primeiro, painel único"** (pega o fluxo de mapa + painel de Rotas Brasil/QualP e a "conta" de uma linha do Mapeia).
**Alternativa: B — "Custos em primeiro plano"** (página de resultado em grade, com tabela comparativa; mapa como cartão).

## 2. Pesquisa das referências

Método: Playwright (perfil descartável, dentro de `agentop run --rm`) abrindo cada site em 1440×900 e 390×844, calculando **São Paulo → Rio de Janeiro** e lendo estrutura e texto. Observações de 22/11/2026; os sites mudam, e os valores deles **não** foram usados nos mockups (os nossos são fictícios).

### 2.1 Mapeia (`mapeia.com.br`)
- **Estrutura:** painel esquerdo estreito (320 px) com logo, origem, destino, botão de inverter, R$/litro, km/litro e **"Mapear"**; mapa Leaflet ocupa o resto. Aviso de cookies em cima do painel.
- **Resultado:** *uma linha*: ícones de tempo e distância e a **conta "combustível + pedágio = total"** (`90,07 + 29,20 = R$ 119,27`). Pedágios aparecem como **ícones no mapa**; sem lista de praças, sem alternativas visíveis.
- **Mobile:** o mesmo painel vira cabeçalho no topo e o mapa fica embaixo (sem bottom sheet).
- **Fortes:** mínimo de atrito, resultado legível em 1 s, a *equação* explica o total. **Fracos:** estética de formulário crua, sem veículo/eixos, sem detalhe por praça, campos minúsculos, anúncios/cookies competem com o conteúdo.

### 2.2 Rotas Brasil (`rotasbrasil.com.br`)
- **Estrutura:** barra superior com navegação (Home, Notícias, Serviços, Contato, Entrar); **painel azul esquerdo de 350 px** com seletor de veículo (carro/caminhão/ônibus/moto + eixos), origem/destino (com inverter e "+" de parada), "calcular volta", R$/litro, km/litro, "Opções de trajeto", botões **Buscar / Limpar**; mapa OpenLayers com controles à esquerda (recolher painel, tela cheia, camadas). Banner publicitário abaixo do formulário.
- **Resultado:** **cartões de alternativas** dentro do painel: tempo em destaque, "via Rodovia…", km e linha `R$ pedágio + R$ combustível = R$ total`; ícones P (pedágio), i, compartilhar; o mapa mostra um *balão* com o mesmo resumo e pinos "P" nas praças.
- **Mobile:** painel azul empilhado no topo, resultados logo abaixo, mapa atrás de um botão (ícone de mapa na barra).
- **Fortes:** **veículo e eixos como primeira classe**, alternativas comparáveis lado a lado, mesma fórmula em todo lugar. **Fracos:** painel saturado e denso, publicidade no meio do fluxo, tipografia pequena, mapa só é visível por demanda no celular.

### 2.3 QualP (`qualp.com.br`)
- **Estrutura:** painel flutuante branco no canto do mapa (Leaflet): A/B com ícone de importar planilha, inverter e "+" de parada; seletor de veículo (caminhão/carro/ônibus/moto) com eixos; **consumo e preço em campos lado a lado**; data retroativa; "calcular volta"; **rádios "Rota eficiente / curta / evitar pedágios"**; botão preto **CALCULAR**. Barra superior flutuante com produtos (calculadora de frete, API, planilhas).
- **Resultado:** o painel vira **resumo recolhível** (A/B + chevron), **abas ROTA 1 / ROTA 2** com km e R$, barra de ações (Excel, salvar, PDF, compartilhar…), tabela **Duração / Distância / Pedágio / Pedágio por eixo / Combustível / Custo total**, CTA "Enviar para motorista" e a seção **Praças de pedágio (N)** com tarifa e "(R$ por eixo)", chips "Free Flow/Balsas" e interruptor de exibição; pinos numerados/ícones $ no mapa e *popover* por praça.
- **Mobile:** mapa cheio, cabeçalho com A/B **colapsado**, **bottom sheet** com abas de rotas (ROTA 1 / 2) e total; menu hambúrguer.
- **Fortes:** **melhor modelo mobile** (mapa cheio + sheet), detalhe por praça e por eixo, painel que troca de "formulário" para "resultado" sem trocar de página. **Fracos:** muito poder para pouco espaço (ícones sem rótulo), modais promocionais ao abrir, anúncios, preto/laranja/azul sem sistema, número "0,00" de combustível por padrão induz erro.

### 2.4 Síntese: o que cada um ensina

| Padrão | Mapeia | Rotas Brasil | QualP | Adotar? |
|---|---|---|---|---|
| Painel + mapa como base | ✔ | ✔ | ✔ | **Sim** (A) |
| Resultado em 1 linha com a conta | ✔✔ | ✔ | — | **Sim**: "combustível + pedágios = total" vira o *hero* |
| Cartões de alternativas | — | ✔✔ | ✔ | **Sim** |
| Veículo/eixos em destaque | — | ✔✔ | ✔✔ | **Sim** (controle segmentado) |
| Praças com tarifa por eixo | — | — | ✔✔ | **Sim**, numeradas = pinos |
| Sheet no celular | — | — | ✔✔ | **Sim** (3 alturas) |
| Painel recolhível / consulta colapsada | — | ✔ | ✔ | **Sim** |
| Publicidade/modais no fluxo | ✔ | ✔ | ✔ | **Não** |
| Ícones sem rótulo | — | ✔ | ✔ | **Não** (a11y) |

## 3. Auditoria do layout atual (`apps/web`)

Capturado em modo demo (`VITE_DEMO_MODE=true`, fixtures; sem API, sem segredos), dentro de `agentop run --rm`. Arquivos em [`audit/`](audit/): `{desktop,mobile}-{light,dark}-{1-form,2-form-filled,3-result,3-result-full,4-combustivel,4-pontos,4-alternativas}.png`. Script: `tools/audit.mjs`. QAs anteriores consultados em `docs/qa/*`.

| # | Achado | Evidência |
|---|---|---|
| A1 | **Painel de 20 %**: `md:w-1/5` (≈ 240 px em 1440 px). Campos truncam ("Cidade, estado ou enc…"), nomes de praça cortam ("Moreira C…", "Viúva Gr…"). | `AppShell.tsx` (`md:w-4/5` mapa / `md:w-1/5` painel); `audit/desktop-light-1-form.png`, `…3-result.png` |
| A2 | O CSS desfaz o layout dos módulos com `!important` no `.map-content-panel` (força 1 coluna em `fieldset`, `.grid-cols-2`, etc.) — dívida que cresce a cada módulo. | `index.css` (bloco `@media (min-width:768px)`) |
| A3 | **Sidebar de 224 px** consome 15 % da largura para 5 itens; ainda por cima o rótulo "modo demonstração" é âmbar e compete com o CTA âmbar. | `AppShell.tsx`; `audit/desktop-light-1-form.png` |
| A4 | **Abas em 2 linhas** (`basis-[45%]`): "Pontos na rota" e "Alternativas" perdem o estilo de aba; o estado ativo some. | `ResultScreen.tsx`; `audit/desktop-light-3-result.png` |
| A5 | **Total de custos não existe como número**: a tela mostra 4 cartões (distância, tempo, pedágios, combustível) e o total só aparece no rodapé da aba Pedágios. | `SummaryRow.tsx`, `TollsPanel.tsx` |
| A6 | **Mobile**: mapa fixo de 30 vh ocupa o topo com a barra de navegação; formulário e resultado dependem de rolagem; "Login indisponível" transborda a barra; Mapa e painel disputam o mesmo scroll. | `audit/mobile-light-1-form.png`, `…3-result.png` |
| A7 | **Tema escuro do mapa é um filtro CSS** (`brightness(.78) saturate(.85)`): o mapa continua claro/saturado, rótulos e pinos sem contraste próprio. | `index.css` (`.dark .maplibregl-canvas`); `audit/desktop-dark-3-result.png` |
| A8 | **Cores fixas fora dos tokens** (quebram no escuro): 10 HSL em `core/map/layers.ts:45-49` (pino + anel), `#0b3a52`/`#f6a723` e `rgba(0,0,0,.35)` em `core/map/MapCanvas.tsx:69,154,161` (**13 literais**) + classes de paleta do Tailwind: `bg-amber-400 text-amber-950` (`AppShell.tsx:103`), `border-emerald-200 bg-emerald-50` nos 4 diálogos "Salvar…" (`*SaveXToTripDialog.tsx:216/230`) e `bg-white` em `PointsPanel.tsx:52`. Total na ordem das ~17 ocorrências citadas pelo dono. | `grep` no código |
| A9 | Paleta atual é coerente (petróleo + âmbar de sinalização), mas **sem papéis semânticos** para custo (combustível/pedágio), estado (sucesso/aviso) ou mapa; o `--primary` dá a mesma cor à sidebar e aos títulos. | `index.css`, `tailwind.config.js` |
| A10 | Pontos positivos a **preservar**: marcas "qual**roteiro**" e âmbar para a ação; registry de módulos (`core/registry`) gera a navegação; mapa montado uma vez no shell (`mapStore`); semântica a11y (combobox/listbox, `role="status"`, nomes acessíveis testados). | testes em `AppShell.test.tsx`, `rotaCustos.test.tsx` |

## 4. Princípios da proposta

1. **O mapa é o produto; o painel é o instrumento.** Mapa sempre visível; nada de mapa "sob demanda".
2. **Uma conta, um número.** O total (combustível + pedágios) é o primeiro dado do resultado; o resto explica o total.
3. **Pedágio por praça é diferencial.** Lista e pinos usam os mesmos números e a mesma cor.
4. **Veículo e eixos entram cedo** (alteram o valor): controle segmentado + eixos, sem esconder.
5. **Cores só por token**, em UI e mapa; claro/escuro é uma troca de variáveis, não de filtros.
6. **Mobile não é desktop espremido**: *bottom sheet* + *tab bar*, alvos ≥ 44 px, sem publicidade no fluxo.
7. Âmbar continua sendo **a ação primária e o traçado da rota** — nada mais.

## 5. Direção A (recomendada) — "Mapa-primeiro, painel único"

Mockups: [`a-consulta`](mockups/a-consulta.html) · [`a-resultado`](mockups/a-resultado.html) · [`a-praca`](mockups/a-praca.html). Prints: `screens/a-*-{desktop,mobile}-{light,dark}[-peek|half|full].png`.

### 5.1 Desktop (≥ 768 px)
```
┌────┬──────────────────────────────────────────────┐
│rail│  ┌─────────┐                         [+][−]  │
│76px│  │ painel  │      MAPA (tela cheia)           │
│    │  │ 416 px  │   traçado âmbar, pinos 1..6      │
│    │  │ flutua  │         ┌ popover da praça ┐     │
│    │  └─────────┘         └──────────────────┘     │
└────┴──────────────────────────────────────────────┘
```
- **Rail 76 px** (ícone + rótulo curto, cor de módulo só no ícone), tema e conta no rodapé. Gerado do registry, como hoje. Recolher o painel: botão-aba na borda; o mapa preenche.
- **Painel único** muda de conteúdo: *Consulta → Resultado → (Praça)*; sem navegar de "tela". Rota `/rota-custos` continua, `/resultado` mantém o estado.
- **Consulta**: linha do tempo origem→destino (pino-anel → quadrado) com inverter e "+ parada"; **veículo segmentado** (Carro/Moto/Ônibus/Caminhão com ícone **e** rótulo); eixos, consumo (km/L), preço (R$/L) em grade 2×2; "Calcular volta"; "Opções de trajeto" em acordeão (evitar pedágios/balsas, mostrar postos); CTA âmbar largo. Origem e destino pré-preenchidos com o último valor salvo.
- **Resultado**:
  1. *Resumo da consulta* (colapsado, com editar);
  2. **Alternativas** em 3 cartões selecionáveis (rótulo, tempo, total); a ativa move o traçado, os pinos e o painel juntos (já é assim hoje: `activeIndex`);
  3. **Hero do total**: R$ grande, barra empilhada combustível × pedágio, legenda com valores, e linha de meta (km · tempo · litros);
  4. Ações: **Salvar na viagem** (CTA âmbar) + compartilhar;
  5. **Acordeões**: *Pedágios · N praças* (aberto), *Combustível*, *Pontos no mapa* (interruptores de camadas);
  6. Praça: linha numerada (mesmo número do pino), nome, concessionária · rodovia · km, tarifa; clique abre **popover** no mapa com tarifa por categoria (a seleção do usuário em destaque) e fonte.
- Dados vazios continuam: "Valor não disponível" e o aviso da ANTT permanecem (texto atual).

### 5.2 Mobile (< 768 px)
- **Mapa tela cheia**, *chip* no topo com origem → destino (toque = editar) e botão de tema.
- **Bottom sheet** com 3 alturas: *peek* (≈ 200 px: resumo + alternativas), *half* (56 %: + total e ações), *full* (lista de praças, combustível, camadas). Alça arrastável + botões acessíveis (`aria-expanded`, foco, `Esc`).
- **Tab bar inferior** com os 5 módulos (≥ 56 px de altura), substitui a barra superior (some o "Login indisponível" estourando).
- Consulta ocupa o sheet em *full*; o mapa mostra os pinos já escolhidos acima.

### 5.3 Prós / contras
**+** Padrão mais próximo do que o público já conhece (QualP/Rotas Brasil/Google); mapa e painel sempre juntos; reaproveita `mapStore`, registry e componentes atuais; o mobile resolve A6.
**−** O sheet é o componente mais caro (gestos, acessibilidade, teclado virtual); o painel flutuante cobre parte do mapa (mitigado com *padding* de enquadramento do `fitBounds`).

## 6. Direção B (alternativa) — "Custos em primeiro plano"

Mockups: [`b-consulta`](mockups/b-consulta.html) · [`b-resultado`](mockups/b-resultado.html) · [`b-praca`](mockups/b-praca.html). Prints: `screens/b-*`.

- **Barra superior** (60 px) com as abas dos módulos (sublinhado âmbar na ativa) substitui a sidebar; conteúdo em largura máxima de 1240 px.
- **Consulta**: *hero* com barra de busca horizontal (origem ⇄ destino · veículo · consumo · combustível · Calcular) sobre mapa discreto; abaixo, "consultas recentes".
- **Resultado como página**: faixa de **4 KPIs** (Total em destaque, Combustível, Pedágios, Tempo·distância) → grade **mapa (cartão) + pedágios por praça** → **tabela "Comparar alternativas"** (melhor total destacado, selecionada com barra âmbar). Barra de ações (salvar/compartilhar) no topo.
- **Mobile**: KPIs empilhados, mapa em cartão de 240 px, praças e comparação em cartões, **barra fixa inferior** com total + Salvar.
- **+** Leitura e comparação muito melhores; ótimo para imprimir/compartilhar; implementação simples (sem sheet, sem painel flutuante); não depende do mapa para entender o custo.
- **−** O mapa vira secundário (e a identidade do produto é "ver a rota"); mais rolagem no celular; a "consulta" e o "resultado" voltam a ser páginas distintas; distância maior do que o usuário vê nas três referências.

### 6.1 Por que A e não B
O público das três referências **calcula rápido e olha o mapa**; A mantém essa memória muscular e entrega o total em uma linha (Mapeia), alternativas (Rotas Brasil) e detalhe por praça com o melhor mobile (QualP). B é a melhor escolha se a prioridade virar **comparar/planejar** (módulos de viagem, exportação). Dá para evoluir A → B depois: o *hero* e os acordeões de A são os mesmos blocos de B (reuso de componentes, ver §8).

## 7. Sistema visual

Fonte única dos valores: [`mockups/assets/tokens.css`](mockups/assets/tokens.css) (canais HSL, compatível com o shadcn atual). Pontos novos em relação a `index.css`:

### 7.1 Cores (claro → escuro)
| Papel | Token | Claro | Escuro | Uso |
|---|---|---|---|---|
| Superfícies | `--bg / --surface / --surface-2 / --surface-3` | 210 20% 97 / 0 0% 100 / 210 22% 95 / 210 20% 91 | 212 26% 8 / 212 22% 12 / 212 18% 16 / 212 16% 21 | fundo, cartão/painel, afundado, hover |
| Texto | `--text / --text-muted / --text-faint` | 209 41% 14 / 209 14% 38 / 209 10% 52 | 210 24% 95 / 210 14% 70 / 210 10% 52 | corpo / apoio (≥ 4,5:1) / só decorativo |
| Marca | `--brand` | 202 80% 22 (petróleo) | 198 72% 62 | títulos, selecionado, total |
| **Ação** | `--accent` | 38 92% 50 (âmbar) | 38 95% 56 | **CTA primário e traçado da rota — nada mais** |
| Foco | `--focus` | 202 80% 36 | 198 80% 66 | anel de foco (3 px, 25 % alpha) |
| Status | `--success / --warning / --danger` (+ `-soft`) | 158 64% 26 / 30 90% 34 / 0 72% 42 | 158 52% 56 / 38 92% 62 / 0 84% 68 | substitui `emerald-*`/`amber-*` fixos |
| Custo | `--cost-fuel / --cost-toll` | 158 64% 30 / 350 66% 44 | 158 52% 56 / 350 82% 70 | barra do total, legendas, pinos |
| Módulos | `--mod-*` | já existentes | já existentes | só *wayfinding*, nunca CTA |
| **Mapa** | `--map-water/land/park/road/road-major/label/label-halo` | 205 55% 84 … | 212 38% 14 … | recolorir o estilo base |
| **Rota/pinos** | `--route`, `--route-casing`, `--route-alt`, `--pin-origin/dest/toll/fuel/stop/ring` | âmbar + casing petróleo; pedágio vermelho; posto verde | variantes +20 % L | substituem os 13 literais |

Regras: texto sobre `--accent` usa `--accent-fg` (≥ 7:1); âmbar **nunca** como cor de texto sobre claro; pino de pedágio é o mesmo vermelho do número da lista; o modo escuro **não inverte** — troca papéis (marca vira petróleo claro, superfícies sobem em luminosidade para criar elevação).

### 7.2 Tipografia
Inter (já em uso), escala 12 / 13 / 14 (base) / 16 / 20 / 24 / 32–40. Pesos 500 (UI), 600 (rótulos), 700–800 (números). `font-variant-numeric: tabular-nums` em **todo** valor monetário/tempo; `letter-spacing: -.02em` em títulos e totais. Total do hero: 36 px/800 (mobile 32). Rótulos de campo 12 px/600 sem caixa-alta forçada (hoje `uppercase` + `tracking-wide` reduz a leitura).

### 7.3 Espaçamento, forma e elevação
Escala de 4 px (4/8/12/16/20/24/32/40); padding de painel 16–20; raios 8/12/16/pill; sombras `--shadow-1/2/3` (painel flutuante = 3). Alvos de toque ≥ 44 px; linhas de lista ≥ 56 px.

### 7.4 Componentes (reuso e novos)
| Componente | Situação | Observação |
|---|---|---|
| `Button` (accent/outline/ghost, `sm`/`icon`) | existe | ajustar altura mínima 44 px |
| `Input`, `Select`, `Label` | existe | acrescentar *unit adornment* (km/L, R$, /L) |
| `PlaceSearch` | existe | manter combobox/listbox; adicionar timeline origem→destino em volta |
| `VehicleProfileForm` | existe | vira `Segmented` + eixos + consumo/preço (2×2) |
| `Segmented`, `Switch`, `Chip` | **novo** (Radix `toggle-group`/`switch`) | |
| `Accordion` | **novo** (Radix) | substitui `Tabs` do resultado; `Tabs` permanece nos outros módulos |
| `AltCard`, `TotalHero`, `CostBar` | **novo** | `rota-custos/panels` |
| `TollRow` (numerada) + `PlazaPopover` | evolui `TollsPanel`/`PlazaDrawer` | número = pino; popover no mapa (desktop) / sheet (mobile) |
| `FloatingPanel` + `BottomSheet` | **novo** (`core/shell`) | um componente, dois modos por breakpoint |
| `Rail` / `TabBar` | evolui `AppShell` | ainda gerados do registry |

### 7.5 Mapa claro e escuro
- **Problema** (A7/A8): um filtro CSS escurece pixels (inclusive o contraste dos rótulos) e os pinos/traçado têm cor fixa.
- **Proposta:**
  1. Um módulo `core/map/theme.ts` lê os tokens (`getComputedStyle(documentElement)`) e devolve `{route, casing, routeAlt, pins{…}}`; `MapCanvas` usa isso para marcadores e camadas e **reage à troca de tema** (`MutationObserver` em `class`/`data-theme`, `setPaintProperty` — sem recriar o mapa).
  2. **Estilo-base por tema:** claro = `liberty` atual; escuro = estilo escuro **de verdade** (ver decisão D3). Remover `.dark .maplibregl-canvas { filter }`.
  3. Controles e atribuição do MapLibre estilizados só com tokens (já parcialmente em `index.css`).
  4. Pinos viram `<button>` com forma redundante à cor (círculo = parada/pedágio numerado, quadrado = destino) para daltonismo; mantêm `aria-label` atual (há testes).

## 8. Plano de implementação em fases

Cada fase é uma PR pequena, mantendo `pnpm -r typecheck && pnpm -r test` verdes (há testes por nome acessível em `AppShell.test.tsx` e `rotaCustos.test.tsx` — **QA com modelo diferente do autor**, conforme o AGENTS do repositório).

| Fase | Entrega | Arquivos principais | Pronto quando | Esforço |
|---|---|---|---|---|
| **F0 — Tokens e tema** | Novos tokens em `index.css`/`tailwind.config.js` (status, custo, mapa, pinos); trocar `emerald/amber/white` por tokens; `core/map/theme.ts`; marcadores/traçado por token; estilo escuro | `index.css`, `layers.ts`, `MapCanvas.tsx`, `AppShell.tsx:103`, 4 diálogos, `PointsPanel.tsx` | `grep` sem cor literal fora de `tokens`; screenshots claro/escuro do mapa sem filtro; testes verdes | M |
| **F1 — Shell** | *Rail* 76 px + *TabBar* mobile; mapa tela cheia + `FloatingPanel` 416 px; remover `.map-content-panel` e os `!important` | `AppShell.tsx`, `index.css`, `AppShell.test.tsx` | sem regras `!important` de layout; 4 módulos continuam renderizando; recolher/expandir painel persistido | M |
| **F2 — Consulta** | Timeline origem→destino, inverter, veículo segmentado, grade consumo/preço, opções em acordeão | `NewQueryScreen.tsx`, `VehicleProfileForm.tsx`, `ui/*` | validação 422/campo preservada; sem truncar placeholders a 1440 px e 390 px | M |
| **F3 — Resultado** | `TotalHero`, `AltCard`, acordeões, `TollRow` numerada, `PlazaPopover`; pinos numerados | `ResultScreen.tsx`, `panels/*`, `PlazaDrawer.tsx`, `layers.ts` | total = combustível + pedágios; número da praça = pino; "Valor não disponível" mantido | L |
| **F4 — Bottom sheet** | `BottomSheet` com 3 alturas, gesto + teclado, `visualViewport` para teclado virtual; padding do `fitBounds` | `core/shell`, `MapCanvas.tsx` | 3 alturas navegáveis só com teclado; foco preso corretamente; sem salto com teclado virtual | L |
| **F5 — Polimento** | Auditoria a11y (contraste ≥ 4,5:1, foco, alvos 44 px), e2e Playwright claro/escuro desktop/mobile, `prefers-reduced-motion`, remover código morto | `apps/web/e2e`, docs/qa | relatório QA em `docs/qa/<data>-layout-v2` com screenshots | M |

Riscos: (1) sheet/gestos — avaliar biblioteca pronta vs. própria (D4); (2) estilo escuro do mapa depende de provedor (D3); (3) mudar `Tabs`→`Accordion` quebra testes por nome — atualizar junto; (4) `fitBounds` precisa de *padding* dinâmico por painel/sheet.

## 9. Decisões em aberto para o dono

| # | Decisão | Recomendação |
|---|---|---|
| D1 | **Direção** A (recomendada) ou B? Ou A no app e B só como página "Comparar"/exportar? | A |
| D2 | Manter a identidade petróleo + âmbar? (a proposta mantém, só adiciona papéis semânticos) | Manter |
| D3 | **Estilo de mapa escuro:** (a) recolorir o estilo da OpenFreeMap em tempo de execução com os tokens (sem novo provedor; **a confirmar** que os estilos `positron/bright` aceitam o recolorimento), (b) estilo escuro de terceiros (ex.: CARTO/MapTiler/Protomaps — pode exigir chave no cofre `vault://…` e checagem de termos de uso), (c) manter o filtro CSS. | (a); (b) se (a) ficar feio |
| D4 | **Bottom sheet:** implementar próprio (zero dependência) ou adicionar biblioteca (ex.: `vaul`)? | Próprio, pequeno (3 alturas) |
| D5 | Tabs → Accordion no resultado afeta testes/atalhos já usados; aceitável? | Sim |
| D6 | Mostrar "Postos" por padrão (camada hoje ligada)? Sugestão: desligada, para não poluir o total | Desligada |
| D7 | Rótulo das alternativas ("Mais rápida / Equilibrada / Sem pedágio") depende de a API devolver critério; senão derivar por menor tempo/menor custo | Derivar no cliente |
| D8 | "Consultas recentes"/"Compartilhar" (usados em B) não existem hoje: fora do escopo desta proposta ou backlog? | Backlog |

## 10. Reprodução

```bash
# Dentro do agentop (nunca nas portas 47291/47292); pacotes do workspace precisam de build
agentop run --rm -- sh -c 'pnpm install --frozen-lockfile && pnpm --filter "@qualroteiro/fuel" --filter "@qualroteiro/tolls" --filter "@qualroteiro/geo" build'
node docs/design/2026-11-layout-proposta/tools/build-mockups.mjs      # regenera os HTML
agentop run --rm -- sh -c 'cd apps/web && node ../../docs/design/2026-11-layout-proposta/tools/shoot-mockups.mjs'
agentop run --rm -- sh docs/design/2026-11-layout-proposta/tools/run-audit.sh   # sobe vite em modo demo e roda tools/audit.mjs
```
Os scripts usam o Chrome instalado apenas com **perfil descartável** e `--use-mock-keychain`; nenhum perfil/credencial do dono. Segredos (`apps/*/.env`) não foram lidos nem impressos. `tools/refs*.mjs` são os capturadores das referências (saída ignorada pelo git).
