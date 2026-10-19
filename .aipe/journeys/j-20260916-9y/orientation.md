# Orientation Spec — j-20260916-9y (Pedágio real, Fase 1 — geo/identidade)

> PE escolheu opção B (ingestão real, não seed maior) e pediu foco nisso em
> 2026-09-16. Pesquisa real feita antes de especificar (não estimativa):
> `dados.antt.gov.br/dataset/praca-de-pedagio` — dataset oficial, unificado,
> atualizado mensalmente, CSV/JSON/KMZ. Baixei e inspecionei o CSV de
> verdade: **277 praças ativas, 36 concessionárias, 12 estados**. Colunas
> reais: `concessionaria;praca_de_pedagio;ano_do_pnv_snv;rodovia;uf;km_m;
> municipal;tipo_de_pista;sentido;situacao;data_da_inativacao;latitude;
> longitude` (arquivo em ISO-8859-1/Windows-1252, não UTF-8 — atenção ao
> parsear). **Não existe** dataset único de tarifa por eixo — cada
> concessionária publica a sua separadamente, só mudando em reajuste
> regulatório. Por isso esta é só a **Fase 1** (geo/identidade); tarifa via
> scraping por concessionária fica pra uma Fase 2 separada, quando/se o PE
> topar.

## Decisões de arquitetura tomadas pelo coordenador (documentadas, não perguntadas)

Investiguei o código antes de escrever isto — achei uma incompatibilidade
real que muda o desenho:

1. **`Corridor`/`CorridorId` são um desenho de demo, não cabem em 277 praças
   nacionais.** `CorridorId` é uma união fechada de exatamente 3 ids
   (`sp-rj-dutra`, etc.), e `Corridor` exige `referencePolyline` (uma
   geometria de demo) e uma lista curada de praças. Praças reais da ANTT
   não pertencem a "corredores" nomeados — são pontos soltos. Em vez de
   forçar isso num molde que não serve, `matchTolls` (`packages/tolls/src/match.ts`)
   vai trocar seu parâmetro `corridorHint?: CorridorId` (que hoje resolve
   internamente via `listCorridors()`/`getCorridor()`) por um parâmetro
   **explícito** `plazas: readonly TollPlaza[]` — quem monta a lista de
   candidatos passa a ser o chamador (`apps/api`), não mais o pacote. Isso
   simplifica `matchTolls` (remove o acoplamento com o seed) e deixa o
   pacote livre de saber se a lista vem do seed de demo ou do banco real.
   **`matchFuelStations` fica como está** (fora de escopo — só pedágio
   nesta fase), então os dois ficam assimetricamente desenhados por um
   tempo — deliberado, não descuido, revisitar se/quando postos entrarem
   em ingestão real.
2. **Tarifa vira opcional.** `TollPlaza.tariffByAxleCategory` passa de
   obrigatório pra `?: TariffByAxleCategory`. `matchTolls` continua achando
   e listando a praça mesmo sem tarifa (é uma praça real, existe, faz
   sentido mostrar), mas a soma do total pula praças sem tarifa (contam
   como 0 no `total`, não quebram a conta). O seed de demo (3 corredores)
   continua com tarifa em todas as praças — só as novas, vindas do banco,
   ficam sem.
3. **Isso é uma mudança visível pro usuário**: hoje o app mostra pedágio
   com preço em 3 corredores (dado de demo, mas completo); depois desta
   fase, o app mostra **muito mais pedágios reais** (277 praças em vez de
   ~15 hand-seeded), mas a maioria sem preço ainda (só localização/nome/
   concessionária) — até a Fase 2 (tarifas) existir. Troca honesta:
   cobertura geográfica real por completude de preço. UI precisa mostrar
   "valor não disponível" pra praça sem tarifa, não esconder a praça nem
   quebrar o total.
4. **Schema Prisma único em `apps/api`** — `services/data-ingest` NÃO
   define seu próprio schema (evita duas fontes de verdade pro mesmo
   banco). Ele gera seu Prisma Client apontando pro schema de
   `apps/api/prisma/schema.prisma` (`prisma generate --schema=../../apps/api/prisma/schema.prisma`
   ou equivalente — decisão de mecanismo exato fica com o dev, documentar
   escolha no SDD).
5. **`services/*` já está no workspace do pnpm** (`pnpm-workspace.yaml`),
   não precisa mexer em config de raiz pra isso funcionar. Não existe
   persona dedicada pra "services" no roster do AIPe — tratando como
   escopo `root` (Lane Pryce/Bertram Cooper), mesmo time de `packages/*`.

