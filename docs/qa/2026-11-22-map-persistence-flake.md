# QA — flake de mapPersistence

## Resultado

**Veredito: aprovado para revisão.** A alteração fica restrita ao teste de
persistência do mapa e não altera código de produção nem `vitest.config.ts`.

## Diagnóstico e amostra

O `MapCanvas` pode montar a região antes de o `useEffect` do módulo publicar a
camada de marcadores. Na reprodução, a região `Mapa da rota` existia mas não
tinha botões; `getByRole('button', { name: 'Marcador fake' })` falhou de forma
síncrona. Foram feitas 37 execuções isoladas com `agentop run --rm` antes da
mudança, com 1 falha observada. Depois da mudança, 10 execuções isoladas
passaram (0 falhas observadas). A amostra não prova estabilidade fora desse
conjunto.

## Ajuste

O teste agora usa `findByRole` para a região e para o marcador, ambos com
timeout explícito de 1 segundo: espera o efeito observável, sem relógio falso
e sem alterar a implementação.

## Gates

- build do workspace: aprovado;
- `@qualroteiro/web` typecheck: aprovado;
- `@qualroteiro/web` lint: aprovado;
- `@qualroteiro/web` test: 27 arquivos e 191 testes aprovados.

## Próximos alvos (não aplicados)

No mesmo run, os arquivos mais lentos foram `rotaCustos.test.tsx` (18,9 s),
`atividades.test.tsx` (12,3 s), `hospedagem.test.tsx` (10,6 s),
`restaurantes.test.tsx` (10,4 s) e `demoMode.test.tsx` (4,1 s).
`TripDetailScreen.test.tsx` levou 1,9 s; o caso de remoção, 854 ms. Recomenda-se
auditar em cada um os awaits de UI/debounce, usar timers falsos apenas nos
debounces e extrair helpers de render e mocks compartilhados antes de elevar
timeouts. Nada dessa lista foi modificado nesta PR.
