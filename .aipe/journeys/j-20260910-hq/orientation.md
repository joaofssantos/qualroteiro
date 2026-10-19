# Orientation Spec — j-20260910-hq  (v2 — amended)

> v1 aprovada pelo PE ("pode seguir" sobre a T5, 2026-09-10). **v2** amplia o
> escopo depois que o dev de T5 achou um bug pré-existente que bloqueia CI verde:
> `pnpm -w lint` nunca funcionou porque `apps/api` tem script `lint` mas nenhum
> `eslint.config.js`. Reaprovar antes do próximo dispatch.

## Problem

**T5 do acabamento do F1.** O `qualroteiro` não tem CI: build, typecheck, lint e
teste só rodam na máquina de quem abre a PR. Precisa de um pipeline que rode a
mesma verificação em toda PR pra `dev` e `main`.

**Bug pré-existente descoberto (2026-09-10, Lane Pryce):** num checkout limpo do
`dev` (`004c8e1`), `pnpm -w lint` **falha** — `@qualroteiro/api` tem
`"lint": "eslint src"` mas **não tem `eslint.config.js` nem devDep de `eslint`**;
o ESLint 9 (hoisted de `apps/web`) aborta com exit 2. `build` 6/6, `typecheck`
10/10, `test` 10/10 passam; lockfile em dia. Nunca foi pego porque nenhum QA
rodou `pnpm -w lint` no nível do workspace. **Um CI que roda `pnpm -w lint` não
fica verde enquanto isso não for corrigido** — então a correção entra nesta
jornada, antes da unidade de CI.

`apps/web` já resolveu o mesmo problema pra si (`apps/web/eslint.config.js`, flat
config `typescript-eslint`, + devDeps de eslint) — `apps/api` deve espelhar o
padrão, sem os plugins de React.

## Cross-package contracts

Duas unidades, em ondas:

- **`qualroteiro/api`** dá a `apps/api` um `eslint.config.js` + devDeps de eslint,
  de forma que `pnpm --filter @qualroteiro/api lint` passe.
- **`qualroteiro/root`** adiciona o workflow de CI que roda
  `pnpm -w build/typecheck/lint/test`. **Só faz sentido depois que a unidade
  `api` mergear** — senão o job de lint nasce vermelho. `root` **não** toca
  `apps/*`; só `.github/`.
- Sem outro contrato cross-package. Independente de T1–T4 e T6.

## Per-package scope

### qualroteiro/api
- **Scope:**
  - Criar `apps/api/eslint.config.js` — flat config espelhando
    `apps/web/eslint.config.js`, **sem** `eslint-plugin-react-hooks` /
    `eslint-plugin-react-refresh` (isto é backend Node/Fastify, não React):
    `js.configs.recommended` + `...tseslint.configs.recommended`, `ignores`
    `['dist', 'coverage']`, `languageOptions` com `globals.node` + `es2022`,
    `ecmaVersion` 2022, `sourceType` module.
  - Adicionar a `apps/api/package.json` os devDeps: `eslint`, `@eslint/js`,
    `typescript-eslint`, `globals` — **nas mesmas versões** que `apps/web` já
    fixou (`eslint ^9.12.0`, `@eslint/js ^9.12.0`, `typescript-eslint ^8.8.1`,
    `globals` na versão que `apps/web` usa). Atualizar `pnpm-lock.yaml` (é a
    consequência mecânica de adicionar devDep — permitido AQUI, ao contrário da
    unidade `root`).
  - Fazer `eslint src` passar: corrigir só o que o lint apontar que for
    **trivialmente seguro** (imports não usados, `prefer-const`, etc.). Se
    aparecer algo que exija mudança de comportamento, **desligar a regra** com
    comentário justificando OU reportar — não refatorar lógica de `apps/api`
    nesta tarefa.
  - **Não** mudar nada em `apps/web`, `packages/*`, config de raiz, `turbo.json`.
- **Acceptance:**
  - `pnpm --filter @qualroteiro/api lint` → exit 0.
  - `pnpm --filter @qualroteiro/api typecheck` e `test` continuam verdes (34
    testes).
  - `pnpm -w lint` agora passa para **todos** os pacotes que têm script `lint`.
  - `git diff --name-only` só mostra `apps/api/**` + `pnpm-lock.yaml`.
  - Nenhuma regra de lint foi afrouxada globalmente sem comentário justificando na
    linha.
  - SDD: `aipe skill match --task-type chore --size small` (sdd-lite).

