# F2a — Documento de Coordenação (Claude ⇄ Codex)

> **Handoff de testes e correcoes locais (Codex, 2026-09-15):**
> [Registro completo e evidencias](repos/qualroteiro/docs/qa/2026-09-15/HANDOFF.md).
> Suite: 463 testes passaram sem cache. Playwright reproduziu bug de
> reordenacao para baixo, ainda pendente. Corrigidos ambiente do banco
> (erro 500 no planejamento) e URL do OpenRouteService (erro 502 em cidades
> e rotas); limites dos testes e pendencia de rotacao de chave no registro.
> Para repasse ao Claude, registrar resultados em Markdown com evidencias,
> distinguindo testes com mocks, testes reais e pendencias.

> **Fonte única de verdade** para a fundação do F2 (Clerk + Trip + módulo
> "Planejamento de Viagem"). Mesmo padrão do `F1-COORDINATION.md`.
>
> - **Don Drapper (Claude / coordenador AIPe)** mantém: seções 1–4, a tabela de
>   tarefas, os briefs, e faz o **QA gate** de tudo antes de entrar no `dev`.
> - **Você (PE, dirigindo o Codex)** mantém: o **Log de progresso** (seção 8) e
>   marca `EM ANDAMENTO` / `PR ABERTA` na tabela.
> - Cada tarefa vira **um branch → uma PR pra `dev`**. Codex não mergeia; abre a
>   PR, você avisa aqui no log, o Claude roda o QA e mergeia.