## Problem

O app não tem dado real de pedágio — só 3 corredores hand-seeded,
explicitamente marcados "DEMO DATA" no código. Esta fase troca isso por
ingestão real da ANTT: um job que baixa o dataset oficial, mensal, e
popula o banco com praças de verdade (localização, rodovia, concessionária)
em todo o Brasil coberto pelo dataset — sem ainda ter o preço de cada uma
(isso é Fase 2, fonte fragmentada, mais cara de automatizar).

## Cross-package contracts

- **`packages/tolls` → `apps/api`**: `matchTolls` muda de assinatura
  (`corridorHint?: CorridorId` → `plazas: readonly TollPlaza[]`,
  obrigatório). `TollPlaza.tariffByAxleCategory` vira opcional. Mudança
  interna ao monorepo, sem consumidor externo — mas é uma mudança
  **quebrante** de uma função já usada por `apps/api`, então Wave 2 (api)
  só começa depois de Wave 1 (tolls) `merged`.
- **`apps/api` → `apps/web`**: nenhum contrato de endpoint novo muda de
  shape — `PlannedRoute.tolls.plazas` (`@qualroteiro/geo`/`tolls` reexporta
  `TollPlaza`) já é consumido direto pelo tipo do pacote, então a
  opcionalidade de `tariffByAxleCategory` propaga automaticamente pro tipo
  que `apps/web` já importa — sem editar `apps/web/src/core/api/types.ts`
  à mão. `apps/web` só precisa passar a tratar o caso ausente na UI.
- **`services/data-ingest` → `apps/api`**: comunicação é só via banco
  (Postgres) — o job escreve, a API lê. Nenhum contrato HTTP entre os
  dois.

## Per-package scope

### qualroteiro/root

> **Duas rodadas nesta mesma unidade**: Wave 1 (packages/tolls + scaffold
> de `services/data-ingest`) e Wave 3 (a lógica real de ingestão em
> `services/data-ingest`, depois que `qualroteiro/api` — Wave 2 — estiver
> `merged`, porque precisa do modelo Prisma existir). Escopo de cada
> rodada detalhado abaixo, claramente separado.

**Wave 1 — scope:**
  1. `TollPlaza.tariffByAxleCategory` → opcional.
  2. `matchTolls`: trocar `corridorHint?: CorridorId` por `plazas: readonly TollPlaza[]` (obrigatório). Remover a resolução interna via `listCorridors()`/`getCorridor()` pra este parâmetro específico (o seed continua existindo, só não é mais resolvido implicitamente aqui). Soma do `total` pula (trata como 0) praças com `tariffByAxleCategory` ausente, mas elas continuam aparecendo em `plazas[]` no resultado.
  3. Atualizar os testes existentes de `match.ts` pra passar a lista de praças explicitamente (ex. `listCorridors().flatMap(c => c.plazas)` pros casos que hoje testam "todos os corredores").
  4. **Não** tocar `matchFuelStations` (fora de escopo, deliberado).
  5. Scaffold do pacote `services/data-ingest`: `package.json`, `tsconfig.json`, entrypoint mínimo (`src/index.ts` vazio ou um "hello" de sanity), registrado no `turbo.json` (build/lint/typecheck/test tasks, mesmo padrão dos outros pacotes). **Sem lógica de ingestão ainda** — isso é Wave 3. Só o esqueleto que builda/typecheca/linta limpo.

**Nota de correção (coordenador, pós-dispatch)**: a primeira rodada da
Wave 1 deixou `apps/api`/`apps/web` sem compilar (dois call-sites de
`matchTolls` com a assinatura antiga + ~6 erros de narrowing de
`tariffByAxleCategory`), porque o brief de dispatch contradisse este
próprio spec (dizia "é esperado quebrar", mas o acceptance abaixo sempre
exigiu `pnpm -w build` verde). Corrigido com uma rodada extra: patch-ponte
temporário nesses pontos, preservando o comportamento atual exatamente
(sem implementar o fallback de UI de verdade — isso continua sendo da
Wave 2 web), marcado com `TODO(Wave 2 — j-20260916-9y)` em cada ponto.
Wave 2 (api e web) substitui a ponte pelo trabalho real.

