# QA — Layouts A/B (fase F11)

**Data:** 2026-11-22 · **Branch:** `feat/layout-f11-e2e` (inclui os commits de F1–F10 até o merge das PRs deles)
**Autor desta rodada:** Claude Sonnet 5.5. **Revisão independente por outro modelo: pendente** (regra do plano; o
autor não pode ser o QA). Este documento é o material para essa revisão — os testes e JSONs de auditoria são
reproduzíveis (seção 8).

**Veredito (do autor):** **Passa**, com as ressalvas da seção 7. 34/34 E2E verdes em 2 execuções seguidas; suíte web
348/348 em 3 execuções; auditorias de contraste de texto, alvos de toque (mobile) e foco sem falhas após os ajustes
da seção 3.

## 1. Escopo e método

- **E2E Playwright** (`apps/web/e2e/layout-{a,b}.spec.ts`, config `playwright.layout.config.ts`): 1 worker, dev server
  em **modo demo** (`VITE_DEMO_MODE=true`), porta alta própria (5291), Chrome com perfil descartável e
  `--use-mock-keychain`, dentro de `agentop run --rm`. Para cada layout × {desktop 1440×900, mobile 390×844} ×
  {claro, escuro}: calcular SP→RJ, conferir total (R$ 310,72), abrir uma praça, conferir que o número de cada pino é o
  da lista, e as auditorias. **B:** pinos e prévia antes do Calcular. **A:** sem prévia. **A→B→A em Ajustes** (desktop
  e mobile) sem recarregar (`page.on('load')` conta 1), um único `.maplibregl-map` (o mesmo nó DOM), resultado preservado.
- **Auditorias** (`e2e/layout-audit.ts`, resultado em JSON): contraste de **texto** (WCAG 1.4.3: 4,5:1; 3:1 para texto
  grande), alvos interativos ≥ 44 px, foco visível por Tab (`:focus-visible` com outline ou box-shadow).
- **Contraste real sobre o mapa renderizado** (`e2e/layout-map-contrast.ts`) — a ressalva em aberto desde F0/F3: captura
  do mapa (só mapa, sem painéis/controles), cores dominantes do mapa-base fora da vizinhança do traço, contraste do
  traço/contorno (opacidade real 0,9) e dos pinos (texto × preenchimento; preenchimento × mapa).

## 2. Resultados funcionais

| Item | Resultado |
|---|---|
| A e B × desktop/mobile × claro/escuro: calcula SP→RJ, total, abre praça | 8/8 verdes |
| Pino de cada praça mostra o mesmo número da lista (1…6) | verde nos 8 |
| B: pinos de origem/destino e prévia desenhada (chip "≈ 430 km · 5 h 43", pixels de `--route-alt`) antes do clique | 4/4 verdes; sem `Resultado da rota` |
| A: nenhuma prévia antes do Calcular | 4/4 verdes |
| Trocar A→B→A em Ajustes sem reload, 1 mapa, resultado preservado | 2/2 verdes |
| Estabilidade E2E: 2 execuções completas | 34/34 e 34/34 (3,8–3,9 min); nenhuma falha, nenhum *flaky* |

Capturas: `docs/qa/2026-11-layout-ab-qa/` (`{a,b}-{desktop,mobile}-{light,dark}-resultado.png` e
`b-*-previa.png`).

## 3. Defeitos encontrados pelas auditorias e corrigidos nesta fase

1. **Dark: logo e navegação ilegíveis na barra do B e na tab bar do A (mobile).** A barra usava `bg-primary`, que no
   escuro é o azul-ciano claro; o texto "roteiro" (âmbar) ficou a **1,30:1** e a navegação inativa a **3,94:1**.
   Correção: classe `app-sidebar` (cor de sidebar, como o Rail do A) em `TopBar` e `TabBar`; teste em
   `ShellB.test.tsx` e `TabBar.test.tsx`.
2. **Alvos < 44 px no mobile:** `Button` `icon` (36 px) e `sm` (32 px) → `max-md:h-11`/`max-md:w-11`; zoom do MapLibre
   (29 px) → 44 px abaixo de 768 px; pinos (16/24 px) ganham área de toque de 44 px por `::after` invisível
   (`.map-pin`, mobile). Testes: `button.test.tsx`, `MapCanvas.test.tsx`, `QueryForm.test.tsx`.
