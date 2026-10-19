# PEDAGIO-COORDINATION.md — Fase 1 (ingestão real de pedágio)

> Doc de coordenação da jornada `j-20260916-9y` (spec completa em
> `.aipe/journeys/j-20260916-9y/orientation.md`). Este arquivo existe pro
> brief que vai pro **Codex** (Wave 2, `apps/web`), mesmo formato usado em
> G3/G4/G5.

## Status geral

| Unidade | O quê | Quem | Status |
|---|---|---|---|
| Wave 1 | `packages/tolls` + scaffold `services/data-ingest` | Claude (Lane Pryce) | **fechado, mergeado em `main`** |
| Wave 2 — api | `apps/api` — schema/store/wiring real | Claude (Pete Campbell) | **fechado, mergeado em `main`** |
| Wave 2 — web | `apps/web` — UI de fallback | Codex | **fechado, mergeado em `main`** |
| Wave 3 | `services/data-ingest` — job de verdade | Claude (Lane Pryce) | **fechado, mergeado em `main`** |

## Contexto que a Wave 2 web precisa saber

Wave 1 (já em `main`) tornou `TollPlaza.tariffByAxleCategory` **opcional**.
Uma praça pode agora chegar na UI sem tarifa (praça real, localização
conhecida, preço ainda não — a Fase 2, tarifas por concessionária, é
separada e não está nesta jornada). Um patch-ponte temporário (`!`
non-null assertions, com `TODO(Wave 2 — j-20260916-9y)`) está segurando o
build por enquanto em 3 arquivos — a Wave 2 web deve **remover essas
asserções** e implementar o fallback de verdade.

## Wave 2 — web (LIBERADO)

**Escopo**: só `apps/web/**`. Os 3 pontos com o TODO (procure por
`TODO(Wave 2 — j-20260916-9y)` no repo pra achar exatamente):
- `apps/web/src/modules/rota-custos/panels/TollsPanel.tsx`
- `apps/web/src/modules/rota-custos/PlazaDrawer.tsx`
- `apps/web/src/modules/rota-custos/RotaCustosLayout.tsx`

Em cada um: remova o `!` e trate `tariffByAxleCategory` (ou
`tariffByAxleCategory?.[axleCategory]`) ausente mostrando **"valor não
disponível"** (ou texto equivalente, coerente com o resto da UI) em vez de
um número — sem quebrar o layout, sem esconder a praça (ela é real, só sem
preço ainda). O total consolidado já vem certo do backend (Wave 2 api pula
praças sem tarifa na soma) — a UI só precisa não quebrar ao renderizar a
linha individual da praça.

Os 3 arquivos de teste que também têm `!` temporário (`demoMode.test.tsx`,
`handlers.test.ts`, `rotaCustos.test.tsx`) devem ser atualizados junto —
remova o `!` e ajuste a asserção pro texto de fallback quando o teste
simular uma praça sem tarifa.

**Aceite**:
- `pnpm --filter @qualroteiro/web build/typecheck/lint/test` verdes.
- Teste: praça mockada SEM `tariffByAxleCategory` renderiza "valor não
  disponível" (ou texto equivalente) em `TollsPanel` e em `PlazaDrawer` —
  não quebra a tela, não mostra `undefined`/`NaN`.
- Teste: praça COM tarifa continua mostrando o valor normal — regressão
  zero.
- Nenhum `!` (non-null assertion) sobrando nos 3 arquivos de produção
  citados nem nos 3 de teste.
- `git diff --name-only origin/main..HEAD` só `apps/web/**`.
- SDD sdd-lite.

**Fora de escopo**: qualquer mudança em `apps/api`/`packages/*`/
`services/data-ingest`. Não implemente nada de "Fase 2" (tarifas reais) —
essa unidade só trata a AUSÊNCIA de tarifa, não busca uma tarifa real.

## Prompt curto pra colar no Codex

```
Implemente a Wave 2 (apps/web) da jornada de pedágio real do repo
qualroteiro, documentada em PEDAGIO-COORDINATION.md, seção "Wave 2 — web".

Branch a partir de main. Abra PR quando os testes estiverem verdes.
```

## Visão de longo prazo (PE, 2026-09-16)

