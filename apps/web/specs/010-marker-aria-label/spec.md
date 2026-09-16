# sdd-lite — aria-label dos marcadores do mapa

> Journey `j-20260916-w0`. Achado real de QA E2E (Codex+Playwright,
> `docs/qa/2026-09-16-pedagio/REPORT.md`, achado #1) durante a verificação do
> pedágio real, com 61 marcadores reais em jogo. Não é específico de pedágio:
> o bug é do `MapCanvas.tsx` (core, G2), usado por todo módulo que desenha
> marcadores no mapa (Rota & Custos, Hospedagem, Restaurantes, Atividades).

## Problema

`markerElement()` (`apps/web/src/core/map/MapCanvas.tsx`) monta cada marcador
com `aria-label` correto (o nome real do lugar). Mas
`new maplibregl.Marker({ element }).setLngLat(...).addTo(map)` — a própria
`Marker.addTo()` do MapLibre GL JS (`maplibre-gl/src/ui/marker.ts:319`) —
sobrescreve o `aria-label` do elemento passado com a string genérica
`map._getUIString('Marker.Title')` (`"Map marker"`), **depois** que
`markerElement()` já tinha setado o valor correto. O `title` sobrevive (não é
tocado por `addTo()`); o `aria-label` não. Todo marcador de todo módulo que
usa `MapCanvas` fica com nome genérico para leitor de tela.

## Decisão

Depois de `.addTo(map)`, reaplicar o `aria-label` correto no elemento real do
marcador via `marker.getElement().setAttribute('aria-label', spec.label)`.
`getElement()` devolve a mesma referência do elemento original passado em
`options.element` (confirmado lendo `marker.ts`: `this._element =
options.element` no construtor, sem wrapper) — então a correção tem efeito
imediato no nó que o leitor de tela realmente vê, e tem que rodar depois de
`addTo()` porque é dentro de `addTo()` que a sobrescrita acontece.

## Escopo

- **Dentro:** `apps/web/src/core/map/MapCanvas.tsx` (uma linha de correção +
  comentário), e um teste novo que reproduz o bug contra o `Marker` real do
  MapLibre.
- **Fora:** qualquer outro achado da mesma verificação de QA (textos antigos,
  aba cortada, precisão de coordenada); mudança de biblioteca de mapa ou de
  estilo visual dos marcadores.

## Aceite

- `pnpm --filter @qualroteiro/web build/typecheck/lint/test` verdes.
- Teste novo, contra o `Marker` real do MapLibre (não um mock que
  reimplementa `addTo()` sem o bug): elemento real no DOM com
  `aria-label === label` passado, não `"Map marker"`, não vazio.
- Zero regressão: `MapCanvas.test.tsx`, `mapPersistence.test.tsx`,
  `rotaCustos.test.tsx` continuam verdes sem mudança de asserção.
- `git diff --name-only origin/main..HEAD` só `apps/web/**`.
