# Orientation Spec — j-20260916-y9 (Pedágio — OSM como fonte rápida, ANTT/ARTESP como apoio/redundância)

> PE decidiu (2026-09-16): usar **OpenStreetMap/Overpass API** como fonte
> principal de velocidade e cobertura (geo + tarifa, num lugar só, federal
> e estadual), mantendo a ANTT (já ingerida, Fase 1 — `j-20260916-9y`) e
> fontes oficiais futuras (ARTESP, Power BI da ANTT) como apoio e
> redundância — não como substitutas, os dados de fontes diferentes
> convivem, não se sobrescrevem.
>
> Pesquisa real feita antes de especificar (não é estimativa): consultei a
> Overpass API ao vivo (`overpass-api.de`, gratuita, sem chave), bounding
> box cobrindo SP e entorno. Achado: **508 cabines de pedágio
> (`barrier=toll_booth`)**, **503 delas (99%) já com tarifa embutida** na
> tag `charge` (formato tipo
> `"14.50BRL/motorcar;0.00BRL/motorcycle;14.50BRL/hgv/axle"`), cobrindo
> concessionárias estaduais (CCR AutoBAn, Ecovias, Rodoanel, Via Colinas,
> Renovias, Rota das Bandeiras...) e federais (Régis Bittencourt apareceu
> na mesma consulta). Datas de verificação recentes — a maioria de 2026,
> algumas de setembro/2026 (mês atual). Licença ODbL (uso livre, exige
> atribuição se publicarmos o dado — nesta unidade não publicamos, só
> consumimos internamente).

## Decisões de arquitetura tomadas pelo coordenador (documentadas, não perguntadas)

1. **Formato da tag `charge`**: analisei os 503 valores reais, achei só
   **4 padrões estruturais**:
   - `NBRL/motorcar;NBRL/motorcycle;NBRL/hgv/axle` (mais comum)
   - `NBRL/motorcar;NBRL/motorcycle;NBRL/hgv` (sem `/axle`)
   - `NBRL/motorcar;NBRL/motorcycle;NBRL/hgva/axle` (variante `hgva`)
   - `Mo-Fr NBRL/...;Sa-Su NBRL/...` (tarifa dia-útil/fim-de-semana
     diferenciada) — **V1 usa só a tarifa `Mo-Fr` (dia útil)** como a
     tarifa canônica da praça; a variação de fim de semana fica de fora
     por simplicidade, documentada explicitamente como limite, não um
     bug.
2. **Mapeamento pras 8 categorias do app**: OSM só distingue
   `motorcar`/`motorcycle`/`hgv` (por eixo). Mapeamento:
   `motorcycle`→`motorcycle`, `motorcar`→`car` e `car_with_trailer` (mesmo
   valor pros dois — OSM não distingue), `hgv`/eixo→`truck_2_axle` até
   `truck_6_axle` multiplicando o valor por-eixo pelo número de eixos
   (reaproveita a mesma lógica de escada de `AXLE_MULTIPLIERS` já existente
   em `packages/tolls/src/tariff.ts`, mas a partir do valor por-eixo do
   OSM em vez de expandir de uma tarifa-base de carro).
3. **Cabine ≠ praça**: cada nó do OSM é uma cabine/pista individual — uma
   praça real tem várias. É preciso **agrupar (clusterizar)** nós próximos
   (mesmo `operator`, dentro de um raio configurável — sugestão 150m,
   ajustável) num único registro de praça. Confirmei isso nos dados reais
   que já baixei: 3 nós da "Ecovias Raposo Castello" a ~50-150m um do
   outro são claramente a mesma praça física.
4. **Chave natural**: `osm-<menor id de nó no cluster>` — ids de nó do OSM
   são estáveis entre consultas (mudam só se o mapeador apagar/substituir o
   nó — risco aceito, documentado como limite). Escolher o menor id do
   cluster garante determinismo (não depende da ordem de iteração).
