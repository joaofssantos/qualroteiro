# Orientation Spec — j-20260916-9p (Fix batch: 2 achados não-bloqueantes de QA)

> Lote pequeno, dois fixes mecânicos e independentes achados por QA em G1 e
> G2, guardados pra "próxima leva" conforme `COORDINATOR-STATE.md`. Nenhum
> dos dois muda comportamento, só corrige um comentário incorreto e um
> valor default problemático.

## Problem

Dois achados não-bloqueantes de QA ficaram represados:

1. **`apps/api/prisma/schema.prisma`** (achado por Joan Holloway, G1): o
   doc-comment de `ApiUsageCounter.count` (linhas 123-127) diz que o
   contador soma "success OR a Google-side failure after the request left
   this process" — mas o código (`apps/api/src/routes/places-nearby.ts`)
   só incrementa em sucesso, nunca em falha (comportamento correto,
   verificado por QA via mutação; só o texto está errado).
2. **`apps/web/.env.example`** (achado por Stan Rizzo, G2): `VITE_API_BASE_URL`
   está definido com um valor concreto (`"http://localhost:3000"`, linha
   28) contrariando o comentário do próprio arquivo, que diz "leave unset
   in development" — copiar `.env.example` → `.env` literalmente produz
   27 falhas falsas em `pnpm --filter @qualroteiro/web test`.

## Cross-package contracts

Nenhum. Duas unidades independentes, sem relação entre si — só agrupadas
no mesmo lote porque são pequenas.

## Per-package scope

### qualroteiro/api
- **Scope:** corrigir só o doc-comment de `ApiUsageCounter.count` em
  `apps/api/prisma/schema.prisma` pra descrever o comportamento real
  (incrementa **só** em sucesso). Não mudar o schema, não gerar migration
  nova (não é mudança de shape, só de comentário).
- **Acceptance:**
  - `pnpm --filter @qualroteiro/api typecheck/lint/test` verdes (sem
    mudança de comportamento esperada).
  - `git diff --name-only origin/main..HEAD` só
    `apps/api/prisma/schema.prisma`.

### qualroteiro/web
- **Scope:** em `apps/web/.env.example`, remover o valor concreto de
  `VITE_API_BASE_URL` (deixar comentado/vazio, coerente com o comentário
  já existente no arquivo dizendo que fica unset em desenvolvimento). Não
  mexer no comportamento de `client.ts` (que já tem um default `?? '/api'`
  pra quando a env var não existe).
- **Acceptance:**
  - `pnpm --filter @qualroteiro/web build/typecheck/lint/test` verdes.
  - Copiar `.env.example` pra um `.env` de teste e rodar
    `pnpm --filter @qualroteiro/web test` não deve mais produzir as 27
    falhas que o Stan Rizzo documentou — confirmar isso explicitamente
    como evidência.
  - `git diff --name-only origin/main..HEAD` só `apps/web/.env.example`.

## Sequencing

- **Wave 1 (única, 2 unidades em paralelo — pacotes distintos):**
  `qualroteiro/api` (dev: Pete Campbell) e `qualroteiro/web` (dev: Peggy
  Olson), cada um → sua QA (Joan Holloway / Stan Rizzo).

## Per-unit dispatch envelopes

`aipe execution propose --journey j-20260916-9p` — `subagent/claude-code/fast/normal`
pras duas unidades (cost-index 1). Razão: puramente mecânico, sem
julgamento nenhum envolvido, escopo de 1 arquivo cada. QA também em
`fast`.

## Out of scope

- Qualquer outra mudança em `apps/api`/`apps/web` além dos 2 arquivos
  citados.
- Novas migrations, novos testes (os testes existentes já cobrem o
  comportamento; isso é só limpeza de doc/config).
