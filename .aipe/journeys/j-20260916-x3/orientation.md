# Orientation Spec — j-20260916-x3 (Pedágio — ARTESP como auditoria/redundância, sem geo)

> The coordinator's cross-package orientation for this demand. The PE **approves**
> this before any dispatch. Amend it (bump the version) when an escalation changes
> the cross-package shape, then get re-approval. Implementation detail belongs to
> each specialist's own SDD (committed into its PR), not here.

> PE pediu (2026-09-16/17) pra avançar a fonte ARTESP como redundância real
> sobre o que o OSM já traz. Pesquisa real feita antes de especificar: baixei
> e inspecionei o PDF oficial "Valor Atual das Tarifas"
> (`www.artesp.sp.gov.br/dx/api/dam/.../renditions/53b3922a-.../?binary=true`,
> `GET` direto sem auth, `application/pdf`, 1.257.140 bytes,
> `last-modified: 2025-12-02`). Também chequei o Portal de Dados Abertos da
> ARTESP (`dadosabertos.artesp.sp.gov.br/dataset/pedagio`) — é só um stub de
> metadado apontando pro mesmo PDF institucional, não um dataset
> estruturado. Confirmado de novo: **não existe fonte geo (lat/lng) da
> ARTESP**, só o PDF de tarifa.

## Decisão de arquitetura tomada pelo coordenador (documentada, não perguntada)

**Isto NÃO é uma nova fonte de praça (como ANTT/OSM), é uma auditoria de
tarifa.** Achado real ao inspecionar o PDF: **~124 praças** num formato de
tabela por concessionária (`concessionária → rodovia → praça → km →
Passeio (R$) → Comercial por eixo (R$)`), mas **o formato varia por
concessionária** — uma delas (Rodovias do Tietê) tem uma 3ª coluna
"MOTOS", e só essa mesma concessionária tem **11 praças adicionais** com
uma tabela completamente diferente (categorias CAT-1 a CAT-9 por
multiplicador de eixo, 3 variantes de preço: sem arredondar/manual/AVI).
Não é uma tabela uniforme — o parser precisa reconhecer pelo menos 2
formatos distintos e documentar como trata o 3º (CAT-1..9) se aparecer.

**Não há coordenada em lugar nenhum do documento** — só nome da praça,
rodovia e KM. `TollPlazaRecord.lat`/`lng` são `Float` **obrigatórios** no
schema atual (usados como pin no mapa em `apps/web`, fora de escopo desta
jornada). Portanto uma linha da ARTESP **não pode virar um `TollPlazaRecord`
novo** do jeito que o OSM virou — não tem geo pra preencher esses campos
sem inventar dado.

**Escopo decidido**: um **job/relatório de auditoria**, não um pipeline de
ingestão de praça nova. O job casa cada praça da ARTESP (por rodovia +
nome aproximado de praça/município) contra praças **já existentes no
Postgres com `source: 'osm'`** (da Wave 2/3 de `j-20260916-y9`), compara a
tarifa "Passeio" (categoria carro) e "Comercial por eixo" (categoria
caminhão por eixo) oficiais da ARTESP contra o que o OSM trouxe pra
`car`/`truck_2_axle` (e demais eixos, escalando a mesma proporção), e
produz um relatório de divergência (praças que batem, praças que divergem
acima de um limiar, praças da ARTESP sem correspondente OSM encontrado e
vice-versa). **Não escreve em `TollPlazaRecord`, não muda `/routes/plan`,
não toca `apps/web`.** É puramente um relatório — a "redundância" que o PE
pediu é visibilidade sobre onde o OSM diverge do oficial, não uma terceira
fonte de pin.

**Dependência real, não delegável**: pra comparar contra o OSM, precisa
haver linhas `source: 'osm'` de verdade no Postgres — ou seja, **Wave 3 de
`j-20260916-y9` (job real de ingestão OSM) precisa estar `merged` antes
desta jornada poder rodar de fato.** Hoje só a Wave 1 (parsing puro) está
pronta; Wave 2 está em progresso; Wave 3 ainda não foi despachada. Esta
spec pode ser aprovada agora, mas o dispatch fica bloqueado até Wave 3
`merged` — ver Sequencing.

## Problem

O app tem tarifa real de duas fontes agora (ANTT sem tarifa, OSM com
tarifa derivada de forma própria da tag `charge`). Não há nenhuma forma de
saber se a tarifa que o OSM trouxe bate com a tarifa oficial publicada pelo
regulador estadual (ARTESP) para as praças de rodovias paulistas sob
concessão estadual. Esta jornada fecha esse buraco de confiança sem
assumir o risco de tratar um PDF sem coordenada como fonte de geo.

## Cross-package contracts

- **`services/data-ingest`** (único pacote tocado): lê o PDF da ARTESP
  (novo módulo de parsing, output estruturado: concessionária, rodovia,
  praça, km, tarifaPasseio, tarifaComercialPorEixo — mais o formato
  CAT-1..9 onde existir, documentar como reconciliar com as duas colunas
  simples), lê `TollPlazaRecord` (`source: 'osm'`) do Postgres via Prisma
  (read-only nesta tabela), produz um relatório (arquivo, formato a
  escolher pelo dev — Markdown ou JSON, documentar a escolha).
