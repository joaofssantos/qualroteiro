/**
 * The one place the app decides whether to run against fixtures instead of the
 * network.
 *
 * `VITE_DEMO_MODE` is a **build-time** flag. Vite inlines `import.meta.env` at
 * build, so a production bundle built with the flag unset carries the literal
 * `false` here and every demo path downstream is dead code the minifier drops.
 * It is read **once**, into a module constant, rather than re-checked at each
 * call site — the rest of the app asks `isDemoMode()`.
 *
 * Keep in sync with `apps/web/.env.example` and `apps/web/src/env.d.ts`.
 */

/** `'true'` (exact) turns demo mode on; anything else — including unset — leaves it off. */
const BUILD_FLAG: boolean = import.meta.env.VITE_DEMO_MODE === 'true';

/**
 * Test seam. `undefined` means "defer to the build flag"; a boolean forces the
 * answer for the duration of a test. There is no production caller.
 */
let testOverride: boolean | undefined;

/** True when the fetch layer should resolve from `src/core/api/demo` fixtures. */
export function isDemoMode(): boolean {
  return testOverride ?? BUILD_FLAG;
}

/**
 * Force demo mode on/off for a test, or pass `undefined` to restore the
 * build-flag value. Pair every `setDemoModeForTests(x)` with a reset in
 * `afterEach`.
 */
export function setDemoModeForTests(value: boolean | undefined): void {
  testOverride = value;
}