Objetivo declarado: **cobrir 100% das rotas reais** — motivo explícito do
PE: "não conseguimos saber como serviços (qualp, rotasbrasil, mapeia)
conseguem" (cobertura completa), então o qualroteiro precisa construir a
própria fonte de dado real, em vez de depender de adivinhar o que os
concorrentes fazem. Confirmado: abordagem **faseada**, não tentar cobrir
tudo de uma vez.

**Fontes já mapeadas, em ordem de prioridade**:
1. **ANTT (federal)** — dataset de praças (277, CSV oficial) já em `main`
   (Wave 1). Tarifas via o Power BI "TARIFAS DE PEDÁGIO" (ANTT/SUROD,
   achado pelo PE) — 36 concessionárias, tabela por categoria de veículo,
   scraping via automação de navegador (sem export direto, API interna do
   Power BI identificada mas não documentada). Ainda não especificado.
2. **ARTESP (SP, estadual)** — achado real ao investigar o buraco: o
   dataset federal da ANTT NÃO cobre rodovias estaduais (ex. a própria
   Bandeirantes/SP-348, um dos 3 corredores hand-seeded hoje, é estadual).
   ARTESP publica um PDF único e oficial ("Valor Atual das Tarifas",
   `artesp.sp.gov.br/.../pedagios`, ~1.2MB, atualizado dez/2025,
   `GET` direto sem auth) cobrindo todas as concessões estaduais de SP.
   **Re-investigado em 2026-09-17** (baixei e inspecionei o PDF de
   verdade): ~124 praças, formato não uniforme (2-3 colunas por
   concessionária, mais 11 praças com tabela CAT-1..9 numa concessionária
   específica), **zero coordenada** em qualquer lugar do documento. Como
   `TollPlazaRecord.lat`/`lng` são obrigatórios, ARTESP não vira pin novo
   como o OSM — vira um **job de auditoria/cross-check** (casa por
   rodovia+nome contra praças `source: 'osm'` já no Postgres, compara
   tarifa oficial vs OSM, relatório de divergência, sem escrever no
   schema). **Spec escrita e aprovada** —
   [`.aipe/journeys/j-20260916-x3/orientation.md`](.aipe/journeys/j-20260916-x3/orientation.md)
   — mas **bloqueada pra dispatch até a Wave 3 de `j-20260916-y9` (job
   real de ingestão OSM) estar `merged`** (precisa de linha `source: 'osm'`
   real no Postgres pra ter o que comparar).
3. **Outras agências estaduais** (26 estados + DF, cada um com sua própria
   agência/formato) — backlog, entram uma de cada vez, sob demanda (uma
   rota real precisando de uma rodovia fora de ANTT+ARTESP), não uma
   investida de cobertura nacional de uma vez.
4. **Sites de concessionária individual** — considerado redundante com as
   agências (mesmo dado, fonte diferente); só revisitar se uma agência
   específica não publicar o que precisamos.

## Suite de testes E2E — verificação real do pedágio (Codex + Playwright)

> Diferente dos briefs anteriores (implementação): isso é **verificação
> manual/E2E contra o app rodando de verdade**, mesmo papel que o Codex já
> fez no F2 (achou o bug real de reorder via Playwright). Os testes
> unitários de cada Wave já passaram — isso é pra confirmar que a
> experiência real, de ponta a ponta, bate com o que o código promete.

**Pré-requisito**: `apps/api` e `apps/web` rodando localmente, Postgres
com as 277 praças reais da ANTT já ingeridas (`GET
/admin/toll-plazas-status` deve mostrar `count: 277` antes de começar — se
não mostrar, a suíte não é válida, avisar antes de prosseguir).

**Contexto importante pra não confundir bug com comportamento esperado**:
hoje NENHUMA praça real tem tarifa (Fase 1 foi só geo) — toda rota real
deve mostrar pedágio "Valor não disponível" por praça e **total R$ 0,00**.
Isso é o comportamento CORRETO pro estado atual, não reportar como bug.

### Casos a rodar

