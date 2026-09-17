# 0002 — Shell: tema, navegação compacta e mapa empilhado

**Status:** aceito e implementado em 2026-09-16.

## Contexto

O shell único do app (`apps/web/src/core/shell/AppShell.tsx`) já é dono do
`MapCanvas`: módulos declaram somente `showMap: true` e publicam dados na
`mapStore`. Isso permite aplicar uma decisão de layout a Rota & Custos,
Hospedagem, Restaurantes e Atividades sem cada módulo recriar mapa, WebGL ou
breakpoints próprios.

O produto também precisava de tema escuro persistente, menu lateral que pode
ser reduzido sem perder nomes acessíveis e uma visão inicial nacional para o
mapa.

## Decisões

### Tema

- A primeira renderização sem preferência salva segue
  `prefers-color-scheme`; uma alteração posterior do sistema continua sendo
  acompanhada enquanto não houver escolha explícita.
- O botão no shell alterna claro/escuro e persiste a escolha explícita em
  `localStorage` na chave `qualroteiro:theme`.
- A classe `dark` é aplicada em `<html>`. As cores do design system continuam
  sendo tokens CSS em `apps/web/src/index.css`; não introduzir paleta direta
  em módulos para novos componentes.
- O canvas do MapLibre recebe redução visual de brilho/saturação no tema escuro
  sem alterar dados de rota, marcadores ou o estilo remoto do provedor.

### Menu lateral

- Em desktop, o botão “Minimizar/Expandir menu lateral” alterna 14rem e 4rem;
  a preferência persiste em `qualroteiro:sidebar-collapsed`.
- Na versão reduzida, os links mostram só ícones, mas retêm nome acessível por
  texto `sr-only`, `aria-label` e `title` (tooltip nativo). O botão de tema
  continua disponível; ações de autenticação textuais ficam ocultas apenas
  nesse modo desktop para não extrapolarem a coluna de ícones.
- Em mobile, a navegação segue horizontal com texto; o estado compacto não
  altera essa apresentação.

### Mapa

- Em desktop, qualquer rota cujo módulo declare `showMap: true` usa a divisão
  vertical: mapa à esquerda em `4/5` (80%) da área útil do `main` e conteúdo
  rolável à direita em `1/5` (20%). Em mobile, ela volta a empilhar mapa acima
  do conteúdo para preservar campos utilizáveis.
- A região rolável de conteúdo evita que formulários extensos cortem o mapa ou
  ultrapassem a viewport em ambas as composições. No painel 20%, grades dos
  formulários tornam-se coluna única e o container bloqueia overflow horizontal;
  não usar larguras mínimas ou grids por breakpoint de viewport sem considerar
  esse container.
- O enquadramento inicial é Brasil (`center: [-52.5, -14.5]`, `zoom: 3.4`).
  A lógica existente de `fitBounds` ainda assume a visualização quando houver
  uma rota ou marcadores publicados.

## Contrato para mudanças futuras

1. Não recriar `MapCanvas` nos módulos. Para uma nova tela com mapa, declarar
   `showMap: true` no registro e publicar/limpar camadas pela `mapStore`.
2. Não criar grid/lado a lado dentro de módulos; o shell é a fonte única da
   divisão 80/20 desktop e do empilhamento mobile do mapa.
3. Todo controle somente por ícone precisa de nome acessível e tooltip/título.
4. Usar tokens (`bg-background`, `text-foreground`, `bg-card`, etc.) para que
   claro e escuro funcionem sem variantes locais.
5. Mudanças no tema, menu ou geometria do mapa exigem cobrir ao menos:
   preferência persistida, nome acessível do controle e os quatro módulos de
   mapa.

## Evidência e testes

- Testes: `apps/web/src/core/shell/AppShell.test.tsx` cobre preferência do
  sistema, persistência do tema/menu, acessibilidade do menu compacto e as
  quatro rotas com mapa. `MapCanvas.test.tsx` cobre a visão inicial Brasil.
- Inspeção Playwright em 1440×1050: todas as quatro rotas registram mapa como
  primeiro filho do `main`, `md:flex-row`, `md:w-4/5` e conteúdo rolável em
  `md:w-1/5`; em todas, `scrollWidth` foi igual à largura da viewport (1440),
  sem rolagem horizontal da página.
  Registro: [playwright.json](../qa/2026-09-16-ui-shell-theme-map-stack/evidence/playwright.json).
- Capturas: [claro/menu expandido](../qa/2026-09-16-ui-shell-theme-map-stack/evidence/desktop-light-expanded.png)
  e [escuro/menu compacto](../qa/2026-09-16-ui-shell-theme-map-stack/evidence/desktop-dark-collapsed.png).
