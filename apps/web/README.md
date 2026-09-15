# `@qualroteiro/web`

The qualroteiro browser app — Vite 5 + React 18 + TypeScript, MapLibre GL,
TailwindCSS, shadcn/ui. First module: **Rota & Custos (F1)**.

## Local development

```sh
pnpm --filter @qualroteiro/web dev
```

The app calls the relative path `/api/...`; the Vite dev server proxies `/api`
to the API origin (`VITE_API_BASE_URL`, default `http://localhost:3000`). Copy
`.env.example` to `.env` to override — every variable has a working default.

## Checks

```sh
pnpm --filter @qualroteiro/web build      # tsc -b && vite build
pnpm --filter @qualroteiro/web typecheck
pnpm --filter @qualroteiro/web lint
pnpm --filter @qualroteiro/web test
pnpm -w build                             # the whole monorepo
```

## Homolog / demo build (`VITE_DEMO_MODE`)

A plain static deploy of `dist/` has no `/api` backend, so route/place requests
would fall through to the SPA and return HTML. For a **standalone** bundle —
homolog, a preview link, an offline demo — build with `VITE_DEMO_MODE=true`:

```sh
VITE_DEMO_MODE=true pnpm --filter @qualroteiro/web build
```

The resulting `apps/web/dist/` is a **self-contained static site that needs no
backend**. With the flag on, the fetch layer (`src/core/api/client.ts`) makes
**no network request**: it resolves from bundled fixtures in
`src/core/api/demo/` that mimic the WAVE 2 HTTP contract
(`apps/api/specs/002-rota-custos-api/spec.md`):

- `GET /places/search?q=` → the four seeded cities (São Paulo, Rio de Janeiro,
  Curitiba, Campinas), case-insensitive substring match on the label.
- `POST /routes/plan` → one route per seeded corridor: **SP↔RJ** (Dutra),
  **SP↔Curitiba** (Régis Bittencourt), **SP↔Campinas** (Bandeirantes). Tolls
  come from the real `matchTolls` (`@qualroteiro/tolls`) and fuel from the real
  `estimateFuel` (`@qualroteiro/fuel`), over the seed's reference polylines and
  demo-grade distances. Any other origin/destination pair returns a `422`, the
  same shape the UI already handles.

A **"modo demonstração"** badge is shown in the app shell whenever the flag is
on, so fixture data is never mistaken for real.

`VITE_DEMO_MODE` is a **build-time** switch — `import.meta.env.VITE_DEMO_MODE` is
inlined by Vite. A normal production build (flag unset or `"false"`) behaves
exactly as before and the demo code is dropped from the bundle.

Serve the bundle with any static file server, e.g.:

```sh
pnpm --filter @qualroteiro/web preview   # vite preview, after the demo build
```