- **Nenhum contrato com `packages/tolls`, `apps/api` ou `apps/web`** — essa
  é a diferença chave desta jornada em relação às anteriores. Não há
  schema novo, não há endpoint novo, não há mudança de UI.

## Per-package scope

### qualroteiro/root (services/data-ingest)

- **Scope:**
  1. Parser do PDF ARTESP: baixa (`GET` direto, sem chave) e extrai as
     ~124 praças do formato de 2-3 colunas (Passeio, Comercial por eixo,
     Motos quando presente). Formato CAT-1..9 (11 praças da Rodovias do
     Tietê): tratar como fora do parser V1 se o esforço não compensar —
     decisão do dev, documentar explicitamente quantas praças ficam de
     fora e por quê (não falhar silenciosamente, contar e reportar).
  2. Função de matching: casa cada praça ARTESP (rodovia + nome + km
     aproximado) contra as praças `source: 'osm'` do Postgres. Nome exato
     não deve ser assumido — os nomes divergem entre fontes (ex. formato
     de acentuação, abreviação). Documentar a heurística de match escolhida
     (ex. normalização + distância de string + mesma rodovia como filtro
     duro) e o limiar de confiança.
  3. Comparação de tarifa: ARTESP "Passeio" vs OSM `car`, ARTESP
     "Comercial por eixo" vs OSM `truck_2_axle` (e demais eixos,
     multiplicando a mesma proporção). Definir e documentar o limiar de
     divergência que conta como "achado" (sugestão: >10% ou >R$1,00, o que
     for maior — dev pode ajustar e deve justificar).
  4. Relatório final: praças que batem (dentro do limiar), praças que
     divergem (com os dois valores lado a lado), praças ARTESP sem match
     OSM, praças OSM (das que estão em rodovias estaduais de SP) sem match
     ARTESP. Não é preciso persistir no banco — arquivo de saída basta.
  5. CLI on-demand (reaproveitar o padrão já existente em
     `services/data-ingest/src/cli.ts` — comando novo, não substituir os
     existentes). **Não precisa de agendamento BullMQ** — é uma auditoria
     sob demanda, não um dado que o app serve ao vivo.
- **Acceptance:**
  - `pnpm --filter @qualroteiro/data-ingest typecheck/lint/test` verdes.
  - Teste: fixture real de algumas linhas do PDF (usar os exemplos reais
    citados nesta spec — Via Anhanguera/Perus R$13,70, Rodovia dos
    Bandeirantes/Sumaré R$12,10 etc.) parseiam certo nos dois formatos
    simples (com e sem coluna Motos).
  - Teste: matching por rodovia+nome funciona em casos de nome levemente
    diferente entre fontes (usar um caso sintético realista, documentar a
    heurística testada).
  - Teste: comparação de tarifa classifica corretamente "bate" vs "diverge"
    dado o limiar escolhido.
  - Se Postgres local disponível com praças `source: 'osm'` de verdade
    (depende de Wave 3 de `j-20260916-y9` já ter rodado): rodar o CLI de
    verdade uma vez, conferir que o relatório sai com números reais, não
    fixture. Se ainda não houver linhas OSM suficientes no Postgres local
    no momento da execução, documentar isso explicitamente no relatório de
    entrega (não é falha do dev, é sequenciamento).
  - `git diff --name-only origin/main..HEAD` só `services/data-ingest/**`
    (mais o relatório de saída, se for versionado em `docs/`).
  - SDD conforme `aipe skill match`.

## Sequencing

- **Wave única:** `qualroteiro/root` (`services/data-ingest`) — dev: a
  definir → QA: a definir (mesmo padrão das ondas anteriores, especialista
  diferente do dev).
  - **BLOQUEADO até `j-20260916-y9` Wave 3 (`services/data-ingest`, job
    real de ingestão OSM) estar `merged`** — sem isso não há linha
    `source: 'osm'` real no Postgres pra comparar. Spec pode ser aprovada
    agora; dispatch só depois.

## Out of scope

- Qualquer escrita em `TollPlazaRecord` ou mudança de schema Prisma — isso
  é auditoria read-only sobre uma tabela que já existe.
- As 11 praças em formato CAT-1..9 (Rodovias do Tietê), se o dev decidir
  que não compensa o esforço no V1 — documentar como excluídas, não tratar
  como bug.
- Histórico de tarifas (contratos vigentes/encerrados) — só a tarifa atual
  ("Valor Atual das Tarifas") está em escopo.
- Qualquer mudança em `apps/api`, `apps/web` ou `packages/tolls`.
- Agendamento automático (BullMQ) do job de auditoria — só CLI sob demanda
  por enquanto; virar recorrente é refinamento futuro se o PE quiser.
