# Tasks — `@qualroteiro/trips`

Order matters: the SDD lands first (this commit), then RED, then GREEN.

- [ ] **T0 — SDD.** `spec.md`, `plan.md`, `tasks.md`. Committed before any
      implementation exists.
- [ ] **T1 — Skeleton.** `package.json`, `tsconfig.json`, `tsconfig.test.json`,
      `README.md`, copied from `packages/fuel` (no workspace deps). Then
      `pnpm install` at the workspace root so pnpm links the new package.
- [ ] **T2 — Types (RED-enabling).** `src/types.ts` with `Trip`, `TripDay`,
      `TripItem` transcribed from the frozen contract, plus
      `tests/contract.test.ts` asserting bidirectional assignability against a
      local copy of `F2-COORDINATION.md` §3.
- [ ] **T3 — RED.** `tests/validate.test.ts` in full, per the plan's test list.
      Must fail to resolve the not-yet-written `src/validate.ts`. Capture the
      failing run as evidence.
- [ ] **T4 — GREEN.** `src/validate.ts` — `ValidationResult`, the `*Input`
      types, `isIsoDate`, `validateTripTitle`, `validateTripDates`,
      `validateTrip`, `validateTripDay`, `validateTripItem`.
- [ ] **T5 — Surface.** `src/index.ts` re-exporting types and functions, in the
      `packages/tolls/src/index.ts` style (`export type { … }` separate from
      `export { … }`, with a file-level doc comment stating the no-I/O rule).
- [ ] **T6 — Verify.** `pnpm --filter @qualroteiro/trips build typecheck test`,
      then `pnpm -w build` and `pnpm -w test` for regressions, then
      `git diff --name-only origin/dev..HEAD` to prove the blast radius is
      `packages/trips/**` only. Capture all output.
- [ ] **T7 — Ship.** Commit, push the branch, open a PR against `dev`. State
      the limits: what this package does **not** validate, and what A2 still
      owns.
