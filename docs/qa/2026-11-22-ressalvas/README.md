# Ressalvas das QAs (flake, foco, LegacyShell)

Veredito: pronto para revisão.

## Itens

1. **Flake de `mapPersistence.test.tsx`** — os 4 testes esperavam o marcador publicado num
   `useEffect` com o `findBy` padrão de 1 s. Agora `PUBLISH_TIMEOUT = 4 s` nas esperas e
   `TEST_TIMEOUT = 10 s` por teste; a asserção não mudou. **Mutação:** trocando
   `setMapLayers([` por `void ([` (marcador nunca publicado), 3 dos 4 testes falham com
   `Unable to find role="button" and name "Marcador fake"` após ~4 s; revertido, 4/4 passam.
2. **Foco após trocar o layout em Ajustes** — o gatilho do shell antigo é desmontado e o foco
   ia para o `body`. `SettingsDialog` registra a troca e a instância montada pelo novo shell
   foca o próprio gatilho "Ajustes" (janela de 5 s; instância oculta que não consegue focar
   deixa o pedido para a próxima). RED: 2 testes (a→b, b→a) falhavam com `activeElement ===
   body`; GREEN após a mudança.
3. **LegacyShell removido** (arquivo, mock em `AppShell.test.tsx`, reexport de
   `SIDEBAR_STORAGE_KEY`). `AppShell.test.tsx` reescrito sobre os shells reais A/B: tema
   (persistência), navegação e foco. Descartados os testes de markup só do legado (sidebar
   minimizável, divisão 80/20), já cobertos por ShellA/ShellB e pelos E2E. ADR 0003 atualizado.
4. **`testTimeout` global: não alterado.** Duas execuções completas sob `agentop run --rm`:
   60 arquivos/345 testes passaram nas duas, 0 timeouts, ~23–24 s cada, e nenhum teste
   passou de ~1 s fora os já citados em `2026-11-22-map-persistence-flake.md`. Sem dado que
   justifique elevar o padrão; a folga ficou só nos 4 testes que dependem do efeito.

## Gates

- `tsc --noEmit`: ok · `eslint src`: ok.
- Vitest web completo ×2: 60 arquivos, 345 testes, 0 falhas, 0 timeouts (ambas).
- E2E `playwright.layout.config.ts` (Chrome com `--use-mock-keychain`): 34 passed.

## Limites

Não provado: estabilidade do flake em amostra grande (só 2 execuções completas). O foco foi
testado em jsdom (e o E2E A→B→A passa), sem asserção de foco em navegador real. `eslint .`
na raiz do app acusa 28 erros (`process`/`URL` não definidos em arquivos fora de `src`),
pré-existentes e fora do escopo; o gate do projeto é `eslint src`.
