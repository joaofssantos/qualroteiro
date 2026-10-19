# Spec de frontend: estabilidade das abas de Rota & Custos

Status: **proposta para alinhamento entre PE, Claude e Codex**.
Data: 2026-09-16. Implementacao nao iniciada por esta spec.
Referencia de codigo: `repos/qualroteiro`, main `5fa985a`.

## 1. Problema e objetivo

Na tela de resultado da rota Sao Paulo -> Rio, a aba Pedagios apresenta
61 registros. A barra de abas encolhe para 8 px, enquanto seus botoes tem
28 px: os rotulos ficam cortados verticalmente. Na aba Alternativas, com
conteudo curto, a barra recupera sua altura.

Objetivo: manter as quatro abas legiveis, acessiveis e com dimensoes estaveis,
independentemente da quantidade de pracas, preservando o mapa e o acesso a
todo o conteudo do painel.

Evidencias da segunda rodada E2E:

- [Relatorio](repos/qualroteiro/docs/qa/2026-09-16-pedagio-rerun/REPORT.md).
- [Defeito com lista longa](repos/qualroteiro/docs/qa/2026-09-16-pedagio-rerun/01-dutra-overview.png).
- [Comparacao com conteudo curto](repos/qualroteiro/docs/qa/2026-09-16-pedagio-rerun/fix-alternatives.png).
- [Medidas do DOM](repos/qualroteiro/docs/qa/2026-09-16-pedagio-rerun/review.json).

## 2. Escopo proposto

Uma entrega de frontend, limitada a `repos/qualroteiro/apps/web/**`, com
documentacao de verificacao em `repos/qualroteiro/docs/qa/**`.

1. Impedir o encolhimento vertical da barra de abas quando o painel tem
   conteudo longo.
2. Ajustar a relacao entre container flex, barra e conteudo para que a
   rolagem alcance todas as pracas e o total sem recortar controles.
3. Preservar a solucao horizontal: rotulos completos no desktop e, quando
   necessario em larguras menores, rolagem horizontal restrita a barra.
4. Adicionar regressao de layout em navegador e evidencias desktop/mobile.

Nao inclui redesign, novas funcionalidades, mudanca de API/banco/ingestao,
tarifas reais, agrupamento de marcadores ou correcoes de coordenadas ANTT.
Os nomes acessiveis e textos corrigidos nas PRs #37/#38 devem ser preservados.

## 3. Comportamento esperado

### Abas

- Pedagios, Combustivel, Pontos na rota e Alternativas ficam integralmente
  legiveis quando estao na area visivel da barra.
- Altura minima proposta: `2.5rem` (40 px com fonte raiz de 16 px), em linha
  com o componente atual. A troca de aba nao altera essa altura.
- Nenhum botao excede os limites verticais da barra nem sobrepoe o resumo
  ou o conteudo. Indicacao de selecao e foco continuam visiveis.
- Em 1600 x 1050, as quatro abas cabem simultaneamente. Em mobile, se
  houver overflow, todas podem ser reveladas e acionadas por toque e teclado.
- Manter a semantica Radix: tablist, tab, tabpanel, aria-selected e
  navegacao por teclado. O foco da aba ativa deve permanecer visivel.

### Rolagem e mapa

- Manter a rolagem vertical no painel de custos, conforme o comportamento
  atual. Evitar introduzir duas areas verticais de rolagem aninhadas.
- A ultima praca e o total precisam ser alcancaveis em listas longas.
- Nao ha exigencia de barra fixa/sticky nesta entrega.
- Trocar abas ou rolar o painel nao remonta o mapa, nao apaga a rota e nao
  muda a visibilidade das camadas sem uma acao explicita do usuario.
- A pagina nao ganha overflow horizontal causado pelas abas.

## 4. Direcao tecnica a confirmar

Ponto principal: `apps/web/src/modules/rota-custos/ResultScreen.tsx`,
container `Tabs` e `TabsList` (linhas 67-68 na referencia).

Hipotese: o `TabsList` com `h-10` continua sujeito a `flex-shrink`, e
`overflow-x-auto` torna o corte perceptivel quando a lista exige mais altura.
Confirmar nos estilos computados antes de implementar.

