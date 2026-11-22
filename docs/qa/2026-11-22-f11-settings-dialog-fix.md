# F11 — correção do diálogo Ajustes

Resultado: aprovado para re-QA independente.

O diálogo era controlado pelo shell que a escolha de layout desmontava. Isso podia
deixar o portal e o foco transitoriamente ativos e fazer o `Escape` enviado pelo
E2E cair no alvo anterior. A correção fecha o diálogo antes de atualizar o layout.

Verificações no commit 44fb8de:

- `SettingsDialog.test.tsx`: 3/3, incluindo o caso RED que exigia fechar antes da troca.
- typecheck e eslint web: aprovados.
- E2E dos layouts com Chrome isolado: 34/34 aprovados; A→B→A desktop e mobile não recarregam e preservam mapa e resultado.
- suíte web: primeira rodada 349/349; segunda 348/349, com falha flake conhecida e não relacionada em `mapPersistence` sob carga do host 14.51/16.46/14.15.
