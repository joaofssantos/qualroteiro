# Cores de wayfinding por módulo

Data: 2026-09-17  
Escopo: `apps/web/**`

## Antes e depois

Antes, títulos e todos os ícones da navegação herdavam a estrutura azul-petróleo (`text-primary` ou `text-primary-foreground`). Depois, apenas os quatro módulos abaixo possuem tokens de wayfinding, aplicados exclusivamente ao `h1` de entrada e ao SVG da sidebar quando inativo.

| Módulo | Token claro | Token escuro | Aplicação |
| --- | --- | --- | --- |
| Planejamento | `--module-planejamento: 255 45% 46%` | `255 55% 68%` | Título e ícone inativo do calendário |
| Hospedagem | `--module-hospedagem: 185 55% 32%` | `185 55% 57%` | Título e ícone inativo do hotel |
| Restaurantes | `--module-restaurantes: 14 65% 43%` | `14 65% 64%` | Título e ícone inativo de talheres |
| Atividades | `--module-atividades: 150 40% 31%` | `150 45% 59%` | Título e ícone inativo de ingresso |

Rota & Custos permanece a âncora azul-petróleo. Nenhum token de módulo é usado por botões, links, badges, erro/sucesso ou pelo traço da rota.

## Evidência visual

Playwright executou o app local em `1440×1050`, cinco rotas em claro e escuro. As dez capturas estão em [`evidence/`](./evidence/), e as cores computadas de títulos, ícones e CTAs em [`playwright.json`](./evidence/playwright.json).

- Em claro: Hospedagem `rgb(37, 119, 126)`, Restaurantes `rgb(181, 72, 38)` e Atividades `rgb(47, 111, 79)` nos respectivos títulos; os ícones inativos exibem também o índigo de Planejamento `rgb(91, 65, 170)`.
- Em escuro: as quatro cores recebem variantes mais claras, preservando contraste sobre o painel grafite.
- `Calcular rota` permaneceu âmbar: `rgb(245, 159, 10)` claro e `rgb(246, 168, 35)` escuro. `--accent` não foi modificado.

Sem uma sessão Clerk configurada no ambiente local, Planejamento renderiza sua tela legítima de acesso em vez da lista autenticada; por isso a captura dessa rota demonstra a sidebar, enquanto a classe do título é verificada no código e pela build. Não foi criado bypass de autenticação para a evidência.

## Verificação

- `pnpm -w build`
- `pnpm -w typecheck`
- `pnpm -w lint`
- `pnpm -w test`
- `AppShell.test.tsx`: 10 testes, incluindo os quatro ícones inativos.
