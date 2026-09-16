# Evidence — aria-label dos marcadores do mapa (journey j-20260916-w0)

## Onde exatamente o `aria-label` era perdido

Lido diretamente do código-fonte real instalado
(`node_modules/.pnpm/maplibre-gl@4.7.1/node_modules/maplibre-gl/src/ui/marker.ts`):

- Construtor (`Marker`, linha 283): `this._element = options.element;` — o
  elemento que `MapCanvas.markerElement()` monta (com `aria-label` correto)
  **não é embrulhado**. `_element` é a própria referência recebida.
- `Marker.addTo(map)` (linhas 316–321):
  ```ts
  addTo(map: Map): this {
      this.remove();
      this._map = map;
      this._element.setAttribute('aria-label', map._getUIString('Marker.Title'));
      map.getCanvasContainer().appendChild(this._element);
      ...
  }
  ```
  A sobrescrita acontece **dentro de `addTo()`**, depois que `MapCanvas` já
  tinha chamado `markerElement()` e setado o `aria-label` correto — ou seja,
  depois da construção do marcador, não antes.
- `Marker.getElement()` (linhas 414–416): `return this._element;` — devolve
  exatamente o mesmo nó que `addTo()` acabou de mutar, não um wrapper.

Conclusão confirmada por leitura de código e por teste (abaixo): a correção
tem que rodar **depois** de `.addTo(map)`, e pode operar tanto em `element`
(a variável original) quanto em `marker.getElement()` — são o mesmo objeto.
Usei `marker.getElement()` por ser a API pública e não depender de manter a
variável `element` viva além do necessário.

## A correção

`apps/web/src/core/map/MapCanvas.tsx`, dentro do loop que cria marcadores
novos:

```ts
const marker = new maplibregl.Marker({ element })
  .setLngLat([spec.lng, spec.lat])
  .addTo(map);
marker.getElement().setAttribute('aria-label', spec.label);
markersRef.current.set(key, marker);
```

## Por que o teste é contra o mapa real, não um mock

Todo outro teste de `MapCanvas` roda contra `test/maplibre-stub.ts` (via
`vi.mock('maplibre-gl', ...)` em `test/setup.ts`), necessário porque um
`maplibregl.Map` real precisa de WebGL, que o jsdom não tem — confirmado
tentando construir um `Map` real dentro do jsdom deste projeto:

```
Error: Failed to initialize WebGL
    at t.Map._setupPainter (.../maplibre-gl/src/ui/map.ts:3004:23)
```

Só que `StubMarker.addTo()` (o stub do projeto) é uma reimplementação do
zero que nunca tocou `aria-label` — por isso nenhum teste existente pegou
esse bug: o stub simplesmente não reproduz o comportamento real do MapLibre.

`MapCanvas.markerAccessibleName.test.tsx` (novo) resolve isso: mantém a
classe `Marker` **real e não modificada** de `maplibre-gl` (só `Map` é
substituído por um stub mínimo, e só porque construir um `Map` de verdade
precisa de WebGL) e inspeciona o nó real do DOM que `MapCanvas` produz.

### Prova de que o teste falha sem a correção (não é falso positivo)

Removendo temporariamente a linha `marker.getElement().setAttribute(...)` e
rodando o mesmo teste:

```
FAIL  src/test/_scratch/realmap.test.tsx > ... keeps the real aria-label ...
TestingLibraryElementError: Unable to find role="button" and name `/Pedágio Guararema/`

  <button
    aria-label="Map marker"
    ...
    title="Pedágio Guararema"
    type="button"
  />
```

`aria-label="Map marker"` (genérico, sobrescrito pelo `Marker.addTo()` REAL)
enquanto `title="Pedágio Guararema"` sobrevive — exatamente a assinatura do
bug relatado no achado de QA. Com a correção reaplicada, o mesmo teste
passa com `aria-label="Pedágio Guararema"`. Essa verificação foi feita num
arquivo de rascunho (`src/test/_scratch/`, removido depois) antes de mover a
versão final para `MapCanvas.markerAccessibleName.test.tsx`; não faz parte
do diff final.

## `/verify-before-done`

Rodado de `apps/web/` dentro do worktree isolado, via
`pnpm exec turbo run build typecheck lint test --filter=@qualroteiro/web`
(equivalente a `pnpm --filter @qualroteiro/web build/typecheck/lint/test`,
mas passando pelo turbo para garantir que `@qualroteiro/geo`/`@qualroteiro/tolls`/
`@qualroteiro/fuel` — dependências de workspace do `web` — estejam com
`dist/` construído; sem isso vários testes falham na resolução do módulo,
por um motivo alheio a esta mudança).

