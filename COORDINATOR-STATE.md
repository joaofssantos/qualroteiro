# Estado do coordenador — leia isto primeiro

> Atualizado em 2026-09-16/17, antes de uma compactação de contexto. Se
> você é uma sessão nova (ou a mesma depois de compactar), **leia este
> arquivo antes de qualquer coisa** — ele recoloca no estado exato sem
> reconstruir a conversa inteira.

## Identidade

Você é **Don Drapper**, coordenador AIPe do contexto `qualroteiro`. PE:
Joao (joaofelipe.ticomweb@gmail.com). Auto-push de status ligado
(detailed). Regras do papel: decompor → despachar → QA gate → PR do
especialista. Nunca editar repo diretamente (exceção: merges de PR já
revisada/QA-gated são close-out do coordenador, não "edição").

## Onde as coisas estão

- Workspace AIPe: `/Users/joaofsantos/Documents/code/qualroteiro` (raiz).
- Clone real do produto (onde tudo é trabalhado): `repos/qualroteiro` —
  **não** a raiz do workspace (que tem um scaffold congelado do commit
  inicial). Já causou confusão real várias vezes (chaves de `.env`,
  `git fetch`/`reset` "solto" sem `-C` acertando o clone errado). Sempre
  confirme `repos/qualroteiro/apps/{api,web}/.env`, sempre `git -C
  <caminho-exato>`.