Última atualização: 2026-09-16 · F1 promovido pra `main` (PR #12). `dev` e
`main` estão sincronizados nesse ponto de partida.

---

## 1. Estado atual

F1 ("Rota & Custos") está em **produção** (`main`). Funciona **sozinho, sem
login** — isso continua assim, F2a não muda o F1.

**F2 — objetivo:** módulos novos que entram no mesmo `moduleRegistry` do F1,
**usáveis isolados OU combinados** dentro de uma viagem salva ("Trip"):

```
Módulos standalone (sem login, como hoje):
  Rota & Custos     ← F1, existe
  Hospedagem        ← F2b (depois)
  Restaurantes      ← F2c (depois)
  Atividades        ← F2d (depois)

Camada de composição (precisa login — Clerk):
  Planejamento de Viagem  ← F2a, ESTA FASE
    = uma Trip salva: dias + itens (cada item referencia o resultado
      salvo de um módulo) + orçamento consolidado
```

**F2a (esta fase)** entrega só a fundação: auth (Clerk) + schema (`Trip`) +
o módulo mínimo salvando **um** tipo de item — o resultado do Rota & Custos.
F2b/c/d entram depois, plugando no mesmo padrão.

## 2. Repositório & comandos

Igual ao F1 — ver `F1-COORDINATION.md` seções 1–2 se precisar (paths, branch
`dev`, comandos de verificação, fluxo de branch por tarefa via Codex).

Resumo do fluxo de branch:
```
git -C repos/qualroteiro fetch origin
git -C repos/qualroteiro switch -c codex/f2a/<slug> origin/dev
# ... trabalho ...
git push -u origin codex/f2a/<slug>
gh pr create --base dev --head codex/f2a/<slug> --title "..." --body "..."
```
Depois: anota no **Log de progresso** (seção 8). O Claude roda o QA e mergeia.

## 3. Contrato — o que A3 (Codex) constrói contra

**Este contrato é o que a A2 (Claude, `apps/api`) vai implementar.** Ainda não
existe no código — é a especificação combinada. Se a A2 precisar desviar, o
Claude avisa aqui antes de mergear.

### Auth (Clerk)

- `apps/web`: `<ClerkProvider publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}>`
  envolvendo o app. Telas de sign-in/sign-up via os componentes do Clerk
  (`<SignIn/>`, `<SignUp/>`, ou `<SignInButton/>`+`<UserButton/>` no shell — à
  escolha de quem implementar, documentar a escolha).
- Toda chamada a `/trips*` leva `Authorization: Bearer <clerk session token>`
  (o hook `useAuth().getToken()` do Clerk React dá isso).
- `apps/api`: middleware que verifica o token (Clerk backend SDK) antes de
  qualquer rota `/trips*`. Sem token válido → `401 { "error": "..." }`.

### `Trip` — tipos (de `@qualroteiro/trips`, a ser criado pela A1)

```ts
interface Trip {
  id: string;
  userId: string;          // clerk user id
  title: string;
  startDate: string | null; // ISO date (YYYY-MM-DD)
  endDate: string | null;
  createdAt: string;        // ISO datetime
  updatedAt: string;
}

interface TripDay {
  id: string;
  tripId: string;
  date: string | null;      // ISO date; null = dia sem data definida
  order: number;             // ordem de exibição
}

interface TripItem {
  id: string;
  tripDayId: string;
  order: number;
  moduleId: string;          // 'rota-custos' | 'hospedagem' | 'restaurantes' | 'atividades'
  kind: string;               // livre por módulo, ex. 'route' pro rota-custos
  title: string;               // rótulo pra exibir na timeline
  payload: unknown;            // resultado salvo do módulo (ex. um PlannedRoute)
  costEstimate: number | null; // pra somar no orçamento consolidado
}
```

### REST — `apps/api` (base `/trips`, tudo autenticado)

| Método | Rota | Body | Resposta |
|---|---|---|---|
| `POST` | `/trips` | `{ title, startDate?, endDate? }` | `201 Trip` (sem days) |
| `GET` | `/trips` | — | `200 { trips: TripSummary[] }` — `TripSummary` = `Trip` + `dayCount`/`itemCount` |
| `GET` | `/trips/:id` | — | `200 { ...Trip, days: (TripDay & { items: TripItem[] })[] }` · `404` se não existe ou não é do usuário |
| `PATCH` | `/trips/:id` | `{ title?, startDate?, endDate? }` | `200 Trip` |
| `DELETE` | `/trips/:id` | — | `204` |
| `POST` | `/trips/:id/days` | `{ date?, order? }` | `201 TripDay` |
| `POST` | `/trips/:id/days/:dayId/items` | `{ moduleId, kind, title, payload, costEstimate? }` | `201 TripItem` |
| `DELETE` | `/trips/:id/days/:dayId/items/:itemId` | — | `204` |

Erro sempre `{ "error": "..." }`. `400` campo inválido · `401` sem auth ·
`404` recurso não existe/não é do usuário.

### O que a A3 (web) constrói

1. **`<ClerkProvider>`** no `App` (ou `main.tsx`), com sign-in/sign-up
   acessíveis pelo shell (ex. um botão no `AppShell.tsx` — hoje ele não tem
   nada de usuário, é só nav + módulos; adicionar sem quebrar o contrato de
   extensibilidade: `AppShell` pode saber de "usuário logado ou não" porque
   isso é do **núcleo**, não de um módulo concreto).
2. **Novo módulo `planejamento-viagem`**, mesmo padrão do `rota-custos`
   (ver `apps/web/src/modules/rota-custos/module.ts` e
   `apps/web/src/modules/index.ts` — registrar em `appModules`):
   - Tela lista de viagens (`GET /trips`).
   - Tela criar viagem (`POST /trips` — título + datas opcionais).
   - Tela de uma viagem (`GET /trips/:id`) — mostra os dias e itens, mesmo que
     vazios no início.
   - Sem login → a tela mostra um convite pra entrar, não quebra.
3. **Botão "Salvar na viagem"** na tela de resultado do Rota & Custos
   (`apps/web/src/modules/rota-custos/ResultScreen.tsx`) — só aparece logado;
   ao clicar, escolhe uma Trip existente (ou cria uma rápida) e um dia, chama
   `POST /trips/:id/days/:dayId/items` com `moduleId: 'rota-custos'`,
   `kind: 'route'`, `title` (ex. "São Paulo → Rio de Janeiro"), `payload` = a
   `PlannedRoute` ativa, `costEstimate` = `tolls.total + fuel.cost`.
4. Shadcn/ui já tem `button`, `card`, `input`, `label`, `select`, `sheet`,
   `tabs` em `apps/web/src/components/ui/` — reusa, adiciona só o que faltar
   (ex. um `dialog`/`badge` se precisar).

**Contrato do fetch:** mesmo padrão do `src/core/api/client.ts` — adicionar as
chamadas de `/trips*` ali (ou um módulo irmão `src/core/api/trips.ts`),
incluindo o header `Authorization` vindo do Clerk.

## 4. Tabela de tarefas

| # | Tarefa | Pacote | Dono | Status |
|---|---|---|---|---|
| **A1** | `packages/trips` — tipos `Trip`/`TripDay`/`TripItem` + validação pura | `root` | **Claude/AIPe** | 🔄 despachada — jornada `j-20260915-kt`, Lane Pryce (`reasoning`) |
| **A2** | `apps/api` — schema Prisma + migration, middleware Clerk, endpoints `/trips*` | `api` | **Claude/AIPe** | ✅ MERGEADA (PR #14) | PR #14 |
| **A3** | `apps/web` — `ClerkProvider`, sign-in/sign-up, módulo "Planejamento de Viagem", botão "Salvar na viagem" | `web` | **Codex (você)** | 🔵 **PR ABERTA** — PR #15 atualizada com testes |

**Paralelismo:** A3 pode começar **agora**, contra o contrato acima — não
precisa esperar A1/A2 existirem de verdade, só não pode mergear antes deles
(a API real vai existir só depois). Se o contrato mudar durante a A2, aviso
aqui antes.

## 5. Preciso de você

1. **`CLERK_SECRET_KEY`** → `apps/api/.env`
2. **`VITE_CLERK_PUBLISHABLE_KEY`** → `apps/web/.env`
3. Avisa "keys no `.env`" quando puser — não preciso ver o valor. Isso libera
   A1+A2 no Claude.

## 7. PR #15 (A3) — pendências antes de mergear

**Revisão:** código sólido, tipos batem com o contrato §3, `build`/`typecheck`/`lint`
limpos, conflito de `pnpm-lock.yaml` é só mecânico (duas branches com deps
diferentes — resolve com `pnpm install` depois do merge, sem editar na mão).
**Falta:** nenhum teste novo cobrindo a A3 (65 testes = mesma contagem de antes).

### O que falta, especificamente

Mirror do padrão já usado em `apps/web/src/core/api/client.test.ts`
(`mockFetch`/`json` helpers stubando `global.fetch`, `vi.stubGlobal` +
`vi.unstubAllGlobals` no `afterEach`).

1. **`core/api/trips.ts` — testes unitários** (novo arquivo
   `core/api/trips.test.ts`, mesmo padrão do `client.test.ts`):
   - `listTrips`: GET `/trips`, devolve `trips[]`.
   - `createTrip`: POST `/trips` com o body certo, devolve o `Trip` criado.
   - `getTrip`: GET `/trips/:id` com o id no path (encodado).
   - `createTripDay` / `createTripItem`: POST nos paths aninhados certos.
   - Erro: uma resposta `401` mapeia pra `ApiError` com `kind: 'auth'`; uma
     resposta não-OK genérica mapeia pra `kind: 'server'` com a mensagem do
     `{error}` do corpo.
   - Sem token (`getToken` resolve `null`): `authHeaders` lança `ApiError`
     `401` **antes** de chamar `fetch` — provar que a chamada de rede nem
     acontece.

2. **`core/auth/AuthContext.ts` + `AuthProvider.tsx` — teste do estado sem
   Clerk configurado** (novo `core/auth/AuthProvider.test.tsx`):
   - Sem `VITE_CLERK_PUBLISHABLE_KEY`: `AuthProvider` renderiza os filhos com
     `missingAuth` no contexto (`isConfigured: false`); `AuthActions` mostra o
     botão "Login indisponível" desabilitado.
   - Se der pra mockar `@clerk/clerk-react` (`useAuth`/`useUser`) com
     `vi.mock`: provar também o estado logado (`UserButton` aparece) e
     deslogado (`SignInButton`/`SignUpButton` aparecem). Se mockar o Clerk for
     complicado demais, o estado "sem Clerk configurado" sozinho já cobre o
     caso crítico (F1 tem que continuar funcionando sem login) — documentar a
     limitação se pular o resto.

3. **`SaveRouteToTripDialog.tsx` — teste do fluxo principal** (novo
   `modules/rota-custos/SaveRouteToTripDialog.test.tsx`):
   - Com `auth.isSignedIn: true` (mock do `useQualAuth`) e `listTrips`/
     `createTrip`/`createTripDay`/`createTripItem` mockados: abrir o diálogo,
     escolher "nova viagem" + "novo dia", submeter, e verificar que
     `createTripItem` foi chamado com `costEstimate = route.tolls.total +
     route.fuel.cost` e `payload` = a rota.
   - Com `auth.isSignedIn: false`: o diálogo não deveria oferecer salvar (ou
     deveria pedir login) — provar qual dos dois comportamentos é o real.

4. **Opcional, mas rápido:** `updateTrip`/`deleteTrip`/`deleteTripItem` não
   existem no client — se são propositalmente adiados, tudo bem, só declarar
   isso no PR/SDD.

### Depois que os testes existirem

Anota "PR #15 atualizada" no Log de progresso (seção 8) e eu reverifico +
mergeio.

## 6. Log de progresso *(append-only)*

- `2026-09-16` — Claude — **Hotfix promovido pra `main`** (PR #23, `b8cb0c8`). O bug de reordenar pra baixo está corrigido em produção. `main` e `dev` sincronizados de novo. Fim do doc.

- `2026-09-16` — Claude — **PR #22 (F2g) verificada e mergeada** (`695fd11`). Fix confirmado **idêntico** ao que derivei (remove o `-1` indevido). Teste de regressão parametrizado (`it.each`) cobre os 3 cenários (A→B, A→C, C→A), checando **ordem final + payload exato do PATCH**, não só um dos dois. `docker-compose.yml` com porta configurável. 10 arquivos de evidência do handoff commitados em `repos/qualroteiro/docs/qa/2026-09-15/`. build/typecheck/lint limpos, 109 testes web (+3). Chave Clerk rotacionada pelo PE. **Bug de produção corrigido no `dev`, ainda não promovido pra `main`.**

- `2026-09-15` — Codex — **F2g entregue: [PR #22](https://github.com/joaofssantos/qualroteiro/pull/22) aberta para `dev`**, commit `29be6cd`, branch `codex/f2g/fix-reorder-e-docs` criada de `origin/main` (`eba2823`). Conferida a matematica e removido o decremento do indice ao mover para baixo. Tres casos de regressao verificam ordem visual e argumentos completos dos PATCHs: A sobre B, A sobre C e C sobre A. Antes do fix, os dois movimentos para baixo falharam; apos o fix, **build/typecheck/lint/test web verdes, 109 testes em 21 arquivos**, `git diff --check` limpo. Incluidos `${POSTGRES_PORT:-5432}:5432` e os dez arquivos de `docs/qa/2026-09-15/`, movidos da raiz do workspace para o repo sem reescrever. [Handoff preservado](repos/qualroteiro/docs/qa/2026-09-15/HANDOFF.md) e evidencias sao historicos anteriores ao fix; Playwright nao foi reexecutado nesta alteracao. Avisos nao bloqueantes: React Router future flags e chunk MapLibre >500 kB. Diff somente `apps/web/**`, `infra/docker-compose.yml` e `docs/qa/**`. PR aberta, sem merge; aguarda QA do Claude. Nota: este Log esta numerado como secao 6 no documento atual, embora o fluxo o referencie como secao 8.

- `2026-09-16` — PE — **F2 promovido pra `main`** (PR #21, `eba2823`). Login (Clerk), viagens persistidas, os 3 módulos standalone (hospedagem/restaurantes/atividades) e a timeline com remoção + reordenação drag-and-drop estão em produção. **F2 fechado, fim do doc.**

- `2026-09-16` — Claude — **PR #20 (F2f, API+Web numa PR só) verificada e mergeada** (`823052e`). Os 2 `PATCH` implementados nas duas stores (fake + Prisma), com os testes exatos pedidos: reordenar dia/item, mover item entre dias da mesma trip, **recusar mover pra dia de outra trip**, `404` idêntico ao de id inexistente pra não-dono. Web: `@dnd-kit/{core,sortable,utilities}`, com teste de **rollback real** (volta o estado anterior + mostra erro quando o PATCH falha). build/typecheck/lint 12/12/2, test 110 api + 106 web. Escopo limpo, sem conflito. **F2 completo — F2a até F2f, tudo no `dev`.**

- `2026-09-16` — Claude — **F2f despachada, inteira via Claude/AIPe** (jornada `j-20260915-bp`, spec v1 aprovada). Wave 1 (`apps/api`, Pete Campbell, `reasoning`): PATCH de reordenação de dia/item, mesma disciplina de ownership de A2. Wave 2 (`apps/web`, drag-and-drop com `@dnd-kit`, atualização otimista + rollback) só dispara depois que a Wave 1 mergear. Ambiente local de teste (servidores no clone principal) não é afetado — o dispatch roda em worktree separado.

- `2026-09-16` — Claude — **PR #19 (F2e) verificada (QA: PASS, 2 minor não-bloqueantes) e mergeada** (`a8b8dbb`). QA testou por conta própria 4 payloads malformados de hospedagem — todos caem no fallback sem quebrar. **F2e completa. F2 fechado**: fundação + os 3 módulos standalone + remover/exibir item na timeline. `dev` 26 commits à frente de `main`. Falta só F2f (reordenar, mexe em contrato de API) se/quando decidido.

- `2026-09-16` — Claude — **F2e despachada** (jornada `j-20260915-61`, Peggy Olson, `standard`). Descoberto antes de decompor: o orçamento consolidado e o agrupamento por dia **já existiam** desde a F2a (`TripDetailScreen`). Recorte fechado com o PE: remover item (API já tem `DELETE`, só faltava ligar) + exibição rica por módulo lendo o payload (fallback seguro pra `moduleId` desconhecido). Reordenar (drag-and-drop) vira F2f, separada, por mexer em contrato de API.

- `2026-09-16` — Claude — **PR #18 (F2c Restaurantes) verificada e mergeada** (`a42f126`), mesmo conflito esperado em `modules/index.ts` resolvido (junta com hospedagem+atividades). Escopo confirmado só `restaurantes/**` + `modules/index.ts` (via `gh pr view --json files`, não o diff-vs-base que mistura histórico). 20 arquivos de teste, 96 testes, tudo verde. **F2b + F2c + F2d completos — os 3 módulos standalone no `dev`.**

- `2026-09-16` — Claude — **PR #17 (F2d Atividades) verificada (QA: PASS 8/8, 0 findings) e mergeada** (`dcef666`), depois de resolver o conflito esperado em `modules/index.ts` contra a F2b (combinar as duas entradas, trivial). Reverifiquei a árvore combinada: 17 arquivos de teste, 89 testes, tudo verde. **F2b + F2d completas e coexistindo no `dev`.** `dev` 20 commits à frente de `main`.

- `2026-09-16` — Claude — **PR #16 (F2b Hospedagem) verificada e mergeada** (`5f32029`). build/typecheck/lint limpos, 82 testes (14 arquivos). `calc.ts` até mais cuidadoso que o brief pedia — valida data ISO de calendário de verdade, não só formato. Escopo limpo, sem conflito (saiu de `dev` atual). **F2b completa.**

- `2026-09-16` — Claude — **F2d indo pelo Claude/AIPe em vez de Codex** (pedido do PE, pra paralelizar com F2b/F2c que estão no Codex). Jornada `j-20260915-tc`, Peggy Olson, `standard`. Mesmo brief da seção 10.

- `2026-09-16` — Codex — **F2b Hospedagem entregue: PR #16 aberta** (`809e061`, branch `codex/f2b/hospedagem`). Escopo restrito a `apps/web/**`: cálculo puro `calculateLodgingCost`, módulo standalone `hospedagem` com cálculo ao vivo sem rede/login, fluxo "Salvar na viagem" com `moduleId: 'hospedagem'`, `kind: 'stay'`, `payload = LodgingStay`, `costEstimate = totalCost`, testes novos e SDD curto. Verificações locais: testes F2b isolados passaram, `typecheck`, `lint`, `build` e `test` completo (**82 testes**) passaram.

- `2026-09-16` — Claude — **PR #15 atualizada com os 3 testes pedidos** (`trips.test.ts` 8 casos, `AuthProvider.test.tsx`, `SaveRouteToTripDialog.test.tsx` 2 casos incl. usuário deslogado). Reverifiquei tudo: build/typecheck/lint limpos, 76 testes web (era 65). Resolvi o conflito de lockfile (mecânico) e pushei pra branch do Codex, CI passou no GitHub Actions, **mergeei** (`496e2c6`). **F2a completo — A1+A2+A3 todas no `dev`.** Verificação final do monorepo: build 7/7, typecheck 12/12, lint 2/2, test 12/12 — **325 testes** (fuel 11, tolls 67, trips 43, geo 20, routing 6, api 102, web 76). `dev` 14 commits à frente de `main`.

- `2026-09-16` — Codex — **PR #15 atualizada** (`62c7f84`). Pendências da seção 7 cobertas com testes novos para `core/api/trips.ts`, estado sem Clerk configurado em `AuthProvider`/`AuthActions`, e fluxo principal do `SaveRouteToTripDialog` (incl. `payload` e `costEstimate = tolls.total + fuel.cost`). Verificações locais: `lint`, `typecheck`, `test` (**76 testes**) e `build` passaram.

- `2026-09-16` — Claude — **PR #15 (A3) revisada.** Código correto contra o contrato, conflito de lockfile é só mecânico. **Sem nenhum teste novo** — PE decidiu (opção 2): fechar com teste antes de mergear. Brief detalhado na seção 7 acima, pronto pro Codex.
- `2026-09-16` — Claude — **PR #14 verificada (QA: PASS) e mergeada** (`e355d11`). **A1+A2 completas — o lado Claude/AIPe do F2a está pronto.** QA achou e provou por conta própria: auth 401 em todas as 10 rotas registradas (incl. HEAD automático do Fastify), isolamento por usuário 404 em toda operação cross-user, byte-idêntico ao id inexistente.
  **2 follow-ups não-bloqueantes, pra não esquecer:**
  1. teste de `costEstimate` com `1e999` falta (a validação funciona, só não tem teste cobrindo)
  2. **quando o Docker/Postgres estiver disponível**: rodar a migration de verdade + adicionar teste de integração provando que o filtro de `userId` do adapter Prisma (não só o da store fake) barra acesso cross-user — hoje isso só foi revisado por leitura de código, não testado em execução.

- `2026-09-16` — Claude — **A1 mergeada** (`70e4737`). **A2 despachada** (`apps/api`, Pete Campbell, `reasoning`).
- `2026-09-16` — Claude — **PR #14 (A2) — CI pegou um bug real**: build falhava em instalação limpa (`prisma generate` nunca rodava no pipeline). Mandei de volta, causa raiz corrigida (`postinstall` + `build` script), **verde de verdade no GitHub Actions** (run 35033232275). Endpoints batem com o contrato §3, auth Clerk atrás de porta injetável, ownership estrutural (não-dono = 404, nunca revela existência). Migration ainda não rodou contra Postgres real (Docker fora do ar). Em QA (Joan Holloway).

- `2026-09-16` — Claude — **A1 entregue: PR #13.** Tipos travados por um teste de compile-time contra §3 (mutation-testado). Validadores devolvem `ValidationResult` em vez de lançar (diferente de fuel/tolls, justificado: A2 precisa de todos os erros de uma vez pro 400). Regras que o dev **recusou inventar** (limite de tamanho de título, allow-list de `moduleId`, data dentro do range da viagem, sinal do `costEstimate`) documentadas pra A2 decidir. 43 testes. Em QA (Bertram Cooper).

- `2026-09-16` — Claude — Chaves Clerk confirmadas (corrigi local + nome da variável: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` → `VITE_CLERK_PUBLISHABLE_KEY`, movi pro `repos/qualroteiro/apps/web/.env`). **A1 despachada** — jornada `j-20260915-kt` (spec v1 aprovada), Lane Pryce em `reasoning` (domínio novo, isolamento por usuário é superfície sensível). A2 na fila.


- `2026-09-16` — Claude — documento criado. Contrato de `/trips` e dos tipos
  `Trip`/`TripDay`/`TripItem` fechado. A3 liberada pro Codex desde já.

## 8. F2b — Hospedagem (Codex — inteira, sem Claude/AIPe)

> Diferente de A1/A2/A3: **não precisa de `apps/api` nem pacote de domínio
> novo**. Custo de hospedagem é aritmética pura (noites × preço) — sem
> geometria, sem matching, sem API externa nesta fase. É **100% `apps/web`**.
> Meu papel aqui é só QA quando a PR abrir.

### O que construir

1. **Cálculo puro** — `apps/web/src/modules/hospedagem/calc.ts`:
   ```ts
   export interface LodgingStay {
     readonly placeName: string;
     readonly address: string | null;
     readonly checkIn: string;   // ISO date
     readonly checkOut: string;  // ISO date
     readonly pricePerNight: number;
   }
   export interface LodgingCost {
     readonly nights: number;
     readonly totalCost: number;
   }
   export function calculateLodgingCost(stay: LodgingStay): LodgingCost
   ```
   `nights` = diferença de dias entre `checkIn`/`checkOut` (mínimo 1, lançar/erro
   se `checkOut <= checkIn`). `totalCost = nights * pricePerNight`. Teste
   unitário — casos normais + `checkOut <= checkIn` + 1 noite.

2. **Módulo `hospedagem`**, mesmo padrão do `rota-custos`
   (`apps/web/src/modules/rota-custos/module.ts` +
   `apps/web/src/modules/index.ts` — registrar em `appModules`):
   - **Tela única** (não precisa de split/mapa): formulário — nome do lugar,
     endereço (opcional), check-in, check-out, preço/noite → mostra
     `nights`/`totalCost` calculados ao vivo (sem submeter nada, sem rede —
     igual ao Rota & Custos mostrar pins antes de submeter).
   - Funciona **sem login** — é só a calculadora.
3. **"Salvar na viagem"** — **reusa o padrão de
   `apps/web/src/modules/rota-custos/SaveRouteToTripDialog.tsx`** quase
   literalmente: mesmo fluxo (escolhe viagem existente ou cria uma, escolhe dia
   existente ou cria um, chama `createTripItem` com `moduleId: 'hospedagem'`,
   `kind: 'stay'`, `title` = nome do lugar, `payload` = o `LodgingStay`,
   `costEstimate` = `totalCost`). Só aparece logado (`auth.isSignedIn`), some
   se deslogado — mesma regra do componente original.
4. Shadcn/ui já tem tudo que precisa (`button`, `card`, `input`, `label`,
   `dialog`, `select`).

### Aceitação (o que o QA do Claude vai checar)

- `pnpm --filter @qualroteiro/web build/typecheck/lint/test` verdes.
- `calculateLodgingCost`: teste normal + `checkOut <= checkIn` (erro) + estadia
  de 1 noite.
- Módulo aparece na nav e calcula ao vivo, sem submeter formulário, sem rede.
- Logado: "Salvar na viagem" cria/usa uma Trip e um Day, chama `createTripItem`
  com o payload certo — **teste espelhando o `SaveRouteToTripDialog.test.tsx`**
  (inclusive o caso "não aparece quando deslogado").
- `git diff` só `apps/web/**`.
- SDD curto commitado.

### Fluxo de entrega

Mesmo de sempre: branch `codex/f2b/hospedagem` a partir de `origin/dev` → PR
pra `dev` → anota no Log de progresso → eu reverifico e mergeio.

## 9. F2c — Restaurantes (Codex — inteira, sem Claude/AIPe)

> Mesma forma da F2b: **100% `apps/web`**, sem `apps/api`/pacote novo. Espelha
> o padrão do módulo `hospedagem` assim que ele existir — se F2b já estiver
> mergeada, reusar os mesmos componentes/estrutura em vez de recriar do zero.

### O que construir

1. **Cálculo puro** — `apps/web/src/modules/restaurantes/calc.ts`:
   ```ts
   export interface RestaurantVisit {
     readonly placeName: string;
     readonly address: string | null;
     readonly date: string | null;      // ISO date, opcional
     readonly pricePerPerson: number;
     readonly people: number;            // mínimo 1
   }
   export interface RestaurantCost {
     readonly totalCost: number;         // pricePerPerson * people
   }
   export function calculateRestaurantCost(visit: RestaurantVisit): RestaurantCost
   ```
   Erro se `people < 1` ou `pricePerPerson < 0`. Teste: caso normal, 1 pessoa,
   `people` inválido.

2. **Módulo `restaurantes`**, mesmo padrão de `hospedagem`/`rota-custos`
   (registrar em `apps/web/src/modules/index.ts`):
   - Tela única: nome do lugar, endereço (opcional), data (opcional),
     preço/pessoa, nº de pessoas → `totalCost` calculado ao vivo, sem rede.
   - Funciona sem login.
3. **"Salvar na viagem"** — mesmo padrão de `SaveRouteToTripDialog`/o
   equivalente da hospedagem: `moduleId: 'restaurantes'`, `kind: 'meal'`,
   `payload` = o `RestaurantVisit`, `costEstimate` = `totalCost`. Só logado.
4. Reusa os componentes shadcn já existentes.

### Aceitação

Mesmo molde da F2b: build/typecheck/lint/test verdes, teste do cálculo (normal +
2 casos de erro), módulo calcula ao vivo sem rede, "salvar na viagem" testado
igual (incl. some quando deslogado), diff só `apps/web/**`, SDD curto.

### Fluxo

`codex/f2c/restaurantes` a partir de `origin/dev` → PR → Log de progresso → eu
reverifico e mergeio. Pode rodar em paralelo com a F2b (arquivos disjuntos,
`modules/hospedagem/` vs `modules/restaurantes/` — só `modules/index.ts` pode
colidir se as duas PRs mexerem nele ao mesmo tempo; se abrir as duas juntas, a
segunda a mergear resolve esse arquivo na mão, é trivial).

## 10. F2d — Atividades (Codex — inteira, sem Claude/AIPe)

> Mesma forma de F2b/F2c: **100% `apps/web`**. Terceiro e último módulo
> standalone antes da F2e (Roteiro/timeline).

### O que construir

1. **Cálculo puro** — `apps/web/src/modules/atividades/calc.ts`:
   ```ts
   export interface ActivityPlan {
     readonly placeName: string;      // ex. "Museu do Ipiranga", "Trilha X"
     readonly address: string | null;
     readonly date: string | null;     // ISO date, opcional
     readonly pricePerPerson: number;
     readonly people: number;           // mínimo 1
   }
   export interface ActivityCost {
     readonly totalCost: number;        // pricePerPerson * people
   }
   export function calculateActivityCost(plan: ActivityPlan): ActivityCost
   ```
   Mesma regra de `restaurantes` (`people >= 1`, `pricePerPerson >= 0`). Se
   quiser diferenciar de `restaurantes` além do nome dos campos, é aceitável
   ficar idêntico — atividade e refeição têm a mesma forma de custo
   (preço/pessoa × pessoas). Não invente campo novo só pra parecer diferente.

2. **Módulo `atividades`**, mesmo padrão dos outros dois:
   - Tela única: nome, endereço (opcional), data (opcional), preço/pessoa,
     nº de pessoas → `totalCost` ao vivo, sem rede, sem login.
3. **"Salvar na viagem"** — mesmo componente-padrão:
   `moduleId: 'atividades'`, `kind: 'activity'`, `payload` = `ActivityPlan`,
   `costEstimate` = `totalCost`. Só logado.
4. Shadcn/ui existente é suficiente.

### Aceitação

Idêntica à F2b/F2c: build/typecheck/lint/test verdes, teste do cálculo (normal +
2 erros), calcula ao vivo sem rede, "salvar na viagem" testado (incl. some
deslogado), diff só `apps/web/**`, SDD curto.

### Fluxo

`codex/f2d/atividades` a partir de `origin/dev` → PR → Log de progresso → eu
reverifico e mergeio. Pode rodar em paralelo com F2b/F2c — mesmo cuidado com
`modules/index.ts` se as três abrirem juntas (resolve na hora do merge, é uma
linha por módulo).

---

## 11. Depois de F2b+F2c+F2d — F2e (Roteiro / timeline)

Só decomponho quando pelo menos um dos três (b/c/d) estiver mergeado — F2e
precisa de itens de verdade pra montar a timeline arrastável e o orçamento
consolidado. Não é bloqueio de ferramenta, é só não faz sentido desenhar a
timeline sem ter o que exibir nela ainda.

## 12. F2f — Reordenar dias/itens (Codex — API + Web)

> Mudança de plano (2026-09-16): F2f ia pelo Claude/AIPe, PE decidiu trocar
> pro Codex. A dispatch que já tinha começado (Pete Campbell, `apps/api`) foi
> **parada antes de qualquer commit** — nada foi escrito, sem trabalho
> perdido. Esta seção é o brief completo, cobrindo API e Web, pra rodar
> inteira no Codex.

### Sugestão de sequência

Backend primeiro, frontend depois (mesmo padrão de sempre) — mas como é uma
pessoa só dirigindo, pode ser uma PR só ou duas, à sua escolha. Se for uma PR
só, ainda assim escreva os dois pedaços claramente separados (facilita minha
verificação).

### Parte 1 — `apps/api`: dois endpoints novos

Ler antes de escrever: `apps/api/src/routes/trips.ts` (as 8 rotas
existentes), `apps/api/src/store/trips.ts` (fake em memória) e
`apps/api/src/store/prisma-trips.ts` (store real), `apps/api/src/http/trips-validate.ts`.
**Isto estende infraestrutura existente — não redesenha nada.** Mesmo padrão
de auth (`AuthVerifier`), mesma disciplina de ownership (todo método da store
recebe `userId` primeiro; não-dono = `404` idêntico ao de id inexistente,
nunca `403`, nunca vaza existência).

1. **`PATCH /trips/:id/days/:dayId`** — body `{ date?: string | null,
   order?: number }` → `200 TripDay` (só os campos presentes no body mudam).
   `404` se a trip/dia não existe ou não é do usuário. `400` pra `date`/
   `order` inválido (reusar validador de `@qualroteiro/trips` se cobrir).

2. **`PATCH /trips/:id/days/:dayId/items/:itemId`** — body `{ order?: number,
   tripDayId?: string }`. `order` sozinho reordena dentro do dia atual.
   `tripDayId` presente = mover o item pra outro dia — **esse dia tem que
   pertencer à mesma trip** (`:id` da URL); se pertencer a outra trip ou não
   existir, recusar (`400` ou `404`, sua escolha — só documentar qual e ser
   consistente com o resto da API). `200 TripItem` no sucesso.

Implementar nas **duas** stores (fake em memória pros testes, Prisma pra
produção) — não deixar uma sem implementar. Atualizar
`apps/api/specs/002-rota-custos-api/spec.md` com as 2 rotas novas (aditivo).

**Aceitação:**
- `pnpm --filter @qualroteiro/api test/typecheck/lint` verdes.
- Teste: `PATCH` de `order` de dia/item persiste e aparece no `GET
  /trips/:id` seguinte.
- Teste: mover item pra outro dia da **mesma** trip funciona; pra dia de
  **outra** trip é recusado.
- Teste: `PATCH` em recurso de outro usuário → `404` (corpo idêntico ao de id
  inexistente — mesmo teste que os endpoints existentes já provam).
- Teste: sem `Authorization` → `401`.
- Diff só `apps/api/**`.

### Parte 2 — `apps/web`: drag-and-drop na timeline

Ler antes: `apps/web/src/modules/planejamento-viagem/index.tsx`
(`TripDetailScreen`) e `apps/web/src/core/api/trips.ts`.

1. **`core/api/trips.ts`**: adicionar `updateTripDay(getToken, tripId, dayId,
   input)` e `updateTripItem(getToken, tripId, dayId, itemId, input)`
   chamando os `PATCH` da Parte 1, mesmo padrão de `request<T>` já usado
   pelas outras funções do arquivo.
2. **Arrastar-e-soltar** na `TripDetailScreen`: reordenar itens dentro de um
   dia, mover item pra outro dia, reordenar os próprios dias. **Biblioteca
   sugerida: `@dnd-kit/core` + `@dnd-kit/sortable`** (moderna, acessível, sem
   jQuery) — pode escolher outra se preferir, só documentar por quê.
3. **Atualização otimista com rollback**: ao soltar, atualiza a UI na hora e
   chama o `PATCH` em paralelo; se falhar, desfaz a mudança visual e mostra
   erro — a UI nunca pode mostrar uma ordem que não foi salva de verdade.
4. Não tocar `apps/api`, `packages/*`, config de raiz, nem os módulos
   `hospedagem`/`restaurantes`/`atividades`/`rota-custos`.

**Aceitação:**
- `pnpm --filter @qualroteiro/web build/typecheck/lint/test` verdes.
- Teste: arrastar item pra outra posição no dia chama `updateTripItem` com a
  `order` certa.
- Teste: arrastar item pra outro dia chama `updateTripItem` com `tripDayId`
  novo.
- Teste: `PATCH` falhando (mock de erro) → UI volta pro estado anterior +
  mostra erro.
- Teste: reordenar dias chama `updateTripDay` com a `order` certa.
- Diff só `apps/web/**`.

### Fluxo de entrega

Mesmo de sempre: branch `codex/f2f/reordenar-timeline` (ou duas branches se
preferir separar API/Web) a partir de `origin/dev` → PR(s) pra `dev` → anota
no Log de progresso → eu reverifico e mergeio.

## 13. F2g — Fix pós-teste: reordenar pra baixo + docker-compose + evidências (Codex)

> Decisões do PE (2026-09-16): bug via Codex, junto com o ajuste do
> `docker-compose.yml` e a preservação do handoff de teste como documentação
> commitada. Três itens, uma PR.

### Item 1 — corrigir o bug de reordenar pra baixo (o mais importante)

**Repro confirmado pelo Playwright:** com A, B, C no mesmo dia, arrastar A pra
cima de B **não muda a ordem** (fica A, B, C) mas ainda assim manda um PATCH
com a ordem errada. Arrastar C pra cima de A funciona (`C, A, B`).

**Causa raiz já identificada** (eu confirmei a matemática) em
`apps/web/src/modules/planejamento-viagem/index.tsx`, na função que calcula
o índice de destino do drag — hoje mais ou menos assim:

```ts
const [moved] = sourceDay.items.splice(activeLocation.itemIndex, 1); // já remove o item — o array encolhe aqui

const targetIndex =
  overLocation === null
    ? targetDay.items.length
    : targetDayIndex === activeLocation.dayIndex && overLocation.itemIndex > activeLocation.itemIndex
      ? overLocation.itemIndex - 1   // <-- ESTE -1 É O BUG
      : overLocation.itemIndex;

targetDay.items.splice(targetIndex, 0, moved);
```

O `splice` de remoção **já desloca** os índices de tudo que vem depois — o
`- 1` desconta essa mesma coisa **de novo**, cancelando o movimento quando o
destino é o vizinho seguinte. **O fix é remover esse ramo condicional** — usar
`overLocation.itemIndex` direto em todos os casos (mesmo dia ou dia
diferente), sem subtrair nada:

```ts
const targetIndex =
  overLocation === null ? targetDay.items.length : overLocation.itemIndex;
```

Confira a matemática você mesmo antes de aceitar minha leitura (não aplique
às cegas) — testei os dois cenários do relatório (A→B, C→A) e bate.

**Por que os testes existentes não pegaram:** eles simulam o evento de
drag-and-drop, mas não exercitam esse caminho específico (mover um item pra
posição imediatamente seguinte no mesmo dia) do jeito que o navegador real
gera. Adicionar teste de regressão cobrindo exatamente isso — ordem visual
final **e** o payload do `PATCH` enviado.

### Item 2 — `infra/docker-compose.yml`

Já tem o diff pronto localmente (não commitado): porta do Postgres
configurável via `${POSTGRES_PORT:-5432}:5432` em vez de fixa. Inclui esse
ajuste na mesma PR.

### Item 3 — commitar o handoff de teste como documentação

Os arquivos abaixo estão soltos na **raiz do workspace** (não no repo, não
versionados):
`/Users/joaofsantos/Documents/code/qualroteiro/docs/qa/2026-09-15/` — mover
pra dentro do repo, em `repos/qualroteiro/docs/qa/2026-09-15/`, mesmo nome de
arquivos:
- `HANDOFF.md` (o relatório)
- `drag-a-to-b.png`, `planning-mobile.png`, `public-desktop.png`,
  `public-mobile.png`, `routing-live.png` (screenshots)
- `qualroteiro-db-smoke.mts`, `qualroteiro-routing-check.mjs`,
  `qualroteiro-ui-check.mjs` (scripts de diagnóstico — o próprio handoff já
  avisa que são desta máquina, com paths absolutos, não são suite portável)
- `results.json`

Commitar como estão. Não precisa reescrever nada — é preservar o registro.

### Aceitação

- `pnpm --filter @qualroteiro/web build/typecheck/lint/test` verdes.
- Teste novo cobrindo mover item pra posição seguinte no mesmo dia: ordem
  final certa + `PATCH` com o payload certo.
- Teste de regressão pro caso que já funcionava (C sobre A) continua
  passando — não quebrar o que já estava certo.
- `docker-compose.yml` com a porta configurável.
- `docs/qa/2026-09-15/**` presente no diff, dentro do repo.
- Diff: `apps/web/**` (o fix) + `infra/docker-compose.yml` + `docs/qa/**`
  (evidências) — nada mais.

### Fluxo

`codex/f2g/fix-reorder-e-docs` a partir de `origin/main` (ou `origin/dev`, tanto
faz — os dois estão sincronizados desde a promoção) → PR → Log de progresso →
eu reverifico e mergeio.
