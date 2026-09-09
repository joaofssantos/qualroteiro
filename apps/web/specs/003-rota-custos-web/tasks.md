# Tasks: Rota & Custos — Web

Ordered. Each implementation task is preceded by its failing test (RED → GREEN).

## Phase 0 — Tooling & defect fixes
- [ ] T001 Add deps: `react-router-dom`, `zustand`, `clsx`, `tailwind-merge`,
      `class-variance-authority`, `lucide-react`, `@radix-ui/react-{tabs,dialog,slot,label,select}`,
      `tailwindcss-animate`, `@qualroteiro/{geo,tolls}` (`workspace:*`).
      Dev: `vitest`, `@testing-library/{react,user-event,jest-dom}`, `jsdom`, `eslint` + plugins.
- [ ] T002 **Defect fix** — `src/env.d.ts` declaring `ImportMetaEnv`; `tsconfig.json` `types: []`.
      Proves out by `mv node_modules aside && tsc --noEmit` no longer raising TS2688.
- [ ] T003 **Defect fix** — `eslint.config.js` flat config so `pnpm … lint` runs at all.
- [ ] T004 `vite.config.ts`: `/api` dev proxy → `VITE_API_BASE_URL` (default `http://localhost:3000`),
      map style default, Vitest jsdom config + setup file + `maplibre-gl` mock.
- [ ] T005 `.env.example` documenting `VITE_API_BASE_URL` and `VITE_MAP_STYLE_URL`.
- [ ] T006 Tailwind theme: own palette (CSS variables), shadcn primitives vendored by hand.

## Phase 1 — Fetch layer
- [ ] T010 RED `client.test.ts`: `planRoute` POSTs the contract body; `searchPlaces` GETs
      `?q=`; `422` → `ApiError{status:422, field:'destination', kind:'unresolved-place'}`;
      `400` → `kind:'validation'`; `502` → `kind:'provider'`.
- [ ] T011 GREEN `core/api/{types,errors,client}.ts`.

## Phase 2 — Registry & shell (the extensibility proof)
- [ ] T020 RED `registry.extensibility.test.tsx`: a fake `demo` module declared **inside the
      test** → nav shows "Demo", `/demo` renders the stub.
- [ ] T021 RED `architecture.test.ts`: no file under `src/core/**` imports `src/modules/**`.
- [ ] T022 GREEN `core/registry/*`, `core/shell/AppShell.tsx`, `App.tsx`, `modules/index.ts`.

## Phase 3 — Shared primitives
- [ ] T030 RED `PlaceSearch.test.tsx`: one `GET /places/search?q=` per debounce window; picking
      a hit sets the field and emits the `Place`.
- [ ] T031 GREEN `core/components/PlaceSearch.tsx`.
- [ ] T032 RED `MapCanvas.test.tsx`: route LineString reaches the source; toggling a layer
      adds/removes that layer's markers.
- [ ] T033 GREEN `core/map/{MapCanvas.tsx,layers.ts}`.
- [ ] T034 `core/store/routeStore.ts` + `VehicleProfileForm.tsx`.

## Phase 4 — Module "Rota & Custos"
- [ ] T040 RED `flow.test.tsx`: Tela 1 submit (SP→RJ, Dutra fixture) → Tela 2 with trace,
      summary, Pedágios ≥1 plaza + tariff, Combustível `cost = liters × price`.
- [ ] T041 RED `alternatives.test.tsx`: 2 alternatives; selecting the second changes the trace
      and the summary numbers (asserts the delta).
- [ ] T042 RED `plazaDrawer.test.tsx`: clicking a plaza opens the drawer with its data.
- [ ] T043 RED `errors.test.tsx`: `422` → field-level "endereço não encontrado" on destination;
      `400` → generic/validation path.
- [ ] T044 GREEN the three screens + five panels + drawer.

## Phase 5 — Verify
- [ ] T050 `pnpm install && pnpm -w build && pnpm --filter @qualroteiro/web typecheck && lint && test`.
- [ ] T051 Run the dev server; record what renders.
- [ ] T052 `/state-the-limit`; commit, push, PR → `dev`.
