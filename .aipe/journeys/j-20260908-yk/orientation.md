# Orientation Spec — j-20260908-yk

> The coordinator's cross-package orientation for this demand. The PE **approves**
> this before any dispatch. Amend it (bump the version) when an escalation changes
> the cross-package shape, then get re-approval. Implementation detail belongs to
> each specialist's own SDD (committed into its PR), not here.

## Problem

`qualroteiro` needs its **first functional module** and a **screen/architecture
skeleton that later modules plug into without touching the core**.

Módulo F1 — **Rota & Custos**: usuário informa origem, destino e paradas + perfil
de veículo + consumo + preço do combustível; o app calcula a rota e devolve, por
alternativa: distância, tempo, **custo de pedágio praça-a-praça**, **custo de
combustível**, e um painel de **pontos na rota** (praças de pedágio e postos).
Inspirado em qualp / rotasbrasil / mapeia.

Decisões do PE (2026-09-08) que delimitam este F1:

1. **Escopo:** núcleo mínimo — rota → pedágio + combustível + mapa + pontos na
   rota. **Anônimo** (sem login, sem rotas salvas, sem PDF, sem piso ANTT).
2. **Motor de rota:** provider **gerenciado** (ex. OpenRouteService) atrás de uma
   interface `RoutingProvider`; Valhalla self-host fica para depois, sem quebrar
   nada.
3. **Dados de pedágio:** **dataset seed manual** de 2–3 corredores (SP–RJ via
   Dutra, SP–Curitiba via Régis Bittencourt, SP–Campinas via Bandeirantes). Sem
   `data-ingest` neste F1.
4. **Auth:** fora. F1 100% anônimo.
5. **Visual:** **identidade própria** com shadcn/ui; layout de resultado em
   **split** (mapa à esquerda, painel de custos à direita).
6. **Processo:** spec-driven (spec-kit), **backend-first** — contrato e cálculo
   reais num corredor antes das telas.

**Extensibilidade (requisito explícito do PE):** a estrutura tem que aceitar
novos módulos (planejamento de viagem, criação de roteiro, frete) **só
adicionando um registro**, sem alterar o núcleo. Isso é acceptance, não desejo.

## Cross-package contracts

Do `relations/graph.yaml`: `qualroteiro/api` **consumes** `qualroteiro/web`
(Fastify HTTP chamado pelo browser); `qualroteiro/api` **shares-infra** com
`qualroteiro/root`. Acrescenta-se aqui a dependência de código nova:
`qualroteiro/api` **importa** os pacotes de domínio criados em
`qualroteiro/root`.

- **`root` → `api`** — `root` publica quatro pacotes de domínio como workspace
  packages `@qualroteiro/{geo,routing,tolls,fuel}`, cada um com **contrato de
  tipos + funções puras** (sem I/O de rede). `api` importa esses contratos. `root`
  **tem que estar `verified`/`merged` antes de `api` ser despachado.**
  - `@qualroteiro/fuel`: `estimateFuel({ distanceKm, consumptionKmPerL, pricePerL }) → { liters, cost }`.
  - `@qualroteiro/tolls`: `matchTolls({ routeGeometry, axleCategory, corridorHint? }) → { plazas: TollPlaza[], total }` + **seed dataset** dos 2–3 corredores (praça: nome, concessionária, rodovia, km, lat/lng, tarifa por categoria de eixo). Casamento praça↔rota é geométrico (praça dentro de um buffer do traçado).
  - `@qualroteiro/routing`: **interface** `RoutingProvider` (`route(req) → RouteResult` com `geometry`, `distanceKm`, `durationMin`, `alternatives[]`) + tipos de request/response. **Sem** implementação de provider aqui.
  - `@qualroteiro/geo`: tipos de `Place` / `GeocodeProvider` + helpers de geometria puros (ponto mais próximo do traçado, marcação de km, buffer). **Sem** provider aqui.