Primeira abordagem: preservar altura/min-height e impedir shrink da barra,
ajustando apenas o container local se necessario para manter a rolagem
vertical no painel. Nao tratar `shrink-0` isoladamente como prova de correcao:
validar o conteudo inteiro e o comportamento mobile no navegador.

Preferir ajuste local. Alterar `core` ou `components/ui/tabs.tsx` somente
se a investigacao demonstrar necessidade; nesse caso, documentar o motivo
e verificar os demais consumidores do componente compartilhado.

## 5. Criterios de aceite

| ID | Criterio verificavel |
| --- | --- |
| AC-1 | Com 61 pracas em 1600 x 1050, barra >= 40 px e todos os botoes inteiros dentro de seus limites verticais, tolerancia de 1 px. |
| AC-2 | Em 1600 x 1050, nenhum rotulo cortado horizontalmente; alternar entre as quatro abas funciona e mantem a altura da barra, tolerancia de 1 px. |
| AC-3 | Em 1280 x 720 e 390 x 844, nenhum corte vertical/sobreposicao; todas as abas alcancaveis, inclusive por teclado. Scroll horizontal, se necessario, fica na barra. |
| AC-4 | Listas com 0, 1 e 61 pracas permitem acessar todo o conteudo; no caso longo, ultima praca e total sao alcancaveis. |
| AC-5 | Mesmo canvas ao alternar abas e ao navegar Tela 1 -> Tela 2 -> Tela 1; toggle continua removendo/restaurando marcadores. |
| AC-6 | Preservados os nomes acessiveis das pracas, copy ANTT, oito categorias sem tarifa no drawer e total zero para a base atual sem tarifas. |
| AC-7 | Sem novos pageerrors/console.error; build, typecheck, lint e testes web passam. |
| AC-8 | Relatorio Markdown vincula comandos, commit, resultados, screenshots e eventuais limites; Log de Progresso atualizado. |

## 6. Plano de verificacao

Adicionar teste Playwright de regressao com fixture longa deterministica,
se houver infraestrutura adequada no repo. Usar dados controlados para
reproduzir o layout sem depender da disponibilidade do provedor externo.
O teste deve falhar no estado atual e passar apos a correcao.

Medir `getBoundingClientRect()` de barra e botoes apos estabilizacao do
layout. Verificar altura e contencao vertical, alem de largura; a rodada
anterior mostrou que testar apenas clique/largura produz falso positivo.
JSDOM e assercoes de classes CSS nao substituem essa validacao.

Repetir os seis casos reais definidos em `PEDAGIO-COORDINATION.md` com
Playwright. Pre-requisito: endpoint administrativo com 277 pracas. Se a
base mudar, registrar a divergencia antes de interpretar os resultados.
Separar no relatorio o teste deterministico da verificacao com dados reais.

Capturas minimas: aba Pedagios longa e Alternativas em desktop; barra e
fim da lista em mobile. Revisar as imagens, nao somente o exit code.

## 7. Alinhamento com Claude

Proposta: uma PR pequena para resolver a regressao vertical e adicionar a
regressao visual. Manter o desenho existente, a rolagem no painel e a barra
sem sticky. Precisao/sobreposicao geografica continua no backlog de dados.

Antes de despachar a implementacao, alinhar:

- Aceite deste escopo e da matriz de viewports.
- Local/padrao do teste Playwright permanente, conforme infraestrutura atual.
- Responsavel pela implementacao, base/target da PR e responsavel pelo QA.

Brief para o Claude:

> Alinhar FRONT-PEDAGIO-SPEC.md, na raiz do workspace. A segunda rodada
> E2E confirmou as correcoes de copy e aria-label, mas encontrou corte
> vertical: TabsList cai para 8 px com 61 pracas. Proposta: preservar altura
> da barra e rolagem do painel, sem redesign, com regressao em navegador
> cobrindo limites verticais, desktop/mobile e repeticao dos seis casos
> reais. As evidencias estao vinculadas na spec. Ainda nao implementado.