1. **Rota real que cruza pedágio real** — planeje São Paulo → Rio de
   Janeiro (via Dutra, BR-116). Confirme:
   - Pelo menos 1 marcador de pedágio aparece no mapa em posição
     plausível ao longo da BR-116 (não em outro estado, não no meio do
     oceano — checagem visual grosseira de sanidade geográfica).
   - Clicar num marcador abre o drawer (`PlazaDrawer`) mostrando nome e
     concessionária reais (não "Hotel Atlântico" nem outro texto de demo
     antigo).
   - Toda linha de tarifa no drawer mostra "Valor não disponível" (8
     categorias), sem `undefined`/`NaN`/quebra visual.
   - Na aba "Pedágios" (`TollsPanel`, lista `aria-label="Praças de
     pedágio"`), cada praça mostra "Valor não disponível" em vez de um
     número.
   - O resumo/total de pedágio da rota mostra R$ 0,00 (esperado, não bug).
2. **Rota que NÃO cruza nenhum pedágio real** — uma rota curta, local,
   longe de qualquer rodovia federal pedagiada. Confirme: lista de
   pedágios vazia, sem erro, total R$ 0,00, tela não quebra.
3. **Toggle da camada de pedágio no mapa** — ligar/desligar a camada
   (mesmo controle que já existia antes desta fase) remove/restaura os
   marcadores reais corretamente.
4. **Navegação Tela 1 → Tela 2 → Tela 1** — sem erro no console do
   navegador, sem crash, mapa persiste (G2) corretamente com os
   marcadores reais.
5. **`GET /admin/toll-plazas-status` direto no navegador/curl** — confirma
   `count: 277`, `lastIngestedAt` recente.
6. **Sanidade geográfica de umas 5-10 praças amostradas** — pegue os
   nomes/coordenadas de 5-10 praças que apareceram nos testes acima e
   confirme visualmente no mapa que elas ficam em cima ou muito perto da
   rodovia federal certa (não em outro lugar do país) — é o jeito mais
   direto de pegar um eventual bug de inversão `lat`/`lng` que os testes
   unitários já cobriram, mas vale ver com os próprios olhos numa sessão
   real de navegador.

### Prompt curto pra colar no Codex

```
Rode uma suíte de verificação E2E manual (Playwright) do pedágio real no
repo qualroteiro, documentada em PEDAGIO-COORDINATION.md, seção "Suite de
testes E2E — verificação real do pedágio". Suba apps/api e apps/web
localmente, confirme o Postgres tem as 277 praças reais antes de começar,
rode os 6 casos descritos, e reporte achados (inclusive prints/evidência
de qualquer coisa que não bater com o esperado).
```

## Achados da QA E2E (2026-09-16) — triagem e correções

Relatório completo: `repos/qualroteiro/docs/qa/2026-09-16-pedagio/REPORT.md`
(Codex + Playwright, app real, sem mocks). 4 achados, triados assim:

| # | Achado | Causa | Ação |
|---|---|---|---|
| 1 | Marcadores do mapa perdem `aria-label` (viram "Map marker" genérico) | MapLibre sobrescreve o atributo depois de `addTo()` — arquivo core (`MapCanvas.tsx`), usado por todo módulo | **Fechado** (`j-20260916-w0`, PR #37, mergeado em `main`) |
| 2 | Texto "base de demonstração 2024-2025" ainda visível no drawer/painel de pedágio | Copy esquecida de antes da Fase 1 | **Fechado** (PR #38, mergeado em `main`) |
| 3 | Sobreposição/imprecisão de alguns pontos (~300-450m de desvio) | **Confirmado real, mas não é bug nosso**: o CSV oficial da ANTT só tem 2 casas decimais pra essas praças específicas (verifiquei direto na fonte) | Rastrear — a ingestão via OSM (já em andamento) deve ter precisão melhor pra essas mesmas praças, redundância cobre o buraco |
| 4 | Aba "Alternativas" cortada em telas largas (1600×1050) | Layout, não é específico de pedágio | **Fechado** (PR #38, mergeado em `main`) |

### Brief pro Codex — achados 2 e 4

**Achado 2 — remover texto de "base de demonstração"**: em
`apps/web/src/modules/rota-custos/PlazaDrawer.tsx` (linha ~123) e
`apps/web/src/modules/rota-custos/panels/TollsPanel.tsx` (linhas ~29 e
~71), o texto menciona "base de demonstração desta fase (2024–2025)" e o
estado vazio diz "a base de pedágios desta fase cobre três corredores do
Sudeste; trechos fora deles aparecem sem cobrança" — isso é falso agora
(ingestão federal real, nacional, 277 praças) e pode fazer o usuário achar
que um trecho é gratuito quando na verdade só não tem tarifa cadastrada
ainda. Atualizar os textos pra refletir a realidade atual: dado de
localização real (ANTT, federal), tarifa ainda não disponível pra maioria
das praças (não "essa região é gratuita"). Atualizar os testes que
verificam esses textos.

**Achado 4 — aba "Alternativas" cortada**: em
`apps/web/src/modules/rota-custos/ResultScreen.tsx`, a lista de abas
(`TabsList` com Pedágios/Combustível/Pontos na rota/Alternativas) corta o
rótulo "Alternativas" em telas largas (1600×1050 testado). Ajustar o
layout pra não cortar (scroll horizontal na lista de abas, ou abas menores,
ou o que fizer mais sentido visualmente — critério: nenhum rótulo cortado
nessa largura, sem quebrar em larguras menores que já funcionavam).

**Aceite**:
- `pnpm --filter @qualroteiro/web build/typecheck/lint/test` verdes.
- Teste: texto antigo de "base de demonstração"/"três corredores do
  Sudeste" não aparece mais em lugar nenhum de `PlazaDrawer`/`TollsPanel`.
- Verificação visual (print/Playwright) confirmando "Alternativas" não
  corta em 1600×1050.
- `git diff --name-only origin/main..HEAD` só `apps/web/**`.

**Prompt curto pra colar no Codex**:
```
Corrija 2 achados de QA E2E do repo qualroteiro, documentados em
PEDAGIO-COORDINATION.md, seção "Achados da QA E2E" — achados 2 e 4
(texto de base de demonstração desatualizado, aba Alternativas cortada em
telas largas).

Branch a partir de main. Abra PR quando os testes estiverem verdes.
```

## Achado novo — corte VERTICAL das abas com lista longa (segunda rodada E2E)

O fix do achado 4 (PR #38) resolveu o corte HORIZONTAL, mas só foi testado
visualmente por mim contra o modo demo (lista curta, ~6 praças) — não
contra o cenário real de produção (61 praças da Dutra). Uma segunda rodada
de QA E2E (Codex, `docs/qa/2026-09-16-pedagio-rerun/REPORT.md`) rodou
contra o app real com as 61 praças reais e achou um problema diferente:
com lista longa, `TabsList` encolhe **verticalmente pra 8px** (botões de
28px estourando pra fora) — `Tabs` tem `flex min-h-0 flex-col` e
`TabsList` não tem `shrink-0`, então o conteúdo longo da aba ativa
comprime a barra. Confirmei a hipótese técnica lendo o código.

**Fechado** (PR #39, mergeado em `main`, commit `b894500`). `Tabs` trocou
`min-h-0` por `flex-none`, `TabsList` ganhou `min-h-10 shrink-0` — a causa
raiz era o próprio `Tabs` encolher como filho flex, desnecessário já que o
painel pai já tem `overflow-y-auto` cuidando do scroll. Verifiquei
pessoalmente com dado real (não modo demo): São Paulo → Rio, 61 praças
reais, barra normal em todas as abas, rolagem até o fim da lista (P05
Viúva Graça) e total alcançáveis. PR também trouxe Playwright pro repo
como devDependency (`test:e2e`, script separado — **não entra no
`pnpm -w test` nem na CI**, só disponível pra verificação manual sob
demanda, como combinado).

**Prompt curto pra colar no Codex**:
```
Implemente a correção descrita em FRONT-PEDAGIO-SPEC.md (raiz do
workspace) — corte vertical da TabsList em Rota & Custos com lista longa
de pedágios. Escopo, critérios de aceite (AC-1 a AC-8) e plano de
verificação já estão na spec, aprovados pelo coordenador.

Branch a partir de main. Abra PR quando os testes estiverem verdes e a
verificação visual (desktop 1600x1050/1280x720, mobile 390x844, com as 61
praças reais da Dutra — não modo demo) estiver documentada.
```

## Fase 1 — FECHADA (2026-09-16)

Wave 1 (`packages/tolls` refatorado + scaffold) → Wave 2 (`apps/api`
schema/store/wiring real) → Wave 3 (`services/data-ingest`, job real) —
todas mergeadas em `main`. **277 praças reais da ANTT** (federal, nacional)
substituem o seed de demo no caminho de produção do `/routes/plan`.
Coordenadas verificadas de forma independente 3 vezes (dev, coordenador,
QA), inclusive por mutação (inverter `lat`/`lng` quebra o teste crítico) —
sem inversão de eixo, pins vão pro lugar certo no mapa.

Próximo passo natural: **ARTESP (SP, estadual)** — resolve o buraco da
Bandeirantes/SP-348 (fora do dataset federal). PDF único, `GET` direto,
mais simples que a Wave 1-3 da ANTT. Ainda não especificado — aguardando
prioridade do PE. Ver "Visão de longo prazo" acima pro motivo/sequência
completa.

## Log de progresso

- 2026-09-16: Codex preparou [FRONT-PEDAGIO-SPEC.md](FRONT-PEDAGIO-SPEC.md)
  para alinhamento do PE com Claude: estabilidade vertical das abas,
  rolagem do painel, criterios desktop/mobile e regressao Playwright.
  **Proposta, sem implementacao ou PR nesta etapa.**

- 2026-09-16: Codex repetiu a suite real no commit `5fa985a` (apos PRs
  #37/#38), em processos dedicados 3002/5175. Pre-requisito 277 confirmado;
  seis fluxos funcionais passaram, zero erros JS/console e oito amostras
  geograficas revistas. Nomes acessiveis e copy corrigidos; corte horizontal
  de Alternativas resolvido. **Novo achado P2: na aba Pedagios com 61 linhas,
  TabsList encolhe para 8 px e corta verticalmente os botoes de 28 px.**
  Correcao de layout apenas parcial; sem fix de produto nesta verificacao.
  [Segunda rodada: relatorio, medidas e prints](repos/qualroteiro/docs/qa/2026-09-16-pedagio-rerun/REPORT.md).

- 2026-09-16: Codex concluiu os seis casos E2E reais com Playwright em
  `origin/main` (`5e15c17`), branch local `codex/qa/pedagio-real`.
  **PASS funcional com ressalvas**: pre-requisito confirmado antes dos
  casos (277 pracas, ingestao `2026-09-16T19:38:31.261Z`); Dutra com 61
  registros, oito categorias sem tarifa e total zero; toggle 61/0/61;
  rota urbana sem pracas; mesmo canvas na navegacao; zero erros JS/console;
  oito amostras geograficas revistas. Achados: nomes acessiveis dos pins
  substituidos por "Map marker", textos antigos de demo/tres corredores,
  61 registros em 17 coordenadas (sobreposicao), precisao local em Aruja
  e aba Alternativas cortada no desktop. Sem correcao de produto nesta tarefa.
  [Relatorio completo e evidencias](repos/qualroteiro/docs/qa/2026-09-16-pedagio/REPORT.md).

- 2026-09-16: Wave 1 (`j-20260916-9y`, ANTT Fase 1, `packages/tolls`)
  fechada (mergeada em `main`, commit `6623ed1`) — ver detalhe completo em
  `COORDINATOR-STATE.md`. Wave 2 api (`j-20260916-9y`) dispatchada via
  Claude (Pete Campbell). Wave 2 web liberada pro Codex.
- 2026-09-16: Wave 2 api fechada (PR #33, commit `27b6679`) — QA (Joan
  Holloway) PASS, round-trip real de `lat`/`lng` provado com a praça
  "Conselheiro Josino" contra Postgres real, sem inversão de eixo.
- 2026-09-16: Wave 3 fechada (PR #34, commit `901f6ce`) — job real rodou
  contra o CSV oficial da ANTT, 277 praças ativas ingeridas de verdade no
  Postgres local compartilhado, idempotência provada com 2 rodadas reais
  (não só mock). QA (Bertram Cooper) PASS, mutação própria (inverter
  `lat`/`lng`) quebrou exatamente o teste crítico como esperado. **Fase 1
  completa.** `dev`/`main` ressincronizados.
- 2026-09-16: PR #37 (marcador acessível) e PR #38 (copy + corte horizontal
  de abas) fechadas — ver tabela de achados acima. Wave 1 do OSM fechada
  (PR #36, `packages/tolls`). Wave 2/3 do OSM especificadas e aprovadas,
  **pausadas a pedido do PE**.
- 2026-09-16/17: segunda rodada E2E achou o corte VERTICAL das abas (ver
  seção acima) — corrigido na PR #39. Revisão de front-end mais ampla
  (a11y/dark mode/consistência, escopo além do pedágio) rodou em paralelo e
  foi triada e fechada na PR #40 (achados A11Y-01/LAYOUT-01); detalhe
  completo em `G-COORDINATION.md`, seção "Revisão de front-end". Inventário
  de dark mode fica como backlog, sem ação.
- 2026-09-17: jornada OSM `j-20260916-y9` retomada. **Wave 2** (`apps/api`,
  Pete Campbell) fechada — PR #41, QA (Joan Holloway) PASS com verificação
  independente real (migration provada contra Postgres, mutação real em
  `toTollPlaza()` pegou, `/routes/plan` e `/admin/toll-plazas-status`
  confirmados end-to-end). Achado não-bloqueante registrado: validação
  por-campo de `tariff` malformado em `toTariff()` não tem teste dedicado
  (mutação nessa validação específica sobreviveu) — tracked, não bloqueou o
  merge. Mergeada (`721ddc0`).
- 2026-09-17: **Wave 3** (`services/data-ingest`, job real de ingestão OSM
  contra a Overpass API, Brasil inteiro) fechada — PR #43, Lane Pryce. Achado
  real: **957 cabines no Brasil inteiro** (spec estimava "poucos milhares",
  couberam num único request de 22.8s), agrupadas em **489 praças**,
  convivendo com as 277 ANTT (total 766). QA (Bertram Cooper) PASS com
  verificação independente real — chamada de verdade à Overpass (1 timeout
  504 documentado + retry único, uso justo respeitado), idempotência e
  convivência provadas contra o Postgres real (2 rodadas, `antt` inalterado,
  `ingestedAt` atualizado). Achado não-bloqueante: mutação no id-
  representativo do cluster (afeta só atribuição de nome/rodovia/uf, não a
  identidade/localização) sobreviveu — gap de teste real, tracked. Mergeada
  (`67c6549`). **Jornada `j-20260916-y9` completa — Wave 1/2/3 todas em
  `main`.**
- 2026-09-17: jornada ARTESP (`j-20260916-x3`) despachada e fechada — PR #47,
  Lane Pryce. Achado real: **136 praças** no PDF oficial (não ~124), 11
  excluídas (formato CAT-1..9, sob "L29 - ViaPaulista", não "Rodovias do
  Tietê" como a spec supôs). Desvio real e documentado da spec: `highway`/`uf`
  são sentinelas em 97,3%/99,8% das 489 praças OSM reais (a spec sugeria
  filtrar match por rodovia — inviável), substituído por bounding box de SP
  sobre `lat`/`lng`. Rodada real: 110 praças casadas (90 batem, 20 divergem),
  26 ARTESP sem match, 152 OSM sem match — relatório completo em
  `docs/audits/artesp-tariff-audit.md`. QA (Bertram Cooper) PASS com
  verificação independente real (PDF baixado 2x, query direta no Postgres,
  matemática por-eixo conferida contra `packages/tolls`, 2 mutações reais
  pegaram). Achado não-bloqueante: comentário no código superestima os
  sentinelas como "100%, every row" (real: 97,3%/99,8%) — decisão
  arquitetural continua correta, só o texto do comentário está impreciso.
  Mergeada (`0764508`). **Cobertura de pedágio: ANTT (federal) + OSM
  (federal+estadual, com tarifa) + auditoria ARTESP (validação cruzada de SP)
  — as três fontes planejadas na "Visão de longo prazo" agora em produção ou
  auditando produção.**