5. **Convivência, não substituição**: `TollPlazaRecord` ganha um campo
   `source` (`'antt' | 'osm'`, string fechada por enum do Prisma) e um
   campo `tariff` (JSON opcional, mesmo shape de `TariffByAxleCategory`).
   Linhas da ANTT continuam com `tariff: null` (Fase 1 não mudou). Linhas
   do OSM vêm com `tariff` preenchido. **V1 NÃO tenta deduplicar visualmente
   dois registros próximos de fontes diferentes cobrindo a mesma praça
   física** (ex. Régis Bittencourt aparecendo tanto via ANTT quanto via
   OSM) — o PE pediu redundância explicitamente; se isso ficar visualmente
   ruim no mapa (dois pins quase colados), é um refinamento futuro, não
   agora. Documentar isso como limite conhecido, não esconder.
6. **Escopo geográfico da consulta**: Brasil inteiro numa área OSM (não
   bounding box manual, mais preciso) — é a mesma API/custo
   independentemente do estado, então não faz sentido throttlear por
   estado quando o objetivo é cobertura nacional rápida. Se o volume real
   for muito maior que o esperado (a amostra de SP+entorno já deu ~500;
   Brasil inteiro deve ficar na casa de poucos milhares) e isso causar
   timeout/limite da Overpass, é um achado real pra reportar, não pra
   truncar silenciosamente.

## Problem

Depois da Fase 1 (ANTT, federal, só geo — `j-20260916-9y`), o app ainda não
tem tarifa real pra quase nenhuma praça, e não cobre rodovias estaduais
(ex. a própria Bandeirantes/SP-348, hoje só com seed de demo). Esta
jornada resolve os dois de uma vez via OpenStreetMap — geo real (praças
que a ANTT não cobre) e tarifa real (que a Fase 1 explicitamente não
tinha) — mantendo as fontes oficiais (ANTT já ingerida, ARTESP/Power BI
futuras) como registros paralelos de apoio/redundância, nunca sobrescritos
pelo OSM nem vice-versa.

## Cross-package contracts

- **`packages/tolls` → `apps/api`**: `TollPlaza.tariffByAxleCategory`
  (já opcional desde a Fase 1) agora pode vir preenchido de verdade quando
  a fonte for OSM. Nova função pura `parseOsmCharge(chargeTag: string):
  TariffByAxleCategory | null` (retorna `null` se o formato não bater com
  nenhum dos 4 padrões conhecidos — nunca lançar em dado malformado, só
  pular a praça e logar). Nova função pura `clusterTollBooths(booths:
  OsmToolBooth[], radiusMeters?: number): TollPlazaCluster[]`.
- **`apps/api` → `services/data-ingest`**: schema Prisma ganha `source`
  (`TollPlazaSource` enum: `antt` | `osm`) e `tariff Json?` em
  `TollPlazaRecord`. Migration real. `toTollPlaza()` em `plan.ts` passa a
  usar `record.tariff` quando presente, em vez de sempre `undefined`.

## Per-package scope

### qualroteiro/root

> **Duas rodadas**: Wave 1 (`packages/tolls`) e Wave 3
> (`services/data-ingest`, depois de `qualroteiro/api` Wave 2 `merged`).

**Wave 1 — scope:**
  1. `parseOsmCharge(chargeTag: string): TariffByAxleCategory | null` —
     parseia os 4 padrões reais documentados acima. Pra `Mo-Fr`/`Sa-Su`,
     usa só o valor `Mo-Fr`. `motorcar`→`car`+`car_with_trailer` (mesmo
     valor), `motorcycle`→`motorcycle`, `hgv`(`/axle` ou `/axle` variante
     `hgva`)→ multiplicado pelo número de eixos de cada categoria de
     caminhão (reaproveitar a proporção já usada em `AXLE_MULTIPLIERS` de
     `tariff.ts`, documentar a fórmula exata escolhida). Formato
     desconhecido → `null`, nunca lança.
  2. `clusterTollBooths` — agrupa nós próximos (mesmo `operator`, raio
     configurável, default sugerido 150m) em clusters; cada cluster vira
     uma praça candidata (centróide como `lat`/`lng`, ou o ponto do nó de
     menor id — escolha do dev, documentar). Função pura, sem I/O (mesma
     filosofia do resto do pacote).