**Wave 1 — acceptance:**
  - `pnpm --filter @qualroteiro/tolls typecheck/lint/test` verdes.
  - Teste: `matchTolls` com uma praça sem `tariffByAxleCategory` na lista — aparece em `plazas[]`, não conta no `total`.
  - Teste: `matchTolls` com a lista de praças explícita reproduz exatamente o comportamento anterior pros 3 corredores de demo (regressão zero).
  - `pnpm --filter services/data-ingest build/typecheck/lint/test` verdes (mesmo que trivial/vazio).
  - `pnpm -w build` continua verde (nada mais quebrou por causa da assinatura nova de `matchTolls` — ver Wave 2, mas o pacote em si não pode quebrar sozinho).
  - `git diff --name-only origin/main..HEAD` só `packages/tolls/**` e `services/data-ingest/**` (+ `turbo.json`/`pnpm-workspace.yaml` se necessário pro scaffold).
  - SDD: `aipe skill match --task-type feature --size medium`.

**Wave 3 — scope** (rodada 2 desta mesma unidade, depois de `qualroteiro/api` Wave 2 `merged`):
  1. Job BullMQ `ingest-toll-plazas`: baixa o CSV real
     (`https://dados.antt.gov.br/dataset/a7e1e12d-f8e8-40cd-bc1f-57973a4a4a6d/resource/9aa29243-c54c-4084-bc3d-c44a75c9bd7e/download/dados-dos-pracas-de-pedagio6_2026.csv`
     — ou o recurso JSON equivalente, se o dev achar mais simples de
     parsear/mais estável; documentar a escolha), parseia (atenção à
     codificação — não é UTF-8), filtra `situacao === 'Ativo'`, monta a
     chave natural estável, faz upsert no `TollPlazaRecord` via o Prisma
     Client apontado pro schema de `apps/api` (não duplicar o modelo).
  2. Agendamento mensal (BullMQ repeatable job) + um jeito de rodar sob
     demanda (CLI/script) pro seed inicial e pra testes — usar Redis já
     provisionado em `infra/docker-compose.yml`.
  3. Log estruturado do resultado de cada rodada (linhas lidas, upserts,
     inativas ignoradas, erros) — console estruturado é suficiente pra V1,
     não precisa de uma tabela de auditoria própria.
  4. `.env.example` do serviço documentando `DATABASE_URL`/`REDIS_URL`
     (reaproveitar os mesmos valores que `apps/api` já usa).

**Wave 3 — acceptance:**
  - `pnpm --filter services/data-ingest typecheck/lint/test` verdes.
  - Teste: parser do CSV com uma amostra fixture (algumas linhas reais do
    dataset, incluindo pelo menos uma inativa) — mapeia certo, filtra
    inativa, monta chave natural estável e idempotente (rodar duas vezes
    não duplica).
  - Se o Postgres/Redis local estiverem disponíveis: rodar o job de
    verdade uma vez, confirmar via `GET /admin/toll-plazas-status` (da
    Wave 2) que o count bate com o real (277, ou o que o dataset tiver no
    momento). Se não disponível, declarar como limite explícito.
  - `git diff --name-only origin/main..HEAD` só `services/data-ingest/**`
    (mais o schema de `apps/api` SE o dev precisar registrar o Prisma
    Client ali — evitar se possível, documentar se necessário).
  - SDD: `aipe skill match --task-type feature --size medium`.

### qualroteiro/api