- **`api` → `web`** — `api` expõe o **contrato HTTP** que `web` consome. `api`
  **tem que estar `verified`/`merged` antes de `web` ser despachado**
  (backend-first). Superfície mínima:
  - `POST /routes/plan` — body `{ origin, destination, waypoints[], vehicle{ type, axleCategory, consumptionKmPerL }, fuelPricePerL }` → `{ routes: PlannedRoute[] }` onde `PlannedRoute = { geometry, distanceKm, durationMin, tolls{ plazas[], total }, fuel{ liters, cost }, points{ tolls[], fuelStations[] } }`.
  - `GET /places/search?q=` → `{ places: Place[] }` (autocomplete).
  - `GET /health` — mantém.
  - O contrato de resposta é **versionado neste doc**; mudança de shape depois da
    aprovação = amend + re-aprovação.

## Per-package scope

### qualroteiro/root
- **Scope:** Criar os quatro pacotes de domínio como workspace packages sob
  `packages/` (`geo`, `routing`, `tolls`, `fuel`), cada um com `package.json`,
  `tsconfig`, build via turbo, e **APENAS tipos + lógica pura**:
  - `fuel`: cálculo de litros e custo.
  - `tolls`: tipos de praça/corredor, algoritmo de casamento praça↔traçado por
    proximidade geométrica, e o **seed dataset** curado dos 2–3 corredores (dados
    versionados no pacote, formato JSON/TS tipado; tarifas por categoria de eixo).
  - `routing`: interface `RoutingProvider` + tipos de request/response + tipos de
    alternativa. Nenhuma chamada de rede.
  - `geo`: tipos `Place`/`GeocodeProvider` + helpers de geometria (nearest point
    on line, km marker, buffer/contains) puros e testados.
  - Ajustar `pnpm-workspace.yaml`/`turbo.json` se necessário para os novos
    pacotes entrarem no grafo de build.
- **Acceptance:**
  - `pnpm -w build` e `pnpm -w typecheck` verdes com os quatro pacotes novos.
  - `estimateFuel` provado por teste: dado `distanceKm=430, consumptionKmPerL=10,
    pricePerL=6` → `liters≈43`, `cost≈258` (tolerância documentada).
  - `matchTolls` provado por teste: dado o traçado seed do corredor SP–RJ (Dutra)
    e `axleCategory` de carro (2 eixos), retorna a lista de praças **daquele
    corredor** com tarifas > 0 e um `total` = soma das tarifas; um traçado que não
    passa por nenhuma praça retorna `plazas: [], total: 0`.
  - helper de geometria provado: um ponto a X m de uma polilinha é classificado
    dentro/fora do buffer corretamente (caso dentro + caso fora).
  - `routing`/`geo` exportam os tipos e **não** importam nenhum client HTTP
    (checado: sem `fetch`/`undici`/`axios` no dist desses dois pacotes).
  - SDD: `specs/**/spec.md` + `specs/**/plan.md` commitados no worktree.

### qualroteiro/api
- **Scope:** Implementar em `apps/api` os endpoints do contrato acima, compondo os
  pacotes de domínio de `root`:
  - Adapter concreto de `RoutingProvider` para um provider gerenciado
    (OpenRouteService como default; chave via env, documentada no
    `.env.example`). Adapter de `GeocodeProvider` idem (pode ser o mesmo provider).
  - `POST /routes/plan`: geocodifica se vier texto, chama o `RoutingProvider`,
    para cada alternativa aplica `matchTolls` (seed) e `estimateFuel`, monta
    `points` (praças da rota + postos — postos podem sair do mesmo seed ou de uma
    lista mínima; sem ingestão), devolve `PlannedRoute[]`.
  - `GET /places/search`: repassa ao `GeocodeProvider`, devolve `Place[]`.
  - Validação de input (schema) e erros HTTP claros (400 input inválido, 502
    provider fora).
  - CORS já habilitado; manter.
