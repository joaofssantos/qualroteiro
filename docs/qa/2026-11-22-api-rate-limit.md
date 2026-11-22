# API — limitador de `POST /routes/plan`

## Veredito

**Veredito: APROVADO.** O limite por IP foi exercitado com `max: 1` e janela
de 60 segundos. A primeira chamada retorna `200`; a segunda, do mesmo IP,
retorna `429` com corpo `{ "error": string }` e cabeçalho `Retry-After`; uma
chamada de outro IP continua retornando `200`. A mesma prova confere que o
CORS expõe `Retry-After` e que `GET /places/search` não é limitado.

## Gates executados

Todos os comandos usaram Node 20.19.0, `npx pnpm@9.12.0` e `agentop run --rm`:

- `pnpm --filter './packages/*' build` — cinco pacotes concluídos.
- `pnpm --filter @qualroteiro/api test` — 8 arquivos, 180 testes aprovados.
- `pnpm --filter @qualroteiro/api typecheck` — aprovado.
- `pnpm --filter @qualroteiro/api lint` — aprovado.

O teste de regressão fica em `apps/api/tests/plan.test.ts` e a configuração de
ambiente é coberta por `apps/api/tests/env.test.ts`.