- **Acceptance:**
  - `pnpm --filter @qualroteiro/tolls typecheck/lint/test` verdes.
  - Teste: os 4 padrões reais de `charge` (usar os exemplos reais citados
    nesta spec como fixture) parseiam certo.
  - Teste: `charge` malformado/desconhecido → `null`, não lança.
  - Teste: `Mo-Fr`/`Sa-Su` usa só o valor de dia útil.
  - Teste: clustering agrupa pontos próximos do mesmo operador, não agrupa
    pontos de operadores diferentes mesmo que próximos, não agrupa pontos
    distantes do mesmo operador.
  - `git diff --name-only origin/main..HEAD` só `packages/tolls/**`.
  - SDD sdd-lite ou full, conforme `aipe skill match`.

### qualroteiro/api

> Wave 2, depende de Wave 1 (`qualroteiro/root`) `merged`.

**Scope:**
  1. Migration: `TollPlazaRecord` ganha `source TollPlazaSource` (enum
     Prisma `antt` | `osm`, default `antt` pra não quebrar as 277 linhas já
     existentes da Fase 1) e `tariff Json?`.
  2. `toTollPlaza()` em `plan.ts`: usa `record.tariff` (convertido de volta
     pro shape `TariffByAxleCategory`) quando presente, `undefined` quando
     não.
  3. `GET /admin/toll-plazas-status` — considerar expor contagem por
     `source` também (ex. `{count, byCource: {antt: 277, osm: N},
     lastIngestedAt}`), útil pra depois provar que o OSM realmente rodou.
- **Acceptance:**
  - `pnpm --filter @qualroteiro/api typecheck/lint/test` verdes.
  - Migration real aplicada, round-trip provado (mesmo padrão das ondas
    anteriores).
  - Teste: uma linha com `source: 'osm'` e `tariff` preenchido aparece em
    `/routes/plan` com `tariffByAxleCategory` de verdade, contando no
    `total`.
  - Teste: uma linha `source: 'antt'` (sem tariff) continua se comportando
    exatamente como hoje (regressão zero da Fase 1).
  - `git diff --name-only origin/main..HEAD` só `apps/api/**`.
  - SDD conforme `aipe skill match`.

**Wave 3 — scope** (rodada 2 de `qualroteiro/root`, depende de
`qualroteiro/api` Wave 2 `merged`):
  1. Job novo (`ingest-toll-osm` ou nome equivalente): consulta a Overpass
     API (`https://overpass-api.de/api/interpreter`, `POST`, sem chave) por
     `node["barrier"="toll_booth"]` no Brasil inteiro (área OSM do Brasil,
     não bounding box manual — mais preciso). **Antes de rodar de verdade,
     confirme o volume real** (deve ficar na casa de poucos milhares,
     baseado na amostra de SP+entorno já ter dado ~500) — se a Overpass
     der timeout/erro de tamanho, isso é um achado real a reportar, não a
     contornar silenciosamente truncando.
  2. Aplica `clusterTollBooths` + `parseOsmCharge` (de `packages/tolls`,
     Wave 1) em cima do resultado.
  3. Upsert idempotente em `TollPlazaRecord` com `source: 'osm'`, chave
     natural `osm-<menor id de nó do cluster>`.
  4. Agendamento: pode reusar a mesma infraestrutura BullMQ já criada na
     Fase 1 (novo job registrado, mesmo worker/fila, ou fila própria —
     decisão do dev, documentar). Frequência sugerida: mensal, igual a
     ANTT (dado de pedágio não muda todo dia) — ajustável se o dev achar
     motivo pra diferente.
  5. **Atenção a respeitar a Overpass**: não é uma API paga, mas tem uso
     justo — um `User-Agent` identificando o projeto, um timeout razoável
     (`[timeout:180]` ou similar), sem retry agressivo em loop.
