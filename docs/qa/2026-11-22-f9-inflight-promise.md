# F9 — promessa de prévia em voo

## Cenário corrigido

Ao alternar o consumidor da prévia entre os layouts A e B, ou ao sair da chave
K e voltar a ela antes de a rota responder, a chamada original de K permanece
em voo. O hook passa a compartilhar a promessa por `previewKey`, com uma
contagem de assinantes. O abortamento é adiado até o próximo tick e só ocorre
se nenhum consumidor reassumir aquela chave; assim, a troca de shell não cria
uma segunda chamada. Callbacks de consumidores desativados não publicam
respostas antigas sobre a prévia atual.

## Verificação

- `usePlanPreview.test.ts`: 18 testes verdes, incluindo remount A↔B e K→B→K
  antes da resolução; fluxo de cota (k) permaneceu em 2 chamadas.
- `QueryForm.test.tsx`: 12 testes verdes.
- Typecheck e lint do web: verdes.
- Suíte web completa: 49 arquivos e 287 testes verdes.

## Resultado

Veredito: PASSA.

A regressão apontada na QA independente deixa de abortar
ou duplicar a promessa de uma mesma `previewKey` durante a troca de layout.
