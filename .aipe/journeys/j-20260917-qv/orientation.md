# Orientation Spec — j-20260917-qv (Google Places: raio configurável + filtro de tipo)

> The coordinator's cross-package orientation for this demand. The PE **approves**
> this before any dispatch. Amend it (bump the version) when an escalation changes
> the cross-package shape, then get re-approval. Implementation detail belongs to
> each specialist's own SDD (committed into its PR), not here.

> PE pediu (2026-09-17): raio de busca configurável ("hoje tá muito
> concentrado") e filtro por tipo usando os filtros do Google Places, nos
> três módulos de busca (Hospedagem/Restaurantes/Atividades). Via
> `AskUserQuestion`, confirmado: raio como controle no formulário
> (slider/select), tipo como chips/dropdown por módulo usando a taxonomia
> real do Google Places.
>
> Pesquisa real feita antes de especificar (documentação oficial do Google
> Places API New, não suposição):
> - `radiusMeters` já existe de ponta a ponta (`client.ts` → `GET
>   /places/nearby` → `google-places.ts`) mas **nenhum dos três módulos
>   passa o parâmetro** — todos usam o default do backend (3000m,
>   `apps/api/src/http/validate.ts:171`). Não há validação de teto hoje (só
>   rejeita `<= 0`).
> - Confirmado nos docs oficiais: `locationRestriction.circle.radius` aceita
>   até **50000 (50km)**. A UI deve oferecer um range bem menor que isso
>   (sugestão: 1–20km) — o teto de 50km é da API, não um valor sensato pra
>   expor ao usuário.
> - Confirmado nos docs oficiais: `includedTypes` aceita até **50 tipos por
>   requisição**. Hoje `toIncludedType()` (`google-places.ts:69`) manda
>   sempre um array de 1 elemento fixo por categoria (`lodging`,
>   `restaurant`, `tourist_attraction`).
> - Taxonomia real levantada (Table A da documentação oficial, listas
>   completas têm 18 tipos de hospedagem, ~150 de comida, ~80 de
>   entretenimento/cultura — grandes demais pra expor tudo como chips).
>   Curadoria proposta abaixo, ajustável pelo dev/PE durante implementação.

## Decisões de arquitetura tomadas pelo coordenador (documentadas, não perguntadas)

1. **Não expor a taxonomia inteira do Google como chips.** Cada módulo
   ganha uma lista curada pequena (6-10 tipos), pensada pro caso de uso
   brasileiro de planejamento de viagem, não a lista completa do Google.
   Curadoria inicial (dev pode ajustar, documentar o motivo se mudar):
   - **Hospedagem** (`lodging` continua o default/"Todos"): `hotel`,
     `hostel`, `guest_house`, `resort_hotel`, `bed_and_breakfast`,
     `campground`.
   - **Restaurantes** (`restaurant` continua o default/"Todos"): `cafe`,
     `bar`, `bakery`, `fast_food_restaurant`, `pizza_restaurant`,
     `seafood_restaurant`, `steak_house`, `vegetarian_restaurant`.
   - **Atividades** (`tourist_attraction` continua o default/"Todos"):
     `museum`, `park`, `amusement_park`, `art_gallery`, `zoo`,
     `historical_landmark`, `national_park`, `night_club`.
2. **Seleção de tipo é aditiva, não exclusiva.** Nenhum chip selecionado =
   comportamento de hoje (`includedTypes: [tipo-base-da-categoria]`). Um ou
   mais chips selecionados = `includedTypes: [tipos-selecionados]`,
   substituindo (não somando) o tipo-base — API aceita até 50, a lista
   curada nunca chega perto disso.
3. **Validação server-side por allow-list, nunca tipo arbitrário do
   cliente.** O endpoint valida cada `type` recebido contra a lista curada
   daquela categoria (nova constante exportada por `google-places.ts`) —
   rejeita com `ValidationError` um tipo fora da lista, em vez de repassar
   qualquer string pro Google. Motivo: a rota já é guardada por custo (G1);
   aceitar tipo arbitrário do cliente abriria a mesma superfície pra abuso
   que o `radiusMeters` sem teto já tem (ver decisão 4).
4. **`radiusMeters` ganha teto de validação.** Hoje só rejeita `<= 0`.
   Adicionar teto (sugestão: 20000, alinhado com o range da UI — não usar o
   teto de 50000 da API diretamente, é maior que qualquer caso de uso real
   do produto) pra falhar rápido e barato em vez de deixar o Google
   rejeitar depois de já ter sido chamado.
5. **UI**: slider ou select de raio (não os dois) — decisão do dev qual
   encaixa melhor no formulário existente de cada módulo, valores sugeridos
   1/3/5/10/20 km como marcos se for select, ou slider contínuo com esses
   marcos como referência visual. Chips de tipo: multi-seleção, nenhum
   selecionado = estado "Todos" (comportamento atual).
6. **Sem mudança no guard de custo (G1).** `ApiUsageCounter` conta por
   SKU/mês, não por parâmetro — raio e tipo não mudam o modelo de custo,
   só o `radius`/`includedTypes` do corpo da requisição já guardada.
   Confirmar isso no código antes de mexer, não assumir.

## Problem

As buscas de lugar próximo (Hospedagem/Restaurantes/Atividades) usam um
raio fixo de 3km e um único tipo de lugar por categoria, sem controle do
usuário — resultado "muito concentrado" (poucos lugares, sempre os mesmos
tipos). O backend já suporta raio configurável de ponta a ponta, só não é
exposto; o filtro de tipo não existe. Esta jornada expõe os dois.

## Cross-package contracts

- **`apps/api` → `apps/web`**: `GET /places/nearby` ganha um novo parâmetro
  opcional `types` (lista, mesmo padrão de query string repetida ou
  comma-separated — decisão do dev, documentar) validado contra a allow-list
  por categoria. `radiusMeters` ganha teto de validação (comportamento
  existente sem teto muda — checar se algum teste hoje depende de radius
  muito grande passando sem erro).
- **`apps/web`**: os três módulos passam a enviar `radiusMeters` e `types`
  reais (hoje mandam `undefined` pro radius e nada pro tipo) em
  `searchNearbyPlaces()` (`core/api/client.ts`).

## Per-package scope

### qualroteiro/api

**Scope:**
1. `google-places.ts`: nova constante exportada por categoria (allow-list de
   tipos curados, decisão 1 acima). `toIncludedType()` (ou uma nova função)
   passa a aceitar uma lista de tipos selecionados, com fallback pro tipo
   único de hoje quando vazia/ausente.
2. `validate.ts`'s `parseNearbyQuery`: novo campo `types?: readonly
   string[]` no `NearbyQueryInput`, validado contra a allow-list da
   `category` recebida (rejeita tipo fora da lista dessa categoria
   especificamente, não a união de todas). `radiusMeters` ganha teto
   (decisão 4).
3. `routes/places-nearby.ts`: repassa `types` pro provider.
- **Acceptance:**
  - `pnpm --filter @qualroteiro/api typecheck/lint/test` verdes.
  - Teste: `types` vazio/ausente mantém o comportamento de hoje (1 tipo
    fixo por categoria) — regressão zero.
  - Teste: `types` com 1+ tipos válidos da categoria monta `includedTypes`
    correto.
  - Teste: `types` com um tipo de OUTRA categoria (ex. `hotel` numa busca
    `category=restaurantes`) rejeita com `ValidationError`.
  - Teste: `radiusMeters` acima do teto novo rejeita; no teto exato aceita;
    comportamento de `<= 0` continua rejeitando como hoje.
  - `git diff --name-only origin/main..HEAD` só `apps/api/**`.
  - SDD conforme `aipe skill match`.

### qualroteiro/web

> Depende de `qualroteiro/api` `merged` (usa `types`/teto de `radiusMeters`
> que a API precisa validar primeiro).

**Scope:**
1. `core/api/client.ts`'s `searchNearbyPlaces()`: já aceita `radiusMeters`
   opcional — adicionar parâmetro `types?: readonly string[]` opcional,
   serializado na query string.
2. Cada módulo (`hospedagem`/`restaurantes`/`atividades`): novo controle de
   raio (decisão 5) e chips de tipo (lista curada da categoria, decisão 1),
   estado local, passados pra `searchNearbyPlaces()` na busca.
3. Mudar o raio ou os tipos selecionados re-dispara a busca (mesmo padrão
   do efeito existente que já reage a mudança do ponto de referência) —
   decisão do dev se é automático ou exige clicar buscar de novo, documentar
   a escolha.
- **Acceptance:**
  - `pnpm --filter @qualroteiro/web typecheck/lint/test` verdes.
  - Teste por módulo: mudar o raio muda o `radiusMeters` enviado; selecionar
    chip(s) de tipo muda os `types` enviados; nenhum chip selecionado não
    manda `types` (comportamento atual preservado).
  - Nenhuma regressão no comportamento de esconder/reabrir a lista (PR #46)
    nem na propagação de `lat`/`lng` pro payload salvo (`j-20260917-up`,
    Wave 1 — se essa jornada já tiver fechado quando esta rodar, confirmar
    que os dois convivem sem conflito de merge nos mesmos arquivos).
  - `git diff --name-only origin/main..HEAD` só `apps/web/**`.
  - Evidência visual real (screenshot) do controle de raio e dos chips nos
    três módulos — não só teste unitário, é UI nova.

## Sequencing

- **Wave 1:** `qualroteiro/api` — allow-list + validação de `types`, teto de
  `radiusMeters`.
- **Wave 2:** `qualroteiro/web` — UI nos três módulos, depende de Wave 1
  `merged`.

## Out of scope

- Filtro de tipo em Rota & Custos (não busca lugares por categoria, fora do
  padrão desta jornada).
- Persistir a preferência de raio/tipo entre sessões (localStorage ou
  conta) — cada busca começa no default, sem memória.
- Mudar o SKU/modelo de custo do guard G1 — confirmado que não muda
  (decisão 6), sem trabalho aqui.
- Ampliar a lista curada de tipos além do que está na decisão 1 sem pedido
  explícito do PE — começar pequeno, expandir sob demanda real.
