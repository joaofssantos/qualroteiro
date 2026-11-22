/**
 * The map's colours, resolved from the semantic tokens in `index.css`.
 *
 * MapLibre paint properties cannot read CSS `var()`, so this is the one place
 * allowed to turn `--route`, `--map-water`, `--pin-*` … into concrete colour
 * strings. Everything else under `core/map` stays literal-free (see
 * `tokens.test.ts`). Because the values are read from the live `<html>` element,
 * they follow the `.dark` class without any second source of truth.
 */

export interface MapPalette {
  readonly water: string;
  readonly land: string;
  readonly park: string;
  readonly road: string;
  readonly roadCasing: string;
  readonly roadMajor: string;
  readonly roadMajorCasing: string;
  readonly label: string;
  readonly labelHalo: string;
}

export interface MapTheme {
  readonly route: string;
  readonly casing: string;
  readonly routeAlt: string;
  /** Marker colours by kind (`toll`, `fuel`, `origin`, `destination`, `waypoint`). */
  readonly pins: Readonly<Record<string, { readonly bg: string; readonly ring: string }>>;
  /** The basemap roles `recolorStyle` paints with. */
  readonly base: MapPalette;
}

/** `pin kind → token suffix` (the CSS var is `--pin-<suffix>`). */
const PIN_TOKENS: Readonly<Record<string, string>> = {
  toll: 'toll',
  fuel: 'fuel',
  origin: 'origin',
  destination: 'dest',
  waypoint: 'stop',
};

export function readMapTheme(root: HTMLElement = document.documentElement): MapTheme {
  const computed = getComputedStyle(root);
  const color = (token: string): string => {
    const raw = (
      root.style.getPropertyValue(`--${token}`) || computed.getPropertyValue(`--${token}`)
    ).trim();
    return `hsl(${raw || '0 0% 50%'})`;
  };

  const ring = color('pin-ring');
  const pins: Record<string, { bg: string; ring: string }> = {};
  for (const [kind, token] of Object.entries(PIN_TOKENS)) {
    pins[kind] = { bg: color(`pin-${token}`), ring };
  }

  return {
    route: color('route'),
    casing: color('route-casing'),
    routeAlt: color('route-alt'),
    pins,
    base: {
      water: color('map-water'),
      land: color('map-land'),
      park: color('map-park'),
      road: color('map-road'),
      roadCasing: color('map-road-casing'),
      roadMajor: color('map-road-major'),
      roadMajorCasing: color('map-road-major-casing'),
      label: color('map-label'),
      labelHalo: color('map-label-halo'),
    },
  };
}

/** MapLibre's colour parser wants the comma form: `hsl(38, 92%, 50%)`. */
export function toMapLibreColor(color: string): string {
  return color.replace(/^hsl\(([^)]*)\)$/, (_m, body: string) =>
    `hsl(${body.trim().split(/\s+/).join(', ')})`,
  );
}

/** Whether the app is currently in dark mode. */
export function isDarkMode(root: HTMLElement = document.documentElement): boolean {
  return root.classList.contains('dark');
}

/**
 * Calls `cb` whenever the `class` attribute of `<html>` changes (the theme
 * toggle flips `dark` there). Returns an unsubscribe function.
 */
export function watchTheme(cb: () => void, root: HTMLElement = document.documentElement): () => void {
  const observer = new MutationObserver(() => cb());
  observer.observe(root, { attributes: true, attributeFilter: ['class'] });
  return () => observer.disconnect();
}