- **Acceptance:**
  - `pnpm --filter @qualroteiro/data-ingest typecheck/lint/test` verdes.
  - Teste: fixture real (alguns nós reais do OSM, incluindo os 4 padrões de
    `charge` e um cluster de 2-3 cabines) — confirma clustering +
    parsing + upsert com `source: 'osm'` certo.
  - Se Postgres local disponível: rodar o job de verdade uma vez, confirmar
    via `GET /admin/toll-plazas-status` que apareceram linhas `source:
    'osm'` COM tarifa, sem apagar/sobrescrever as 277 linhas `source:
    'antt'` já existentes (prova de convivência, não substituição — rode
    uma query antes/depois confirmando que o count `antt` não mudou).
    Rodar duas vezes, confirmar idempotência real (mesmo padrão da Fase 1).
  - `git diff --name-only origin/main..HEAD` só `services/data-ingest/**`.
  - SDD conforme `aipe skill match`.

## Sequencing

- **Wave 1:** `qualroteiro/root` (packages/tolls) — dev: Lane Pryce → QA:
  Bertram Cooper.
- **Wave 2:** `qualroteiro/api`, depende de Wave 1 `merged` — dev: Pete
  Campbell → QA: Joan Holloway.
- **Wave 3:** `services/data-ingest` (escopo root), depende de Wave 2
  `merged` — dev: Lane Pryce → QA: Bertram Cooper.

## Per-unit dispatch envelopes

`aipe execution propose --journey j-20260916-y9`:

- **Wave 1** — `subagent/claude-code/reasoning/normal` (cost-index 4).
  Razão: parsing de formato externo real com casos especiais (dia
  útil/fim de semana), derivação de tarifa por eixo a partir de um valor
  por-eixo (matemática que precisa estar certa — dinheiro real), algoritmo
  de clustering geométrico novo. Não é mecânico.
- **Wave 2** — `subagent/claude-code/reasoning/normal` (cost-index 4).
  Razão: migration + decisão de como o campo `tariff` JSON se converte de
  volta pro tipo do domínio, mesma seriedade das ondas anteriores.
- **Wave 3** — `subagent/claude-code/reasoning/normal` (cost-index 4).
  Razão: integração com uma API externa nova (Overpass), decisões reais
  sobre volume/timeout/uso justo, idempotência de upsert com uma fonte a
  mais convivendo com a existente.
- QAs — `standard` (cost-index 2) cada, com atenção redobrada (Wave 1) em
  provar a matemática de conversão de tarifa por eixo e (Wave 3) em provar
  convivência real sem sobrescrever a Fase 1 (ANTT).

## Out of scope

- Tarifa diferenciada de fim de semana (`Sa-Su`) — só a de dia útil por
  enquanto, documentado como limite.
- Deduplicação visual entre praças de fontes diferentes cobrindo o mesmo
  ponto físico (ex. Régis Bittencourt via ANTT e via OSM aparecendo como 2
  pins) — redundância é intencional nesta fase, dedup é refinamento
  futuro se necessário.
- ARTESP (PDF oficial) e o Power BI de tarifas da ANTT — ficam como fontes
  de apoio/redundância FUTURAS, não implementadas nesta jornada. Podem
  virar uma jornada própria depois, pra cross-validar o que o OSM disser.
- Qualquer mudança em `apps/web` — o shape de `TollPlaza` já é consumido
  do jeito que é pela UI (Fase 1 já cuidou da renderização de praça sem
  tarifa); praças com tarifa real do OSM só passam a mostrar valor onde
  antes mostravam "não disponível", sem mudança de código na web.