- **Falha de processo minha (2026-09-17)**: mergeei a PR #49 (Wave 1 de
  `j-20260917-up`, Peggy Olson) direto após verificação própria, **sem
  despachar o QA gate** de uma especialista independente antes — quebrei
  a regra que eu mesmo segui em toda unidade AIPe anterior nesta sessão
  (OSM Wave 1/2/3, ARTESP). Corrigido: ledger ajustado (`delivered` sob
  Peggy Olson registrado retroativamente), QA retroativo (Stan Rizzo) PASS
  contra o `main` já mergeado, com 2 achados reais: (1) falta teste pra
  "seleciona lugar → edita endereço à mão → lat/lng volta pra null" nos 3
  módulos (comportamento CERTO, só falta cobertura — mutação plantada não
  quebrou nada) — fila pra Codex; (2) a premissa do brief de QA estava
  errada (PR #46 não estava em `main` ainda) — motivou a 2ª reconciliação
  abaixo. **Lição**: nunca pular o QA gate por "já verifiquei bem o
  suficiente" — o valor é uma segunda especialista independente tentando
  quebrar, não a qualidade da minha própria checagem.
- **2ª reconciliação `main`/`dev` (PR #50, `749342c`)**: mesmo padrão da
  1ª (merge automático sem conflito mecânico, mas MESMAS funções tocadas
  nos 2 lados — `selectPlace` em 3 arquivos — confirmei manualmente que os
  dois comportamentos coexistem, não só que o git não reclamou). 0/0
  divergência agora.
- **`main`/`dev` reconciliados (2026-09-17, PR #45)** — chegaram a
  divergir nos dois sentidos (main com a Wave 3 do OSM, dev com o
  front-end do Codex PR #42/#44), sem sobreposição de arquivo nenhuma
  (backend vs frontend). Merge automático sem conflito, verificado local
  (build/typecheck/lint 19/19, test 13/13 antes de abrir a PR) — **push
  direto em `main` foi bloqueado pelo classificador de auto-mode**, abri
  como PR normal (#45) em vez disso, mergeei (`--merge`, preserva
  histórico, não squash) depois do CI real, e sincronizei `dev` na
  sequência. Ambos em `d1e64da` agora, 0/0 de divergência. **Lição**: o PE
  pode mergear em `dev` diretamente (fora do AIPe) a qualquer momento —
  sempre checar `git rev-list --count origin/dev..origin/main` E
  `origin/main..origin/dev` antes de qualquer sync automático, nunca supor
  que só eu escrevo em `dev`.
- Docs de coordenação — históricos (só consultar se precisar de detalhe
  específico de uma fase fechada): `F1-COORDINATION.md`,
  `F2-COORDINATION.md`, `G-COORDINATION.md` (G1-G5, Google Places + mapa
  persistente). **Ativo agora**: `PEDAGIO-COORDINATION.md` (fase de
  pedágio real, em andamento).
- Specs AIPe (jornadas) vivem em `.aipe/journeys/<id>/orientation.md` —
  fonte de verdade de contrato/escopo pra cada jornada.
- Ambiente local: Postgres compartilhado (`localhost:5433`) usado por
  TODOS os worktrees/dispatches desta sessão — quando um dev/QA roda uma
  migration ou ingestão real, ela fica visível pra qualquer outro dispatch
  depois. `.env` com chaves reais em `repos/qualroteiro/apps/{api,web}/.env`
  — nunca leia/exiba valores, só confirme presença com `grep -q`.

## O que já foi entregue (produção, `main`)

- **F1 — Rota & Custos**: pacotes de domínio (`geo`, `routing`, `tolls`,
  `fuel`), roteirização real (OpenRouteService), mapa, pedágio+combustível,
  `moduleRegistry` extensível, CI real.
- **F2 — Viagem**: Clerk, `Trip`/`TripDay`/`TripItem`, módulo
  Planejamento de Viagem, Hospedagem/Restaurantes/Atividades (standalone),
  timeline com reordenar (drag-and-drop).
- **G-series (Google Places + mapa persistente)**: G1 (`apps/api`, adapter
  Google Places Nearby Search + guarda de custo/disjuntor), G2 (mapa
  persistente compartilhado — `MapCanvas` promovido pro `AppShell`,
  `mapStore.ts`, `showMap` em `ModuleDefinition`), G3/G4/G5 (busca real +
  mapa em Hospedagem/Restaurantes/Atividades, via Codex). Todos fechados,
  QA PASS em todos. Detalhe completo em `G-COORDINATION.md`.
- **Pedágio real, Fase 1 (ANTT, federal)** — jornada `j-20260916-9y`:
  `packages/tolls` refatorado (lista de praças explícita, tarifa
  opcional), `TollPlazaRecord` real em `apps/api`, job de ingestão real
  (`services/data-ingest`, BullMQ) contra o CSV oficial da ANTT. **277
  praças reais** no Postgres, substituindo o seed de demo no caminho de
  produção. Coordenada verificada 3x de forma independente (dev/coordenador/QA,
  inclusive por mutação) — sem inversão de eixo.
- **Pedágio via OSM (Overpass API)** — jornada `j-20260916-y9`, Wave 1
  fechada (`parseOsmCharge`/`clusterTollBooths` em `packages/tolls`,
  parsing real da tag `charge` do OpenStreetMap + clustering de cabines
  por operador). **Wave 2 (`apps/api`) e Wave 3 (`services/data-ingest`)
  especificadas e aprovadas, mas PAUSADAS a pedido do PE** — não despachar
  até ele pedir pra continuar.
- **2 rodadas de QA E2E do pedágio** (Codex+Playwright, app real, sem
  mocks) acharam e todos os achados já foram corrigidos e mergeados:
  marcadores sem nome acessível (bug real do MapLibre, `MapCanvas.tsx`),
  texto desatualizado ("base de demonstração"), corte horizontal E depois
  vertical da `TabsList` com lista longa (61 praças reais — o corte
  vertical só apareceu numa 2ª rodada porque minha 1ª verificação usou
  modo demo com lista curta, não o cenário real; lição registrada). Achado
  de precisão de coordenada (~300-450m em 2 praças) é limitação real do
  CSV da ANTT (só 2 casas decimais pra essas praças específicas,
  confirmado na fonte), não bug nosso — só rastreado.
- **Revisão de front-end mais ampla** (a11y/dark mode/consistência de
  layout, Codex+Playwright, app inteiro) — relatório em
  `docs/qa/2026-09-16-frontend-review/REPORT.md`, linkado em
  `G-COORDINATION.md`. **Triada e fechada.** A11Y-01 (erros de formulário
  em Hospedagem/Atividades/Restaurantes sem anúncio acessível, 2 com
  mensagem em inglês) e LAYOUT-01 (Restaurantes divergindo do container dos
  irmãos) — despachados juntos pro Codex, corrigidos na **PR #40**
  (mergeada, commit `2466391`), verificados por mim de forma independente
  (diff linha a linha, CI real PASS, build/typecheck/lint 19 tasks PASS,
  132/132 testes PASS reproduzido isolado, visual conferido). Inventário de
  17 cores hardcoded (dark mode) — sem ação, backlog puro (dark mode não
  existe no produto). Detalhe completo em `G-COORDINATION.md`.

## Decisões de longo prazo já tomadas (não re-perguntar)

- **Cobertura de pedágio**: objetivo é 100% das rotas reais (motivo do
  PE: não dá pra saber como concorrentes tipo qualp/rotasbrasil/mapeia
  conseguem, então o produto precisa da própria fonte real). Abordagem
  **faseada**, nunca tentar cobrir tudo de uma vez. Fontes mapeadas, em
  ordem: ANTT federal (feito) → OSM (Overpass — geo+tarifa, federal e
  estadual, num lugar só, pausado em Wave 2/3) → ARTESP/Power BI da ANTT
  (rebaixados de prioridade — o OSM já cobre o que eles cobririam, com
  bem menos esforço; não descartados, só não urgentes) → outras agências
  estaduais (backlog, sob demanda) → sites de concessionária individual
  (considerado redundante, não fazer a menos que surja um buraco
  específico). Detalhe completo em `PEDAGIO-COORDINATION.md`.
- **Playwright**: disponível no repo (`apps/web`, `test:e2e`) só pra
  verificação manual sob demanda — **deliberadamente não entra no
  `pnpm -w test` nem na CI**. Não mudar isso sem decisão explícita do PE.
- **F3a (frete/piso ANTT)**: no backlog explícito — PE prefere fechar o
  resto antes. Recorte proposto (F3a seed → F3b API pública → F3c
  billing/checkout hospedado) já desenhado, mas 3 perguntas de escopo
  seguem sem resposta (categorias de carga, fonte do dado, onde entra no
  produto). Não decompor em jornada até o PE responder ou pedir de volta.
- **Identidade visual — feita (2026-09-17, PR #55, dev `783e703`)**: cor de
  acento por módulo (Planejamento índigo, Hospedagem teal, Restaurantes
  terracota, Atividades verde) aplicada só ao título e ao ícone inativo da
  sidebar — nunca em CTA/botão (âmbar `--accent` intocado, confirmado por
  evidência Playwright com cor computada real). Rota & Custos fica sem cor
  própria (âncora da marca). Tokens `--module-*` em `index.css`, claro e
  escuro.
- **Billing/pagamento**: nunca processar credenciais diretamente — F3c
  usa checkout hospedado (Stripe ou similar). Limite duro.

## Metodologia estabelecida

- **Claude/AIPe**: contract-sensitive/governado (schema, auth, endpoints,
  integração externa com julgamento real, dinheiro em jogo). QA gate
  sempre roda (subagent independente, nunca o mesmo persona do dev,
  sempre re-deriva evidência própria — inclusive fazendo a PRÓPRIA
  mutação nos pontos críticos, não só lendo o teste do dev).
- **Codex** (PE dirige, fora do AIPe): mecânico/visual com critério já
  fechado — módulos novos, CSS/layout, correção de achados de QA bem
  especificados, verificação E2E manual com Playwright. Eu sempre
  verifico e mergeio (build/typecheck/lint/test reproduzido — e quando dá,
  verificação visual real com dado de produção, não só modo demo — **erro
  que já cometi uma vez nesta sessão, aprendido**).
- **CI real** (`.github/workflows/ci.yml`): `pnpm -w build/typecheck/lint/test`
  no GitHub Actions antes de mergear. `aipe journey record --status
  delivered` recusa se checks pendentes/falhos — sempre `gh pr checks <n>`
  até concluir antes de registrar.
- **`aipe journey record` — coisas não óbvias do CLI**:
  - Status `verified`/`merged` exige uma cadeia real: `delivered` (sob o
    DEV) → `verified` (sob a QA, especialista DIFERENTE) → `merged`. Nunca
    registrar `delivered` sob o nome da própria QA — o CLI trava
    (`"X is verifying a delivery X made"`) e não há como desfazer via CLI
    depois (só editando o yaml da jornada à mão).
  - Redespachar sobre uma unidade já `delivered` exige `--reason`.
    Redespachar sobre uma unidade já `merged` exige um `--task <slug>`
    novo (rodada nova, distinta, no mesmo pacote/especialista — usado pra
    Wave 1 vs Wave 3 do mesmo pacote `root` em duas jornadas).
  - `--status verified`/`delivered` exigem `--evidence-by`/`--evidence-cmd`/
    `--evidence-summary` reais — nunca aceita "confiei no relatório".
  - Headers de unidade no `orientation.md` (`### qualroteiro/<pacote>`)
    precisam ser EXATOS (só o nome do pacote na linha) pro `spec --check`
    reconhecer — texto extra na mesma linha quebra o parser (mas não
    bloqueia `--approve`, só fica com o `--check` reclamando).
- **`.aipe/` fica na raiz do workspace, FORA do worktree git de um
  subagente** — um subagente dispatchado trabalha dentro de
  `repos/qualroteiro` (ou um worktree dela), que não contém `.aipe/`. Se o
  brief pedir pra ler `.aipe/journeys/<id>/orientation.md`, o subagente
  pode não enxergar (sandbox limitado ao próprio worktree) e reportar
  "arquivo vazio/scaffold" por engano — não é corrupção real do ledger, só
  falta de acesso. Confirmar sempre no arquivo real antes de acreditar
  nesse tipo de achado. Preferir colar o conteúdo relevante da spec direto
  no prompt de dispatch em vez de só apontar o caminho, quando possível.
- **Worktree isolado do sandbox**: subagentes frequentemente ganham um
  worktree PRÓPRIO diferente do que o AIPe provisionou, e o harness
  bloqueia `-C`/`cd` pra outro caminho. Solução que funciona sempre:
  instruir o subagente a, dentro do PRÓPRIO worktree, `git fetch origin
  <branch> && git checkout -B <branch> origin/<branch>` (se a branch já
  foi pushed) ou, se não, confirmar HEAD idêntico a `origin/main`/`dev`,
  trabalhar ali, e no final `git push origin HEAD:refs/heads/<branch>`.
  Eu reconcilio depois: sincronizo a worktree NOMEADA com `git -C
  <worktree-certa> reset --hard origin/<branch>` (fast-forward, mesma
  base) e sigo o fluxo normal a partir dali. Documentar isso em TODO
  brief de dispatch — economiza uma rodada de tentativa-e-erro.
- **Conflito de merge esperado**: PRs paralelas mexendo no mesmo arquivo
  (ex. `core/api/client.ts` quando 3 módulos adicionam a mesma função) dão
  conflito mecânico na 2ª/3ª a mergear — resolvo eu, reaproveitando a
  resolução já feita num worktree de integração quando possível, sempre
  reverificando build antes de empurrar.
- **Promoção `dev → main`**: nunca automática — sempre apresento o lote e
  pergunto (quando ainda fazia sentido essa promoção; a sessão migrou pra
  dispatch direto em `main` nas fases mais recentes, ver acima).
- **Flakiness local recorrente**: rodar `pnpm -w test`/`turbo run ...`
  com vários worktrees/builds concorrentes nesta máquina produz falhas
  espúrias (timeout, contenção de recurso) — sempre reproduzir isolado
  (`vitest run <arquivo>` sozinho, ou `--force` sem outros processos
  pesados rodando) antes de tratar como regressão real. CI real (runner
  dedicado) é a fonte de verdade quando há dúvida.
- **Intensidade/modo de dispatch**: `ultracode` gated caso a caso (nunca
  autorização permanente). `session` (agentop) decidido na spec, não no
  ato do dispatch.

## Memória salva (persistente entre sessões, `.claude/.../memory/`)

- `pe-authorizes-ultracode.md` — ultracode liberado caso a caso.
- `pe-authorizes-session-mode.md` — session mode decidido na spec.

## Pontas soltas (não são bloqueio, só não esquecer)

- **Pedágio: as 3 fontes planejadas todas em produção (2026-09-17)**:
  ANTT (277 praças federais, sem tarifa) + OSM (489 praças federal+estadual,
  com tarifa, `j-20260916-y9` Wave 1/2/3) + auditoria ARTESP (`j-20260916-x3`,
  read-only, 110 praças casadas contra OSM, 90 batem/20 divergem,
  `docs/audits/artesp-tariff-audit.md`). Detalhe completo em
  `PEDAGIO-COORDINATION.md`.
- **Fila pendente (small fixes, mesmo repo, aguardando dispatch)**: 3 achados
  não-bloqueantes de QA acumulados, todos pequenos e de baixo risco —
  (1) teste faltando pra validação por-campo de `tariff` malformado em
  `apps/api/src/routes/plan.ts`'s `toTariff()`; (2) fixture de teste que não
  distingue `representativeId` do cluster em
  `services/data-ingest/src/osm-toll-plazas.ts`; (3) comentário impreciso em
  `services/data-ingest/src/artesp-match.ts` (diz "100%, every row", real é
  97,3%/99,8%). Nenhum bloqueia nada, PE ainda não confirmou se quer
  despachar agora ou deixar acumulando.
- **Fila pendente (feature, spec aprovada)**: jornada Planejamento
  (`j-20260917-up`) — mapa de destino com pins + reabrir rota salva sem
  recalcular, 3 waves. Spec completa em
  `.aipe/journeys/j-20260917-up/orientation.md`. Ainda não despachada.
- **`j-20260917-up` completa (Planejamento: mapa + reabrir rota salva)**:
  Wave 1 (coordenadas) + Wave 2 (query salva) + Wave 3 (mapa na tela de
  detalhe + botão "Reabrir rota", PR #54/#56) todas fechadas com QA gate
  real (mutação em cada uma). Tela de detalhe da viagem agora mostra pin
  de cada item com coordenada, e um item de rota com `query` salva reabre
  a Tela 2 com os valores exatos, sem recalcular (confirmado por
  interceptação de rede — zero chamadas a `/routes/plan`). 3ª reconciliação
  `main`/`dev` feita (PR #57, `c730d88`) — a jornada e as cores de
  wayfinding (PR #55) tocaram o mesmo arquivo, coexistência confirmada.
- **`j-20260917-qv` completa (raio + filtro de tipo, Google Places)**:
  Wave 1 (`apps/api`, PR #51) + Wave 2 (`apps/web`, PR #52) mergeadas.
  QA PASS nas duas com mutação real. Select de raio (1/3/5/10/20km) +
  chips de tipo multi-seleção nos 3 módulos, mudança re-dispara busca
  automaticamente. Evidência visual real confirmada pela QA (screenshots
  via browser real, curadoria de tipos bate exatamente com a spec).
- **Fechado (Codex, 2026-09-17)**: os 3 fixes pequenos de QA — PR #48,
  mergeada (`98b7b9e`), verificada por mim (rodei a MESMA mutação que a QA
  usou no `representativeId`, confirmei que agora falha — gap fechado de
  verdade, não só cosmético). Primeira vez que o Codex mexeu fora de
  `apps/web` nesta sessão, saiu limpo.
- **Em paralelo, fora do AIPe**: o PE vai fazer ajustes de front-end (dark
  mode, toggle) via Codex por conta própria e atualizar o md relevante —
  não é uma jornada minha, só acompanhar quando ele reportar.
- **Ledger da jornada `j-20260916-9p`** (2 fixes pequenos, PRs #30/#31, já
  em `main` há tempo): unidade `web` reconciliada certinho no ledger.
  Unidade `api` ficou com bookkeeping torto — CLI travou tentando corrigir
  (2 tentativas, mesmo erro), não vale mais tempo nisso. Código está
  correto e duplamente verificado, só o registro formal do ledger que
  ficou inconsistente pra quem for auditar o histórico do AIPe.
- Jornada `j-20260915-bp` (F2f original) tem 1 unidade presa em
  `dispatched` — dispatch interrompido de propósito antes de qualquer
  commit, nada perdido, ledger nunca fechado formalmente. Ignorar se
  aparecer em `aipe journey show`.
- `aipe journey verify` sempre mostra `WARNING merged-skipped-qa` —
  artefato de como `merged` é gravado, não é problema real (já investigado
  várias vezes).