3. Pino numerado: o mapa exibia o índice 0-based que o `RotaCustosLayout` publicava, enquanto a lista começa em 1.
   Corrigido no publicador (`índice + 1`); decisão em `docs/decisions/0003-layout-a-b.md`.

## 4. Contraste de texto, alvos e foco (após as correções)

| Combinação | Textos medidos | Falhas de contraste | Alvos medidos | Alvos < 44 px | Elementos focados | Sem foco visível |
|---|---|---|---|---|---|---|
| a · desktop · claro | 41 | 0 | 29 | 13 | 34 | 0 |
| a · desktop · escuro | 41 | 0 | 29 | 13 | 34 | 0 |
| a · mobile · claro | 39 | 0 | 29 | **0** | 34 | 0 |
| a · mobile · escuro | 39 | 0 | 29 | **0** | 34 | 0 |
| b · desktop · claro | 53 | 0 | 27 | 13 | 32 | 0 |
| b · desktop · escuro | 53 | 0 | 27 | 13 | 32 | 0 |
| b · mobile · claro | 50 | 0 | 23 | **0** | 28 | 0 |
| b · mobile · escuro | 50 | 0 | 23 | **0** | 28 | 0 |

No desktop o teste **não exige** 44 px (ponteiro preciso); as 13 ocorrências são: Ajustes e tema (36 px), "Nova consulta"
(32 px), zoom (29 px), pinos (16/24 px). Todas ≥ 24 px (WCAG 2.5.8 AA), exceto os pinos de origem/destino (16 px) — são
marcadores, com nome acessível, e no mobile têm área de 44 px. O teste de alvos só falha no mobile.

## 5. Contraste real de rota e pinos sobre o mapa (ressalva F0/F3)

Alvos: gráficos ≥ 3:1 (WCAG 1.4.11); texto do pino ≥ 4,5:1. Medido sobre os pixels renderizados (OpenFreeMap `liberty`
recolorido), pior caso entre as cores dominantes do mapa-base:

| Combinação | Traço × contorno | Borda externa (melhor de contorno/traço) × mapa-base | Traço × mapa-base (sem contorno) | Número do pino × preench. | Preench. do pino × mapa |
|---|---|---|---|---|---|
| a · desktop · claro | 5,18 | 6,32 | **1,14** | 6,11 | 5,00 |
| a · desktop · escuro | 10,01 | 6,57 | 6,57 | 5,87 | 3,89 |
| a · mobile · claro | 5,21 | 6,32 | **1,14** | 6,11 | 4,82 |
| a · mobile · escuro | 10,07 | 7,43 | 7,43 | 5,87 | 4,02 |
| b · desktop · claro | 5,19 | 6,32 | **1,14** | 6,11 | 4,14 |
| b · desktop · escuro | 10,01 | 6,57 | 6,57 | 5,87 | 3,89 |
| b · mobile · claro | 5,21 | 6,32 | **1,14** | 6,11 | 4,80 |
| b · mobile · escuro | 10,01 | 6,34 | 6,34 | 5,87 | 3,89 |

**Conclusão: nenhum token precisou mudar** (todos ≥ 3:1 para gráficos e ≥ 4,5:1 para o número do pino). Duas ressalvas
de leitura:
- **Claro:** o traço âmbar sozinho tem só 1,14–1,95:1 sobre a água/terra clara; quem garante a legibilidade é o contorno
  azul-marinho (≥ 6,3:1 com o mapa). Se um dia o contorno sair, o claro reprova.
- **Escuro:** é o inverso — o contorno quase some no fundo escuro (1,2–1,5:1), mas o traço âmbar tem ≥ 6,3:1 sozinho.
- O anel branco/escuro do pino (realce) tem 1,2–1,9:1 contra o mapa; a identificação do pino vem do preenchimento
  (3,9–5,5:1). O preenchimento mais baixo é o do pino de praça no escuro (3,89:1) — acima do mínimo, com pouca folga.

