/**
 * Build-time demo mode: fixture answers for the WAVE 2 HTTP contract, so a
 * static `dist/` built with `VITE_DEMO_MODE=true` works with no backend.
 *
 * `client.ts` `await import()`s this module only when `isDemoMode()` is true, so
 * nothing here — nor its `@qualroteiro/{tolls,fuel}` runtime imports — reaches a
 * default production bundle.
 */

export { demoPlanRoute, demoSearchPlaces } from './handlers';
export { isDemoMode, setDemoModeForTests } from './mode';
