# Orientation Spec — j-20260916-w0 (Fix: marcadores do mapa perdem o nome acessível)

> Achado real de QA E2E (Codex+Playwright, `docs/qa/2026-09-16-pedagio/REPORT.md`,
> achado #1) durante a verificação do pedágio real. Não é específico de
> pedágio — afeta `MapCanvas.tsx`, componente core do mapa (G2), usado por
> todo módulo (Rota & Custos, Hospedagem, Restaurantes, Atividades). Por
> isso é fix de coordenador via Claude, não Codex, mesmo sendo pequeno —
> arquivo core.

## Problem

Todos os marcadores do mapa real (confirmado: 61 marcadores de pedágio na
verificação) têm `aria-label="Map marker"` genérico no DOM final, embora
`markerElement()` (`apps/web/src/core/map/MapCanvas.tsx`) já monte o botão
com `aria-label` correto (nome real da praça). O `title` sobrevive, mas o
`aria-label` não — confirmado no código-fonte real do MapLibre GL JS
(`src/ui/marker.ts:319`): `new maplibregl.Marker({ element }).addTo(map)`
sobrescreve o `aria-label` do elemento passado. Isso prejudica leitores de
tela em qualquer módulo que use o mapa — problema de acessibilidade real,
não cosmético.

## Cross-package contracts

Nenhum. Unidade única, `apps/web`, arquivo core (`core/map/MapCanvas.tsx`).

## Per-package scope

### qualroteiro/web
- **Scope:** em `apps/web/src/core/map/MapCanvas.tsx`, depois de
  `new maplibregl.Marker({ element }).setLngLat(...).addTo(map)`, reaplicar
  o `aria-label` correto no elemento real do marcador (`marker.getElement()`
  ou o `element` original, o que se provar confiável na prática — o
  MapLibre pode mutar o elemento original ou embrulhar num wrapper;
  confirmar qual é o caso real antes de escolher onde reaplicar). Testar
  contra o mapa real (MapLibre de verdade, não só um mock), não só
  confiar que o atributo foi setado sem verificar no DOM renderizado —
  esse foi exatamente o tipo de bug que passou despercebido antes.
- **Acceptance:**
  - `pnpm --filter @qualroteiro/web build/typecheck/lint/test` verdes.
  - Teste novo: depois de `MapCanvas` montar um marcador com `label`
    definido, o elemento real no DOM (não um mock) tem `aria-label` igual
    ao `label` passado — não `"Map marker"` nem vazio. Rodar contra o
    MapLibre real (o projeto já testa mapa real em outros lugares, ex.
    `rotaCustos.test.tsx` usa `constructedMaps` pra inspecionar o mapa de
    verdade — seguir o mesmo padrão, não mockar o MapLibre pra esse
    teste específico, já que foi exatamente isso que escondeu o bug).
  - Regressão zero: todo teste existente que depende de marcadores
    continua passando (`rotaCustos.test.tsx`, `mapPersistence.test.tsx`,
    e qualquer teste dos módulos que usam o mapa).
  - `git diff --name-only origin/main..HEAD` só `apps/web/**`.
  - SDD sdd-lite.

## Sequencing

- **Wave 1 (única):** `qualroteiro/web` (dev: Peggy Olson) → QA: Stan Rizzo.

## Per-unit dispatch envelopes

`aipe execution propose --journey j-20260916-w0` —
`subagent/claude-code/standard/normal` (cost-index 2). Razão: fix
pequeno e bem localizado, mas em arquivo core compartilhado por todo
módulo — mecânico o bastante pra `standard`, não precisa de `reasoning`.
QA também `standard`.

## Out of scope

- Qualquer outro achado da mesma verificação de QA (textos antigos, aba
  cortada, precisão de coordenada) — unidades/decisões separadas.
- Mudança de biblioteca de mapa ou de como marcadores são estilizados
  visualmente — só o `aria-label`.
