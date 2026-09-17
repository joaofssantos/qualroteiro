# spec-kit — j-20260916-x3 (root/services/data-ingest): Auditoria ARTESP x OSM

**Journey**: `j-20260916-x3` ("Pedágio — ARTESP como auditoria/redundância,
sem geo")
**Unit**: `qualroteiro/root`, wave única — depende de `j-20260916-y9` Wave 3
(`services/data-ingest`, ingestão real OSM) estar `merged` (confirmado:
`67c6549`/PR #43, em `origin/main`).
**Scope**: `services/data-ingest` (novo módulo, read-only sobre
`TollPlazaRecord`), mais `docs/audits/artesp-tariff-audit.md` (relatório de
saída, versionado).
**SDD route**: `aipe skill match` — nenhum kit de SDD instalado neste
workspace (mesmo resultado das duas waves anteriores deste pacote). Este
artifact set segue o formato já estabelecido por
`specs/002-t5-wave3-osm-toll-ingest`.

---

## Problem

O app tem tarifa de duas fontes (ANTT sem tarifa; OSM com tarifa derivada da
tag `charge`, Wave 3 de `j-20260916-y9`). Não existe nenhuma forma de saber
se a tarifa que o OSM trouxe bate com a tarifa oficial publicada pela ARTESP
para as praças de rodovias estaduais de SP. Esta jornada fecha esse buraco
de confiança com um job de **auditoria read-only** — não uma nova fonte de
`TollPlazaRecord` (o PDF da ARTESP não tem coordenada nenhuma; ver
orientation.md decisão #1).

## Real findings from live research (this unit, 2026-09-17)

- PDF real baixado e inspecionado: `GET` direto sem auth,
  `application/pdf`, **1.257.140 bytes**, `last-modified: 2025-12-02` —
  bate exatamente com a pesquisa do orientation.md.
- **136 praças reais** no formato simples de 2/3 colunas (não "~124" — o
  número do orientation.md era uma estimativa; a contagem precisa, checada
  de duas formas independentes — parser estruturado e contagem crua de
  pares `R$ ... R$ ...` no texto extraído — bate exatamente).
- **11 praças** em formato CAT-1..9 sob a concessionária **`L29 -
  ViaPaulista`** — não "Rodovias do Tietê" como o orientation.md supôs
  (Rodovias do Tietê é uma concessionária real no documento, mas usa o
  formato simples de 3 colunas igual a todo mundo; ViaPaulista é quem tem a
  tabela diferente). **Excluídas do parser V1** — ver "Deliberate
  limitations".
- **`PASSEIO` e `COMERCIAL POR EIXO` são numericamente idênticos nas 136
  linhas reais** — achado real, confirmado duas vezes (regex cru sobre o
  texto extraído, e de novo estruturalmente sobre as 136 linhas parseadas).
  `COMERCIAL POR EIXO` é uma tarifa **por eixo**, não uma categoria "veículo
  comercial" plana — o pedágio real de um caminhão é
  `tarifaComercialPorEixo × número de eixos`. Isso mudou a comparação: ver
  `artesp-compare.ts`.
- **`highway`/`uf` são `'Não informado (OSM)'`/`'BR'` em 100% das 489 linhas
  `source: 'osm'` reais** (`select highway, uf, count(*) ... group by
  highway, uf` no Postgres local) — confirma em dados reais o que
  `osm-toll-plazas.ts` já documentava como cobertura de tag (`ref`: 3% dos
  nós Overpass). Usar rodovia como filtro duro de matching (a sugestão-exemplo
  do orientation.md) rejeitaria **100%** das linhas ARTESP antes mesmo do
  matching começar — mudança de heurística obrigatória, não uma escolha de
  gosto. Ver "Design decisions".
- **As 489 linhas OSM reais cobrem o Brasil inteiro, não só SP**: `lat`
  -31.85..-4.56, `lng` -63.65..-34.94; só 262/489 (54%) caem numa bounding
  box aproximada de SP. 101 concessionárias distintas no campo
  `concessionaire`, incluindo operadoras de BA/MT/TO/RJ misturadas.
- **Achado real de produção** (rodado de verdade contra os dados reais —
  ver "Evidence"): **110 pares casados, 90 batem, 20 divergem, 0 casados sem
  tarifa OSM, 26 ARTESP sem match, 152 OSM (dentro da bbox de SP) sem
  match.**

## Scope

**In:**
- `src/artesp-pdf.ts` — `downloadArtespTarifasPdf()` (fetch cru),
  `extractArtespPdfLines()` (reconstrução de layout via `pdfjs-dist`,
  posição x/y dos text items — texto em ordem de leitura padrão do
  `pdfjs-dist`/`pdftotext` sem `-layout` é column-major nesse PDF específico,
  inutilizável), `parseArtespTarifaLines()` (parser puro, testável com linhas
  literais), `downloadAndParseArtespTarifas()` (wrapper de conveniência).
- `src/artesp-match.ts` — `matchArtespToOsm()`: filtro de bounding box de SP
  (não rodovia — ver achados acima) + fuzzy matching por nome normalizado
  (`normalizePlazaName`, Levenshtein) + bônus leve de concessionária +
  corte por `scoreThreshold` + pareamento guloso (greedy bipartite).
- `src/artesp-compare.ts` — `compareTariffs()`: Passeio vs `car`, Motos vs
  `motorcycle` (quando ARTESP tem a coluna), Comercial por eixo vs
  `truck_N_axle / N` (dividido de volta à taxa por eixo — ver achados
  acima). Limiar default `DEFAULT_DIVERGENCE_THRESHOLD` (R$1,00 OU 10%,
  documentado e ajustável).
- `src/artesp-audit.ts` — `runArtespAudit()`: orquestra download+parse+leitura
  Postgres (read-only, só `findMany`)+match+compare+relatório Markdown.
- `src/cli-artesp-audit.ts` — entrypoint on-demand
  (`pnpm audit:artesp:once`), escreve em `docs/audits/artesp-tariff-audit.md`
  por padrão (path customizável via `argv[1]`).
- `src/index.ts` (modificado) — exporta a nova superfície.
- `package.json` (modificado) — dependência `pdfjs-dist` (pin `4.10.38`),
  script `audit:artesp:once`.
- `tsconfig.json` (modificado) — `lib` local com `DOM` adicionado (ver
  "Design decisions").
- `tests/artesp-pdf.test.ts`, `tests/artesp-match.test.ts`,
  `tests/artesp-compare.test.ts`, `tests/artesp-audit.test.ts`.
- `docs/audits/artesp-tariff-audit.md` — relatório real, versionado como
  evidência do critério de aceite "rodar o CLI de verdade".

**Out (deliberado, per orientation.md):**
- Qualquer escrita em `TollPlazaRecord`/schema Prisma — read-only.
- As 11 praças CAT-1..9 (`L29 - ViaPaulista`) — contadas
  (`excludedCatFormatCount`), nunca descartadas silenciosamente.
- Histórico de tarifas — só "Valor Atual".
- Qualquer mudança em `apps/api`, `apps/web`, `packages/tolls`.
- Agendamento BullMQ — só CLI sob demanda.

## Design decisions

### Reconstrução de layout via `pdfjs-dist`, não `pdftotext`/`pdf-parse`

Pesquisa feita antes de escrever o parser: comparei `pdftotext` (poppler,
só para inspeção local, nunca uma dependência de produção) em modo padrão
vs. `-layout` contra o PDF real. Modo padrão intercala células de colunas
diferentes fora de ordem (a biblioteca de tabela usada para gerar o PDF
desenha uma coluna inteira, depois a próxima — não linha por linha); `-layout`
(reconstrução posicional) é o que de fato funciona. `pdfjs-dist` expõe `x`/`y`
por text item (`item.transform`), então `extractArtespPdfLines()`
reimplementa a mesma ideia: agrupa items em linhas físicas por `y` (tolerância
2.2pt — jitter real de baseline é ~1-2pt, espaçamento real entre linhas é
maior), ordena por `x` dentro da linha, reinsere 2+ espaços onde o gap
horizontal excede ~1.5 larguras de caractere — mesma convenção de
`pdftotext -layout`. Isso mantém a dependência de produção só em
`pdfjs-dist` (sem binário `poppler` no runtime/CI).

`tsconfig.json` local ganhou `"lib": ["ES2022", "DOM"]` (chave só desse
pacote, `tsconfig.base.json` intocado) porque os `.d.ts` do `pdfjs-dist`
referenciam tipos de browser (`HTMLCanvasElement`, `Worker`,
`ReadableStream`...) em toda a superfície da API, mesmo só importando
`getDocument`/`getTextContent` — TypeScript precisa resolver esses tipos
transitivamente. `skipLibCheck: true` (já herdado de `tsconfig.base.json`)
evita quebrar por causa de `@napi-rs/canvas` (dependência opcional do
`pdfjs-dist`, instalada pelo pnpm, com `.d.ts` própria incompatível com a
versão de `@types/node` deste repo) — confirmado necessário/suficiente por
teste real (`npx tsc` com e sem cada flag).

### Multi-line cells: janela de 1 linha antes / 1 linha depois, não uma reconstrução exaustiva

Nome de rodovia e/ou nome de praça às vezes quebram em mais de uma linha
física (colunas estreitas). `parseArtespTarifaLines()` sempre lê
`roadCode`/`kmRaw`/tarifas da linha "terminal" (a que carrega o km + valores
R$) e só empresta texto adicional de (1) a linha física imediatamente
**anterior**, se ela não parecer ela mesma uma linha completa (guarda
necessária contra um bug real encontrado: duas linhas completas
consecutivas — "VALINHOS" em dois km diferentes — grudando uma na outra), e
(2) a linha física imediatamente **seguinte**, só quando a própria linha
terminal não carregava nome de praça nenhum (gatilho estreito que bate com
o único padrão real que precisa de continuação à direita — sub-tabela SPMAR
"Trecho Leste" — sem disparar em falso quando uma linha completa é seguida
pelo início do wrap de OUTRA linha — bug real encontrado e corrigido durante
o desenvolvimento, coberto por teste de regressão).

Essa janela de 1+1 é uma escolha deliberada e documentada, não uma
reconstrução exaustiva de tabela: uma pequena sub-tabela real (4 praças,
SPMAR "Trecho Leste") quebra o nome da praça em TRÊS linhas físicas (uma
antes E uma depois da janela). Para essas 4 linhas especificamente,
`plazaName` sai truncado (falta a primeira e/ou última palavra) —
`roadCode`/`kmRaw`/toda tarifa dessas 4 linhas não é afetado (sempre lido só
da linha terminal), e o nome truncado ainda é distintivo o bastante para o
fuzzy matching tolerar (ou, pior caso, a linha aparece como "ARTESP sem
match" — resultado honesto, não uma resposta errada silenciosa).

### Matching: bounding box de SP + nome fuzzy, NÃO rodovia como filtro duro

Ver "Real findings" acima — `highway`/`uf` são inutilizáveis nas 489 linhas
reais (100% sentinela). `matchArtespToOsm()` usa: (1) bounding box
aproximada de SP sobre `lat`/`lng` do OSM (dado real e preciso, ao contrário
de `highway`/`uf`) como filtro duro; (2) `normalizePlazaName()` (remove
diacríticos, parênteses, sufixo de faixa/número, palavras de ruído) +
similaridade de Levenshtein normalizada como sinal principal; (3) um bônus
pequeno (+0.15) por token de concessionária compartilhado — NUNCA um filtro
duro, porque nomes legais oficiais da ARTESP e a tag `operator` do OSM
divergem o bastante (rebrands reais — "Motiva" é o rebranding 2025 da CCR)
para produzir falsos negativos com um filtro rígido. Limiar default `0.55`
(`scoreThreshold`, ajustável), calibrado contra pares reais do próprio
documento (ver `artesp-match.ts`'s doc-comment).

**Limitação real observada na rodada real** (ver "Evidence"): nomes de
cidade curtos/comuns (ex. "Rio Claro", que existe em mais de uma praça real
de rodovias diferentes) podem casar com a praça física errada — o relatório
real mostrou uma divergência de -132% para "SP-191/RIO CLARO" justamente
por esse motivo. Uma divergência muito grande num par casado é, portanto,
também um sinal para revisar o PRÓPRIO match, não necessariamente uma
divergência de tarifa real — documentado no relatório e aqui, não escondido.

### `Comercial por eixo` vs `truck_N_axle` — dividir de volta, não comparar bruto

Achado real (ver acima): ARTESP `Comercial por eixo` é uma tarifa por eixo,
numericamente igual a `Passeio` nas 136 linhas reais. OSM's `truck_N_axle`
é construído do mesmo jeito (`osm-charge.ts`:
`hgvPerAxleBrl * axleCount`). A comparação correta é
`tariffComercialPorEixo` (ARTESP, já por eixo) contra
`osmTariff[truck_N_axle] / N` (OSM, dividido de volta a uma taxa por eixo) —
não o valor bruto da categoria. Confirmado necessário: comparar bruto
(13,70 vs 27,40) classificaria como divergência grave um par que na
verdade bate perfeitamente.

## Acceptance

- `pnpm --filter @qualroteiro/data-ingest typecheck/lint/test` verdes — **78
  testes passam** (11 arquivos de teste: os 7 pré-existentes mais
  `artesp-pdf.test.ts` (13), `artesp-match.test.ts` (13),
  `artesp-compare.test.ts` (8), `artesp-audit.test.ts` (3)).
- Teste: linhas fixture reais do PDF (Via Anhanguera/Perus R$13,70,
  Rodovia dos Bandeirantes/Sumaré R$12,10, mais casos reais com e sem coluna
  Motos, mais 4 regressões de bugs reais encontrados durante o
  desenvolvimento) parseiam certo.
- Teste: matching por nome funciona com nome levemente diferente entre
  fontes (`"PERUS"` vs `"Pedágio Perus (sentido Sul)"`, incluindo um typo
  real do OSM — `"Aparecida doTabuado"` vs `"Aparecida do Tabuado"`), não
  força um match errado para nomes sem relação, nunca atribui a mesma linha
  OSM a duas linhas ARTESP.
- Teste: `compareTariffs()` classifica "bate" vs "diverge" corretamente dado
  o limiar (incluindo o caso real Perus: R$13,70 vs R$14,50 = -5,8%/R$0,80,
  dentro do limiar = bate), e a divisão por eixo do `Comercial por eixo`.
- **Rodada real contra Postgres local** (`localhost:5433`, compartilhado —
  ver "Evidence"): CLI rodado de verdade contra as 489 linhas `source:
  'osm'` reais (Wave 3 de `j-20260916-y9`, já `merged` em `origin/main`).
  Números reais: **136 praças ARTESP parseadas, 11 excluídas (CAT-1..9), 489
  linhas OSM lidas, 227 fora da bbox de SP, 110 pares casados (90 batem, 20
  divergem, 0 sem tarifa OSM), 26 ARTESP sem match, 152 OSM sem match.**
  Relatório real commitado em `docs/audits/artesp-tariff-audit.md`.
- `git diff --name-only origin/main..HEAD` só toca `services/data-ingest/**`
  e `docs/audits/artesp-tariff-audit.md`.
- `pnpm -w build` verde.

## Deliberate limitations

- **11 praças CAT-1..9 (`L29 - ViaPaulista`) fora do parser V1** — contadas
  (`excludedCatFormatCount: 11`), documentado, não um bug.
- **`plazaName`/`roadName` são best-effort para células que quebram em mais
  de 2 linhas físicas** (uma sub-tabela real de 4 praças) — nunca afeta
  `roadCode`/`kmRaw`/tarifas.
- **`concessionaire` é best-effort/cosmético** — nunca usado como filtro de
  matching; pode ficar incompleto para algumas seções (mesma classe de
  limitação do nome de rodovia/praça).
- **Matching por nome comum pode casar a praça física errada** (ex. "Rio
  Claro") — uma divergência muito grande é também um sinal para revisar o
  match, documentado no relatório.
- **Bounding box de SP é aproximada, não o polígono real do estado** — sem
  dependência de shapefile/geo library para este job de auditoria V1.
- **Pareamento guloso (greedy), não um assignment globalmente ótimo** —
  irrelevante para o tamanho real deste dataset (136 x ~262), auditável
  lendo a lista de scores em ordem.