- **Acceptance:**
  - `pnpm --filter @qualroteiro/api test` verde.
  - `POST /routes/plan` com origem "São Paulo, SP" e destino "Rio de Janeiro, RJ",
    veículo carro 2 eixos, `consumptionKmPerL=10`, `fuelPricePerL=6`: responde 200
    com ≥1 `PlannedRoute`, `distanceKm` entre 400–470, `tolls.total > 0` e
    `tolls.plazas` não vazio, `fuel.cost` ≈ `distanceKm/10*6`. Provado por teste
    de integração com o provider **mockado** (sem rede no CI) + evidência de 1
    chamada real manual registrada.
  - `POST /routes/plan` com body inválido (sem `destination`) → 400 com mensagem
    de campo.
  - `GET /places/search?q=São Paulo` → 200 com `places` não vazio (provider
    mockado no teste).
  - `RoutingProvider` é injetável: o teste troca a implementação sem tocar nas
    rotas (prova a interface de `root`).
  - `.env.example` documenta a(s) chave(s) do provider.
  - SDD: `specs/**/spec.md` + `specs/**/plan.md` commitados.

### qualroteiro/web
- **Scope:** Em `apps/web`, montar o **shell de módulos** + o **módulo F1**:
  - **App shell** com `moduleRegistry`: cada módulo declara
    `{ id, label, icon, path, Panel, mapLayers[] }` e é registrado numa lista;
    a nav lateral e o roteamento são gerados a partir do registry. Adicionar um
    módulo = 1 arquivo + 1 entrada. Núcleo (shell, mapa, store) não conhece os
    módulos concretos.
  - **Primitivas compartilhadas** reutilizáveis por módulos futuros: um
    componente de mapa `MapCanvas` (MapLibre GL), um `PlaceSearch` de autocomplete
    (chama `GET /places/search`), um `VehicleProfileForm`, a store da
    consulta/rota, e um gerenciador de camadas do mapa.
  - **Módulo "Rota & Custos"**:
    - Tela 1 — Nova consulta: form origem/destino/paradas + perfil de veículo +
      consumo + preço do combustível → chama `POST /routes/plan`.
    - Tela 2 — Resultado: layout **split** (mapa + camadas de pontos | painel).
      Painel: resumo (km, tempo, pedágio, combustível) + abas **Pedágios**
      (lista praça-a-praça: nome, concessionária, km, tarifa), **Combustível**
      (litros, preço, custo), **Pontos na rota** (praças + postos, togglable no
      mapa), **Alternativas** (troca a rota ativa).
    - Tela 3 — Detalhe da praça: drawer ao clicar numa praça (mapa ou lista).
  - shadcn/ui instalado e usado; identidade visual própria (sem clonar UI de
    terceiros); responsivo aceitável em telas ≥ 768px (mobile fino fica p/ depois,
    registrar como limite).
- **Acceptance:**
  - `pnpm --filter @qualroteiro/web build` + `typecheck` + `lint` verdes.
  - Teste (component/integration, API mockada): submeter a Tela 1 com SP→RJ
    renderiza a Tela 2 com o traçado no mapa, o resumo preenchido, a aba
    **Pedágios** listando ≥1 praça com tarifa, e a aba **Combustível** com
    `custo = litros × preço`.
  - Alternar na aba **Alternativas** troca o traçado ativo no mapa e os números do
    resumo (provado por teste que alterna e verifica a diferença).
  - Toggle de uma camada em **Pontos na rota** adiciona/remove os marcadores
    correspondentes no mapa (provado).
  - Clicar numa praça abre o drawer da Tela 3 com os dados daquela praça.
  - **Extensibilidade provada por teste:** registrar um módulo fake
    (`{ id:'x', label:'X', path:'/x', Panel: um componente stub }`) no registry
    faz aparecer a entrada na nav e a rota `/x` renderiza o stub — **sem editar**
    nenhum arquivo do núcleo (shell/mapa/store).
  - SDD: `specs/**/spec.md` + `specs/**/plan.md` commitados.

