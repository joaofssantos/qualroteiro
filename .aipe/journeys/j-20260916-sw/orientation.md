# Orientation Spec — j-20260916-sw (G1 — Google Places: busca real + guarda de custo)

> Início de uma extensão do F2 (nomeada "G" — dados reais + busca geográfica),
> decidida com o PE em 2026-09-16. `GOOGLE_PLACES_API_KEY` já no `.env`.
> Preços reais consultados na doc oficial do Google (não é estimativa):
> Nearby Search / Text Search = 5.000 chamadas grátis/mês, depois
> US$25,60/1000. Place Details = 5.000 grátis/mês, depois US$13,60/1000.

## Problem

Hospedagem/Restaurantes/Atividades hoje são formulário puro (usuário digita
tudo à mão). G1 é a fundação pra trocar isso por **busca real** — o usuário
pesquisa por categoria perto de um ponto (o destino da viagem), recebe um
**range de resultados** com nome/endereço/coordenadas, escolhe um (que
preenche o formulário — a entrada manual continua existindo, como
complemento). Só o backend nesta unidade; a UI (mapa mostrando o range,
G2/G3-5) vem depois.

**Requisito não-negociável desta unidade**: nunca deixar a API do Google ser
chamada sem limite. Um teto mensal configurável, **por SKU**, com um
disjuntor que recusa a busca graciosamente ao bater o teto — não é só
logging, é proteção ativa contra fatura.

## Cross-package contracts

Unidade única, `qualroteiro/api`. Endpoint novo, nenhum contrato existente
muda.

- **`GET /places/nearby`** — query `lat`, `lng` (obrigatórios, número),
  `category` (`hospedagem` | `restaurantes` | `atividades`, obrigatório),
  `radiusMeters` (opcional, default 3000).
  - `200 { places: PlaceResult[] }` —
    `PlaceResult = { id: string, name: string, address: string, lat: number, lng: number, category: string }`.
  - `400` — `lat`/`lng`/`category` inválidos, mensagem nomeando o campo.
  - `503 { error: "..." }` — teto mensal do SKU atingido (não é erro do
    Google, é o disjuntor nosso barrando a chamada **antes** de sair).
  - `502` — a chamada ao Google falhou/deu timeout.
  - **V1 usa só Nearby Search** (não Place Details) — a resposta do Nearby
    Search já tem nome/endereço/coordenadas, que é tudo que o range de
    escolha precisa. Enriquecer com telefone/horário/foto via Place Details
    fica pra depois, se for pedido — não inventar essa chamada agora (cada
    SKU novo é outra cota de 5.000 pra gerenciar).
  - `apps/web` (fora desta unidade) vai consumir isso depois, em G3-5. Não
    precisa ficar 100% travado no shape se uma chamada real revelar algo —
    mas qualquer mudança de shape depois de esta unidade fechar é emenda
    formal, não silenciosa.

## Per-package scope