### qualroteiro/root
- **Scope:**
  - `.github/workflows/ci.yml` rodando em `pull_request` (branches `dev`, `main`)
    e `push` (`dev`, `main`).
  - Passos: checkout → `pnpm/action-setup` (pinar na versão do `packageManager`
    do root `package.json`) → `actions/setup-node` Node 20 (`.nvmrc`),
    `cache: pnpm` → `pnpm install --frozen-lockfile` → `pnpm -w build` →
    `pnpm -w typecheck` → `pnpm -w lint` → `pnpm -w test`.
  - `concurrency` por ref, `cancel-in-progress: true`. Ubuntu só. Sem segredos,
    deploy, publish, matrix.
  - Cache do Turborepo entre runs: setup mais simples que funcione, ou nota no
    SDD dizendo que foi considerado e dispensado num repo deste tamanho.
  - **Só toca `.github/`** (+ badge opcional no `README` da raiz se trivial).
  - `pnpm-lock.yaml` fora de dia → **parar e reportar**, não consertar.
- **Acceptance:**
  - `.github/workflows/ci.yml` existe e é YAML válido (`actionlint`, ou
    `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"`).
  - De um checkout limpo do branch (que já terá o fix de `api`):
    `pnpm install --frozen-lockfile && pnpm -w build && pnpm -w typecheck &&
    pnpm -w lint && pnpm -w test` → **tudo verde**, lint incluído.
  - Os passos do workflow batem 1:1 com essa sequência.
  - `git diff --name-only origin/dev..HEAD` só mostra `.github/**` (+ README opc.).
  - SDD sdd-lite explicando gatilho + branches + decisão do cache do Turbo.

## Sequencing

- **Wave 1:** `qualroteiro/api` (dev: Pete Campbell) → **QA gate** Joan Holloway.
- **Wave 2:** `qualroteiro/root` (dev: Lane Pryce) → **QA gate** Bertram Cooper.
  Só abre quando a `api` (Wave 1) está `verified`/`merged` — senão o job de lint
  do CI nasce vermelho.

Independente de T1–T4 e T6 (arquivos disjuntos). A unidade `root` já foi
despachada em v1 e voltou `needs-clarification` — será re-despachada na Wave 2.

## Per-unit dispatch envelopes

`aipe execution propose --journey j-20260910-hq` rodado; envelopes são linhas da
saída.

- **`qualroteiro/api`** — `subagent / claude-code / standard / normal`
  (cost-index 2). Standard: espelhar um flat config que já existe em `apps/web` +
  adicionar devDeps é mecânico contra um alvo conhecido, mas "fazer o lint passar"
  pode revelar N ajustes pequenos que precisam de julgamento sobre desligar regra
  vs. corrigir. Descartado `fast` (não é 1 linha), `reasoning` (sem arquitetura).
  `--size small` → SDD sdd-lite.

- **`qualroteiro/root`** — `subagent / claude-code / standard / normal`
  (cost-index 2). Como v1: config de Actions contra alvo conhecido, com armadilhas
  reais (cache pnpm/turbo, `frozen-lockfile`).

- **QAs** (`Joan Holloway` p/ `api`, `Bertram Cooper` p/ `root`) —
  `subagent / claude-code / standard / normal` (cost-index 2 cada). Mecânico:
  rodar a sequência, conferir escopo, validar o YAML.

## Out of scope

- Deploy / publish / release automation (T6 é decisão do PE, à parte).
- Corrigir `pnpm-lock.yaml` desatualizado por outra razão que não os devDeps de
  eslint da unidade `api`.
- Matrix de SO/Node, E2E em browser, cobertura, lint de commits.
- Refatorar lógica de `apps/api` além do que o lint trivialmente exigir.
- `apps/web`, `packages/*`, `turbo.json`, `tsconfig.base.json` (fora da adição de
  devDeps em `apps/api/package.json`).
- Segredos / `ORS_API_KEY` no CI (testes rodam com provider mockado).
- Adicionar eslint aos `packages/*` (não têm script `lint`; fora de escopo aqui).