## Sequencing

Backend-first, dependência de código + contrato HTTP força três ondas seriais
(mesmo repo, pacotes distintos, mas encadeados por import/consume):

- **Wave 1:** `qualroteiro/root` (dev: Lane Pryce) → **QA gate** Bertram Cooper.
- **Wave 2:** `qualroteiro/api` (dev: Pete Campbell) → **QA gate** Joan Holloway.
  Só abre quando `root` está `verified`/`merged`.
- **Wave 3:** `qualroteiro/web` (dev: Peggy Olson) → **QA gate** Stan Rizzo.
  Só abre quando `api` está `verified`/`merged`.

## Per-unit dispatch envelopes

Gate cumprido: `aipe execution propose --journey j-20260908-yk` foi executado; cada
envelope abaixo é uma linha da saída.

- **`qualroteiro/root`** — `subagent / claude-code / reasoning / normal`
  (cost-index 4). Reasoning porque o entregável é **julgamento**: os contratos de
  tipo que todos os outros pacotes importam, a abstração `RoutingProvider`, o
  algoritmo de casamento praça↔rota e os helpers de geometria — um contrato errado
  aqui causa dano silencioso a jusante. Descartado `standard` (não é checklist
  mecânico, é design de contrato); `session` (não há necessidade de
  acompanhamento ao vivo nem risco de context starvation em 4 pacotes pequenos);
  `frontier`/`ultracode` (GATED, sem espaço de exploração que justifique).
  `--size large` → rota SDD spec-kit.

- **`qualroteiro/api`** — `subagent / claude-code / reasoning / normal`
  (cost-index 4). Reasoning porque o **shape do contrato HTTP** que a `web`
  consome é decidido aqui e um shape errado quebra a onda seguinte em silêncio;
  além da abstração do adapter de provider. Descartado `standard` (o contrato de
  endpoint é design, não checklist); `session` (sem necessidade de visibilidade);
  GATED tiers (sem justificativa). `--size medium` → rota SDD spec-kit.

- **`qualroteiro/web`** — `subagent / claude-code / reasoning / normal`
  (cost-index 4). Reasoning porque o `moduleRegistry` **é** o requisito central da
  demanda ("permissivo a novos módulos") — arquitetura, não montagem mecânica de
  telas. Descartado `standard` (rebaixaria justamente a parte de julgamento);
  `session` (candidato mais próximo por ser o entregável visual, mas o PE não
  pediu follow-along ao vivo — se pedir, sobe para session); GATED tiers.
  `--size large` → rota SDD spec-kit.

- **QAs** (`Bertram Cooper` / `Joan Holloway` / `Stan Rizzo`) —
  `subagent / claude-code / standard / normal` (cost-index 2) cada. Standard:
  trabalho mecânico contra critério explícito (rodar os testes que o dev
  enumerou + revisar o diff contra a acceptance), calibrando severidade.
  Descartado `fast` (a calibração de severidade pede julgamento); `reasoning`
  (a acceptance é explícita e o dev enumera os testes — é o caso mecânico).

Nenhum envelope em session mode → sem custo de split de onda por model.

## Out of scope

- Login / contas / rotas salvas / histórico / export PDF.
- Piso de frete ANTT; perfil de caminhão/ônibus com eixos > 2 além da tabela de
  tarifa (a categoria de eixo existe no tipo, mas o F1 exercita carro).
- `services/data-ingest` e qualquer ingestão real (ANTT/ANP/DNIT/concessionárias).
- Valhalla / Photon self-host; tiles definitivos (usar um style/tiles gratuito no
  F1, registrar como pendência).
- Módulos F2/F3 (planejamento de viagem, roteiro, frete) — o F1 só entrega o
  **ponto de extensão** provado por teste, não os módulos.
- Mobile fino (< 768px): aceitável degradar; tratar depois.
- i18n: só pt-BR no F1 (não introduzir framework de i18n).