> Wave 2, depende de Wave 1 (`qualroteiro/root`) `merged`.
- **Scope:**
  1. Novo modelo Prisma `TollPlazaRecord` (nome exato a critério do dev, documentar): `id` (chave natural estável — sugestão: slug de concessionária+praça+rodovia+km, já que a ANTT não dá um id numérico), `concessionaire`, `name`, `highway`, `uf`, `municipality`, `km`, `lat`, `lng`, `active Boolean`, `ingestedAt DateTime`. **Sem campo de tarifa** (Fase 2). Migration real aplicada no Postgres local.
  2. Novo store (`toll-plaza-store.ts`, port + adapter Prisma, mesmo padrão de `ApiUsageStore`): pelo menos `listActive(): Promise<TollPlazaRecord[]>`.
  3. Ligar `matchTolls` (que agora pede `plazas` explícito) na rota de plan (`apps/api/src/routes/plan.ts` ou onde a chamada já existe hoje): montar a lista a partir do store (mapear `TollPlazaRecord` → `TollPlaza` do pacote, com `tariffByAxleCategory: undefined`), **substituindo** o uso do seed de demo no caminho de produção. O seed de 3 corredores continua existindo no pacote (usado só pelos testes do próprio `packages/tolls`), mas não é mais o que a API usa de verdade.
  4. `GET /admin/toll-plazas-status` — deliberadamente sem auth (mesmo padrão do G1's `/admin/places-usage`), `200 { count: number, lastIngestedAt: string | null }`.
  5. Se o banco estiver vazio (nenhuma linha ainda — antes do Wave 3 rodar pela primeira vez), a rota de plan precisa continuar funcionando sem pedágio nenhum (lista vazia), não quebrar.
- **Acceptance:**
  - `pnpm --filter @qualroteiro/api typecheck/lint/test` verdes.
  - Migration real aplicada e round-trip real provado (mesmo padrão de G1).
  - Teste: `matchTolls` chamado com a lista vinda do store mockado (praças sem tarifa) — resposta de `/routes/plan` inclui essas praças sem quebrar o cálculo do total.
  - Teste: banco vazio → `/routes/plan` funciona, pedágio zerado, sem erro.
  - Teste: `GET /admin/toll-plazas-status` reflete o count/timestamp reais.
  - `git diff --name-only origin/main..HEAD` só `apps/api/**`.
  - SDD: `aipe skill match --task-type feature --size medium`.

### qualroteiro/web

> Wave 2, depende de Wave 1 (`qualroteiro/root`) `merged`, paralelo à unidade `qualroteiro/api`.
- **Scope:**
  1. `TollsPanel.tsx`/`PlazaDrawer.tsx` (e qualquer outro lugar que mostre `tariffByAxleCategory`): tratar o caso `undefined` — mostrar "valor não disponível" (ou texto equivalente) em vez de quebrar/mostrar `NaN`/`undefined`. O total já vem certo da API (pula praças sem tarifa), então a UI só precisa não quebrar ao renderizar a linha da praça em si.
  2. Testável via mock (mesmo padrão de sempre) — não depende do backend estar rodando de verdade.
- **Acceptance:**
  - `pnpm --filter @qualroteiro/web build/typecheck/lint/test` verdes.
  - Teste: uma praça mockada sem `tariffByAxleCategory` renderiza "valor não disponível", não quebra a tela nem o total.
  - Regressão zero pras praças COM tarifa (continuam mostrando o valor normal).
  - `git diff --name-only origin/main..HEAD` só `apps/web/**`.
  - SDD sdd-lite.

## Sequencing

- **Wave 1:** `qualroteiro/root` (packages/tolls + scaffold data-ingest) —
  dev: Lane Pryce → QA: Bertram Cooper.
- **Wave 2 (paralelo, ambos dependem só de Wave 1 `merged`):**
  `qualroteiro/api` (dev: Pete Campbell → QA: Joan Holloway) e
  `qualroteiro/web` (dev: Peggy Olson → QA: Stan Rizzo).
- **Wave 3:** `services/data-ingest` (escopo root, dev: Lane Pryce → QA:
  Bertram Cooper), depende de Wave 2 `api` `merged` (precisa do Prisma
  model existir).

## Per-unit dispatch envelopes

`aipe execution propose --journey j-20260916-9y`:

- **Wave 1 (root)** — `subagent/claude-code/reasoning/normal` (cost-index
  4). Razão: muda a assinatura pública de uma função já usada por
  `apps/api` (`matchTolls`), decisão real de design (praça sem tarifa
  conta ou não no total) — não é mecânico.
- **Wave 2 (api)** — `subagent/claude-code/reasoning/normal` (cost-index
  4). Razão: schema/migration real + integração do resultado do store no
  cálculo de custo (dinheiro/números certos importam, mesmo peso de G1).
- **Wave 2 (web)** — `subagent/claude-code/standard/normal` (cost-index
  2). Razão: mecânico contra critério explícito (mostrar fallback), sem
  arquitetura nova.
- **Wave 3 (data-ingest)** — `subagent/claude-code/reasoning/normal`
  (cost-index 4). Razão: parsing de dado externo real + job agendado +
  idempotência de upsert — superfície nova, julgamento real sobre a chave
  natural estável e tratamento de erro de rede/formato.
- QAs — `standard` (cost-index 2) cada, exceto QA de Wave 1/Wave 3 que
  fica em `standard` também (mecânico contra critério explícito, mas com
  atenção a regressão zero no caso de Wave 1).

## Out of scope

- **Tarifa por eixo (Fase 2)** — fonte fragmentada por concessionária,
  jornada própria futura, não agora.
- Postos de combustível reais (`matchFuelStations` fica como está).
- Ingestão de outras rodovias/dados além do dataset de praças da ANTT
  (ex. DNIT separado, se algum dia for preciso).
- UI de "onde tem pedágio" fora do fluxo de rota já existente (ex. um mapa
  nacional de praças) — não pedido agora.
- Autenticação do `/admin/toll-plazas-status`.