```
$ pnpm exec turbo run build typecheck lint test --filter=@qualroteiro/web
 Tasks:    7 successful, 7 total

@qualroteiro/web:build:     tsc -b && vite build          # limpo
@qualroteiro/web:typecheck: tsc --noEmit                  # limpo
@qualroteiro/web:lint:      eslint src                    # limpo
@qualroteiro/web:test:      vitest run

 ✓ src/core/api/trips.test.ts                              (10)
 ✓ src/core/api/client.test.ts                              (11)
 ✓ src/core/api/demo/handlers.test.ts                       (10)
 ✓ src/modules/planejamento-viagem/TripDetailScreen.test.tsx (11)
 ✓ src/core/map/MapCanvas.markerAccessibleName.test.tsx       (1)   NEW
 ✓ src/core/map/mapPersistence.test.tsx                       (4)   unmodified
 ✓ src/core/components/PlaceSearch.test.tsx                   (5)
 ✓ src/core/map/MapCanvas.test.tsx                            (8)   unmodified
 ✓ src/modules/restaurantes/restaurantes.test.tsx              (4)
 ✓ src/modules/atividades/atividades.test.tsx                  (6)
 ✓ src/core/api/demo/demoMode.test.tsx                         (7)
 ✓ src/modules/hospedagem/hospedagem.test.tsx                  (3)
 ✓ src/core/registry/architecture.test.ts                      (4)
 ✓ src/core/registry/extensibility.test.tsx                    (6)
 ✓ src/modules/restaurantes/SaveRestaurantToTripDialog.test.tsx (2)
 ✓ src/modules/atividades/SaveActivityToTripDialog.test.tsx     (2)
 ✓ src/modules/rota-custos/SaveRouteToTripDialog.test.tsx       (2)
 ✓ src/modules/restaurantes/calc.test.ts                        (4)
 ✓ src/modules/hospedagem/SaveStayToTripDialog.test.tsx         (2)
 ✓ src/modules/hospedagem/calc.test.ts                          (3)
 ✓ src/modules/atividades/calc.test.ts                          (3)
 ✓ src/core/auth/AuthProvider.test.tsx                          (1)
 ✓ src/modules/rota-custos/rotaCustos.test.tsx                 (18)   unmodified

 Test Files  23 passed (23)
      Tests  127 passed (127)
```

## Zero-regressão nos três testes exigidos

| Arquivo | Mudou? | Resultado |
|---|---|---|
| `MapCanvas.test.tsx` (8 testes, contra o stub) | Não | verde |
| `mapPersistence.test.tsx` (4 testes) | Não | verde |
| `rotaCustos.test.tsx` (18 testes) | Não | verde |

Nenhuma asserção existente foi tocada. O stub (`test/maplibre-stub.ts`)
também não foi alterado — a correção não depende dele nem o afeta.

## Acceptance mapping

| Aceite | Prova |
|---|---|
| build/typecheck/lint/test verdes | seção `/verify-before-done` acima |
| Teste novo contra o mapa/Marker real, `aria-label` correto | `MapCanvas.markerAccessibleName.test.tsx`, ver seção da prova de falha sem a correção |
| Zero regressão | tabela acima |
| `git diff --name-only origin/main..HEAD` só `apps/web/**` | ver `Diff scope` abaixo |
| SDD sdd-lite | este `evidence.md` + `spec.md` nesta pasta |

## Diff scope

```
$ git diff --name-only origin/main..HEAD
apps/web/specs/010-marker-aria-label/evidence.md
apps/web/specs/010-marker-aria-label/spec.md
apps/web/src/core/map/MapCanvas.markerAccessibleName.test.tsx
apps/web/src/core/map/MapCanvas.tsx
```

Todos sob `apps/web/**`.

## `/state-the-limit`

- O teste novo ainda não usa um `maplibregl.Map` 100% real — jsdom não tem
  WebGL, então nenhum teste deste projeto consegue (confirmado tentando: ver
  seção acima). O que muda em relação ao stub padrão é que a classe `Marker`
  usada é a real, não modificada, de `maplibre-gl` — exatamente onde o bug
  vive — e só o objeto `Map` continua sendo um stand-in mínimo, com a
  superfície exata que `Marker.addTo()`/`Marker._update()` leem dele.
- Não cobri os outros achados da mesma verificação de QA (textos antigos,
  aba cortada, precisão de coordenada) — fora de escopo desta unidade, por
  decisão do `orientation.md`.
- Não houve run de navegador real (Playwright) nesta unidade — a prova é
  vitest + jsdom + `Marker` real do MapLibre, mais um `vite build` de
  produção limpo.