## 6. Tamanho do bundle (build de produção, `vite build`, sem `VITE_DEMO_MODE`)

| Chunk | `origin/main` (kB / gzip) | Esta branch (kB / gzip) |
|---|---|---|
| entrada `index-*.js` | 323,83 / 96,58 | 357,88 / 107,45 (**+34,05 / +10,87**) |
| `react` | 164,05 / 53,50 | 164,05 / 53,50 |
| `maplibre` | 801,64 / 217,60 | 801,64 / 217,60 |
| CSS | 93,14 / 15,11 | 104,09 / 16,90 (+10,95 / +1,79) |
| **Shell A** (`index-B-Dmn7Cl.js`) | — | 9,22 / 3,35 |
| **Shell B** (`index-BoIu3PiW.js`) | — | 3,39 / 1,38 |
| B: `ConsultaHero` + `ResultadoPage` | — | 1,57 + 5,87 / 0,87 + 2,13 |
| compartilhados lazy (`moduleNav`, `useIsMobile`) | — | 3,01 + 0,42 / 1,33 + 0,26 |

**Chunks A e B ficam separados** e só são baixados sob demanda (`React.lazy` por layout). Custo inicial por usuário
(gzip, JS+CSS sobre `main`): **A ≈ +17,6 kB** (entrada 10,87 + shell 3,35 + compartilhados 1,59 + CSS 1,79) e
**B ≈ +18,6 kB** (entrada 10,87 + shell 1,38 + hero/resultado 3,0 + compartilhados 1,59 + CSS 1,79). O crescimento da
entrada (+10,9 kB gzip) é o que é comum aos dois: tokens, mapa temático, registro, `QueryForm`, blocos, primitivos.

## 7. Limites desta verificação (o que **não** foi estabelecido)

- **Revisão independente por outro modelo: não feita** — pendente.
- E2E em **modo demo** (fixtures; uma só alternativa por rota): a **troca de alternativa** não é exercida no E2E; ela é
  coberta pelo teste de unidade `rotaCustos.test.tsx` ("selecting the second alternative…"). Nenhum teste fala com a API real nem
  com o limitador.
- O mapa carregou os **tiles reais do OpenFreeMap** (rede disponível); a medição de contraste depende dos tiles e do
  estilo naquele momento — uma mudança no estilo remoto pode deslocar as cores-base.
- Só **Chrome estável** (macOS, headless); sem Safari/Firefox, sem leitor de tela, sem dispositivo real de toque.
- O contraste foi medido na tela de **resultado**; telas de consulta e modais (Ajustes, drawer de praça) não entraram
  na varredura de texto. Texto sobre gradiente/imagem é **ignorado** pela auditoria.
- Foco visível: confere a presença de anel (`:focus-visible`), não o contraste do anel.
- Pino de 16 px (origem/destino) e controles desktop < 44 px são aceitos conscientemente (seção 4).
- **Prévia ao vivo em produção: não ativar.** Falta o limitador de taxa da API (#68) — pré-requisito registrado em
  `docs/decisions/0003-layout-a-b.md`. Nenhuma flag foi ligada.
- Estabilidade da suíte **web**: 3 execuções em `origin/main` (27 arquivos/191 testes, 36,8–43,6 s, mediana 36,8 s;
  sem falhas) e 3 na branch (60/348, 58,9–66,1 s, mediana 62,7 s; sem falhas). A mediana cresceu +70 %, mas com +82 % de
  testes (0,19 s/teste → 0,18 s/teste); nenhuma assinatura de timeout nova. A carga da máquina variou (7–17) durante as medidas.

## 8. Como reproduzir

```bash
# dentro de `agentop run --rm --`, node 20.19, pnpm do cache do npx
pnpm install --frozen-lockfile --store-dir <fora-do-repo>
pnpm exec turbo run build --filter='./packages/*'
cd apps/web
E2E_REPORT_DIR=/tmp/relatorio E2E_CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  pnpm exec playwright test -c playwright.layout.config.ts      # porta 5291 (E2E_PORT)
pnpm exec vitest run                                            # suíte web
```

Os JSONs `audit-*.json` e `mapcontrast-*.json` saem em `E2E_REPORT_DIR`.
