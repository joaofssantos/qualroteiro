# Verificação de regressão ARTESP × OSM

Commit verificado: o commit que inclui este relatório de verificação.

Veredito: aprovado.

Evidência: o teste `ARTESP tariff reconciliation > keeps the ARTESP override
after a later OSM ingestion` executa a sequência ingestão OSM → reconciliação
ARTESP → nova ingestão OSM e confirma que RIO CLARO permanece em R$ 5,00.

Também aprovados em ambiente isolado via `agentop run --rm`:

- `pnpm --filter @qualroteiro/geo build`
- `pnpm --filter @qualroteiro/data-ingest test`, `typecheck` e `lint`
- `pnpm --filter @qualroteiro/api test`, `typecheck` e `lint`
- `pnpm --filter @qualroteiro/tolls test`, `typecheck` e lint com a
  configuração compartilhada de data-ingest (o pacote não possui configuração
  ESLint própria).
