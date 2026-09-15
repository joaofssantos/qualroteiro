/**
 * Ambient declarations for the browser build.
 *
 * ── Why this file exists instead of `types: ["vite/client"]` ──────────────────
 *
 * `apps/web/tsconfig.json` used to declare `"types": ["vite/client"]`. An entry
 * in `compilerOptions.types` is a *hard entry-point type library*: if TypeScript
 * cannot resolve it, the whole program fails to configure —
 *
 *     error TS2688: Cannot find type definition file for 'vite/client'.
 *
 * — whether or not a single source file actually touches `import.meta.env`. That
 * made the type-check depend on the `vite` package being physically resolvable
 * from `apps/web`, so it broke under every partial-install topology: a
 * workspace-root-only install, a filtered or pruned CI install, a fresh checkout
 * where only the root dependencies were installed. A `/// <reference types=... />`
 * in a `vite-env.d.ts` would have failed in exactly the same way.
 *
 * Declaring the surface ourselves removes the resolution dependency entirely.
 * The bonus is that the app's environment variables become *named and typed*
 * here rather than arriving as anonymous `string | undefined` from a vendor
 * declaration — adding a `VITE_*` variable now means declaring it below, next to
 * the comment explaining it, and `apps/web/.env.example` documents the same set.
 */

/** The `VITE_*` variables this app reads. Keep in sync with `.env.example`. */
interface ImportMetaEnv {
  /**
   * Base URL for the qualroteiro HTTP API.
   *
   * Left unset in development on purpose: the default is the relative path
   * `/api`, which the Vite dev server proxies to the API (see `vite.config.ts`),
   * so the browser makes same-origin requests and no CORS preflight is involved.
   * Set it for a deployed build, e.g. `https://api.qualroteiro.com.br`.
   */
  readonly VITE_API_BASE_URL?: string;

  /**
   * Build-time demo mode. `"true"` (exact string) makes the fetch layer answer
   * from bundled fixtures instead of the network, so a static `dist/` works with
   * no backend. Anything else — including unset — is off, and the app behaves
   * exactly as in production. A string, per Vite's env convention. See
   * `apps/web/README.md`, `.env.example` and `src/core/api/demo/`.
   */
  readonly VITE_DEMO_MODE?: string;

  /**
   * MapLibre style document URL. Defaults to OpenFreeMap's "liberty" style,
   * which needs no API key. Override to use a paid tile vendor.
   */
  readonly VITE_MAP_STYLE_URL?: string;

  /** Vite built-ins. */
  readonly MODE: string;
  readonly BASE_URL: string;
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly SSR: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/**
 * Asset imports Vite resolves at build time. `vite/client` used to supply these;
 * we declare only the ones this app actually uses.
 */
declare module '*.css' {
  const content: string;
  export default content;
}

declare module '*.svg' {
  const src: string;
  export default src;
}
