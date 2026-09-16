# Handoff Codex para Claude: testes e ambiente local

Sessao de 2026-09-15. Aplicativo: `repos/qualroteiro`; a raiz deste
workspace contem os documentos de coordenacao, nao a versao ativa do app.

## Acordo da sessao

O usuario pediu testes com Playwright e solicitou ser consultado antes.
Depois autorizou executar a suite e testar a interface, com foco no
planejamento. Os resultados devem ficar registrados em Markdown e vinculados
ao documento de coordenacao para repasse ao Claude. Nao deixar o handoff
somente no chat ou em arquivos temporarios.

## Testes executados

- `pnpm exec turbo run test --force --output-logs=errors-only`, em
  `repos/qualroteiro`: 463 testes passaram, 34 arquivos, sem cache.
  Web: 106; API: 110; trips: 43; routing: 6; fuel: 11; geo: 20; tolls: 67.
  A suite existente usa Vitest; nao havia suite Playwright configurada.
- Playwright com Chromium local: tela publica de planejamento, listagem e
  detalhe de viagem, total do orcamento, arrastar itens, desktop e celular.
  Planejamento autenticado usou auth e respostas de API simuladas. Nao
  representa validacao de login Clerk ou persistencia real pelo navegador.
  Sem overflow horizontal ou erros JavaScript nos cenarios registrados.
- Apos corrigir o banco: handlers reais com Prisma e PostgreSQL real,
  autenticacao simulada. Criacao `POST /trips` = 201, listagem
  `GET /trips` = 200 e exclusao `DELETE /trips/:id` = 204. Viagem de teste
  removida ao concluir. Nao houve login real nesse teste.
- Apos corrigir a URL do provedor: Playwright sem mocks para busca de cidades
  e roteirizacao. Selecionou Sao Paulo e Rio de Janeiro nas sugestoes e
  calculou a rota pela API real: HTTP 200, 1 rota, 405.462 km.
- A suite completa precedeu os ajustes locais de configuracao; os testes
  de banco e roteirizacao acima foram executados depois desses ajustes.

## Bug pendente: reordenacao

Reproduzido: com A, B, C no mesmo dia, arrastar A para a posicao de B
mantem A, B, C e envia PATCHs com a ordem anterior. Arrastar C sobre A
funciona, produzindo C, A, B.

Causa identificada em
`repos/qualroteiro/apps/web/src/modules/planejamento-viagem/index.ts`,
linhas 131-136: subtrair 1 do indice de destino ao mover para baixo
reinsere o item na posicao original quando o destino e o vizinho seguinte.
Os testes existentes simulam o DnD e nao cobrem esse movimento no navegador.
**Nao corrigido nesta sessao.** Proximo passo: corrigir e adicionar teste
de regressao para movimento para baixo, verificando ordem visual e PATCH.

## Correcoes locais concluidas

1. Planejamento retornava 500: logs mostraram `DATABASE_URL` ausente.
   Nao havia banco Qualroteiro ativo; porta 5432 ocupada por outro projeto.
   Iniciado container `qualroteiro-postgres-1`, projeto Compose
   `qualroteiro`, PostgreSQL/PostGIS na porta 5433. Aplicada a migration
   `20260915000000_f2a_trips` com `pnpm exec prisma migrate deploy`.
   Configurado `apps/api/.env` e reiniciado o watcher da API.
2. Cidades e rotas retornavam 502: `ORS_BASE_URL` estava concatenada com
   outra atribuicao de ambiente, formando hostname invalido. Corrigida
   para `https://api.openrouteservice.org`; chave Clerk separada preservada.
   API reiniciada e fluxo real validado conforme acima.

Alteracao versionada ainda sem commit em `repos/qualroteiro`:
`infra/docker-compose.yml` usa `${POSTGRES_PORT:-5432}:5432`.
Configuracoes locais ignoradas pelo Git: `.env` na raiz do app com
`POSTGRES_PORT=5433` e `COMPOSE_PROJECT_NAME=qualroteiro`, e
`apps/api/.env` com a conexao local e a URL corrigida.
Nenhum commit, push ou PR foi criado nesta sessao.

**Pendencia de credencial:** a concatenacao indevida fez uma chave Clerk
aparecer nos logs locais. Usuario avisado para revogar e substituir a chave.
Rotacao nao executada; nao copiar o valor para documentos ou commits.

## Evidencias preservadas

Copiadas dos arquivos temporarios para esta pasta:

- [Resultados de interface com mocks](results.json).
- [Arrastar A para B](drag-a-to-b.png).
- [Planejamento mobile](planning-mobile.png).
- [Tela publica desktop](public-desktop.png) e [mobile](public-mobile.png).
- [Roteirizacao com API real](routing-live.png).
- Scripts: [interface](qualroteiro-ui-check.mjs),
  [rota real](qualroteiro-routing-check.mjs),
  [banco real](qualroteiro-db-smoke.mts).

Os scripts sao diagnosticos desta maquina, com caminhos absolutos e
dependencia do Playwright ja instalado. Nao sao uma suite portavel de CI.
O script de DnD registra o defeito em JSON, mas nao falha por essa ordem
incorreta; seu exit code zero nao significa ausencia de bugs.
O teste de rota inclui assercoes HTTP 200 e existencia de rota.
Os logs completos de Vitest permanecem nos `.turbo/turbo-test.log` dos
pacotes do app; nao foram copiados para este handoff.