### qualroteiro/api
- **Scope:**
  1. **Adapter** `apps/api/src/providers/google-places.ts` — mesmo padrão de
     `ors-routing.ts`/`ors-geocode.ts` (config injetável, `fetchImpl`
     injetável pros testes, erro tipado). Chama a **Places API (New) — Nearby
     Search** (`POST https://places.googleapis.com/v1/places:searchNearby`,
     `X-Goog-Api-Key` + `X-Goog-FieldMask` nos headers — o field mask é
     importante: pedir só `places.id,places.displayName,places.formattedAddress,places.location`
     mantém a resposta pequena e é prática recomendada do Google, não pedir
     campos à toa). Mapear `category` pra `includedTypes` do Google:
     `hospedagem → lodging`, `restaurantes → restaurant`,
     `atividades → tourist_attraction`.
  2. **`readGooglePlacesEnv`** em `apps/api/src/env.ts`, mesmo padrão de
     `readOrsEnv`/`readClerkEnv` — falha alto e claro no startup se
     `GOOGLE_PLACES_API_KEY` ausente, mesma mensagem-padrão apontando pro
     `.env.example`.
  3. **Contador de uso persistido** — novo modelo Prisma
     `ApiUsageCounter { sku: String, yearMonth: String (YYYY-MM), count: Int,
     @@unique([sku, yearMonth]) }`. Incrementa atomicamente
     (`prisma.apiUsageCounter.upsert` com `increment`) **depois** de uma
     chamada bem-sucedida ao Google — não conta chamada que falhou antes de
     sair (isso mentiria sobre uso real). Precisa de migration nova (o banco
     Postgres local já está de pé — rodar de verdade, não só `prisma
     validate` como aconteceu antes por falta de banco).
  4. **Disjuntor** — antes de chamar o Google, ler o contador do mês atual
     pro SKU `places-nearby-search`; se `>= GOOGLE_PLACES_SEARCH_MONTHLY_CAP`
     (env, default **4500** — abaixo do teto grátis de 5.000, com margem),
     devolver `503` sem chamar o Google. Injetável pros testes (não pode
     depender de banco real pra testar a lógica do disjuntor).
  5. **`GET /admin/places-usage`** — `200 { usage: [{ sku, yearMonth, count,
     cap }] }`, lê o contador atual. Sem auth nesta unidade (dado
     operacional, não de usuário — declarar isso como limite explícito, não
     esconder). `apps/api/.env.example` documenta `GOOGLE_PLACES_API_KEY` e
     `GOOGLE_PLACES_SEARCH_MONTHLY_CAP` (placeholder + default).
  6. Endpoint `GET /places/nearby` juntando tudo: valida query → checa
     disjuntor → chama o adapter → incrementa contador → devolve.
  - **Não** tocar `apps/web`, `packages/*`, config de raiz. Não usar Place
    Details nesta unidade.
- **Acceptance:**
  - `pnpm --filter @qualroteiro/api test/typecheck/lint` verdes.
  - Teste: `GET /places/nearby` com provider mockado devolve `places[]` no
    shape certo, mapeando `category` pro `includedTypes` certo do Google.
  - Teste: query inválida (`lat`/`lng` ausente, `category` fora do enum) →
    `400` nomeando o campo.
  - Teste: **disjuntor** — contador no cap → `503`, sem chamar o adapter (o
    mock do provider não pode ser invocado nesse caso — provar isso, não só
    o status code).
  - Teste: chamada bem-sucedida incrementa o contador; chamada que falha
    (erro do provider) **não** incrementa.
  - Teste: `GET /admin/places-usage` devolve o contador certo.
  - **Se o Postgres local estiver disponível** (estava, na sessão anterior —
    conferir): rodar a migration de verdade e uma chamada real ao Google
    Places com a key do `.env`, evidência real, não só mockada. Se não
    estiver disponível no momento do dispatch, declarar isso como limite,
    igual A2 fez.
  - `git diff --name-only origin/main..HEAD` só `apps/api/**`.
  - Nenhum segredo (`GOOGLE_PLACES_API_KEY`) em diff/commit/log.
  - SDD: `aipe skill match --task-type feature --size medium`.

## Sequencing

- **Wave 1 (única):** `qualroteiro/api` (dev: Pete Campbell) → QA Joan
  Holloway.

G2 (mapa persistente compartilhado, `apps/web`) é a próxima jornada, depois
desta. G3-5 (ligar busca nos 3 módulos) dependem de G1 **e** G2.

## Per-unit dispatch envelopes

`aipe execution propose --journey j-20260916-sw` — `subagent/claude-code/reasoning/normal`
(cost-index 4). Razão: superfície nova com dinheiro real em jogo (SKU pago) —
o disjuntor é a parte que exige julgamento (onde checar, o que conta como
"chamada bem-sucedida", atomicidade do contador) — errar aqui custa fatura
de verdade, não é mecânico. Descartado `standard`. QA em `standard` (mecânico
contra critério explícito, mas com atenção redobrada em provar que o
disjuntor barra ANTES de gastar — é o critério mais importante do lote).

## Out of scope

- Place Details (enriquecimento com foto/telefone/horário) — outra unidade
  se for pedido depois.
- UI (`apps/web`) — G2 e G3-5.
- Autenticação do `/admin/places-usage`.
- Autocomplete do Google (SKU diferente, não usado aqui).
- Qualquer coisa em `packages/*` — o tipo `Place`/`GeocodeProvider` de
  `@qualroteiro/geo` não muda; este endpoint é novo e paralelo, não uma
  extensão do geocoding existente.
