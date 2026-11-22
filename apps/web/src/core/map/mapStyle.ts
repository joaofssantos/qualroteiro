import type { Map as MapLibreMap, StyleSpecification } from 'maplibre-gl';

import { type MapTheme, toMapLibreColor } from './theme';

/**
 * Recolours the OpenFreeMap "liberty" style from the semantic tokens.
 *
 * Rules come from the F0 spike (`docs/qa/2026-11-layout-f0-recolor-spike.md`):
 * a layer's role is derived from its `type`, `source-layer` and id prefix, so a
 * layer the rules do not know about is left exactly as the style shipped it.
 */

export type MapRole =
  | 'water'
  | 'land'
  | 'park'
  | 'road'
  | 'road-major'
  | 'label'
  | 'ignored';

type Layer = StyleSpecification['layers'][number];
type LooseLayer = Layer & { 'source-layer'?: string };

export function roleOf(layer: Layer): MapRole {
  const { id, type } = layer;
  const sourceLayer = (layer as LooseLayer)['source-layer'] ?? '';
  if (type === 'background' || type === 'raster' || type === 'fill-extrusion') return 'land';
  if (type === 'symbol') return /one_way_arrow|shield/.test(id) ? 'ignored' : 'label';
  if (sourceLayer === 'water' || sourceLayer === 'waterway') return 'water';
  if (sourceLayer === 'park' || /^landcover_(wood|grass|wetland)$/.test(id)) return 'park';
  if (
    sourceLayer === 'landuse' ||
    sourceLayer === 'landcover' ||
    sourceLayer === 'building' ||
    id === 'aeroway_fill'
  ) {
    return 'land';
  }
  if (sourceLayer === 'aeroway') return 'road';
  if (sourceLayer === 'transportation') {
    if (/rail|hatching/.test(id)) return 'road';
    if (/motorway|trunk|primary|secondary_tertiary/.test(id) && !/link/.test(id)) {
      return 'road-major';
    }
    return 'road';
  }
  return 'ignored';
}

type Paint = Record<string, unknown>;

function paintFor(layer: Layer, role: MapRole, theme: MapTheme): Paint | null {
  const base = theme.base;
  const c = toMapLibreColor;
  const casing = /casing/.test(layer.id);

  if (layer.type === 'background') return { 'background-color': c(base.land) };
  if (layer.type === 'raster') return { 'raster-opacity': 0 };
  // There is no building token: buildings sit one step above the ground, in the road tone.
  if (layer.type === 'fill-extrusion') return { 'fill-extrusion-color': c(base.road) };
  if (layer.type === 'symbol') {
    return role === 'label'
      ? { 'text-color': c(base.label), 'text-halo-color': c(base.labelHalo) }
      : null;
  }
  if (layer.type === 'fill') {
    const color = {
      water: base.water,
      park: base.park,
      land: layer.id === 'building' ? base.road : base.land,
    }[role as 'water' | 'park' | 'land'];
    if (!color) return null;
    const outlined = 'fill-outline-color' in ((layer.paint as Paint | undefined) ?? {});
    return { 'fill-color': c(color), ...(outlined ? { 'fill-outline-color': c(color) } : {}) };
  }
  if (layer.type === 'line') {
    if (role === 'water') return { 'line-color': c(base.water) };
    if (role === 'park') return { 'line-color': c(base.park) };
    if (role === 'road') return { 'line-color': c(casing ? base.roadCasing : base.road) };
    if (role === 'road-major') {
      return { 'line-color': c(casing ? base.roadMajorCasing : base.roadMajor) };
    }
  }
  return null;
}

/**
 * Returns `style` recoloured for `mode`. Light keeps the original style; dark
 * paints it from `theme`. Any failure returns the original `style` untouched
 * (upstream ids can change), so the map never ends up blank.
 *
 * Highway shields are sprite icons with baked-in light boxes that no paint
 * property can recolour, so in dark mode they are hidden rather than left as
 * bright patches. One-way arrows are left as they are.
 */
export function recolorStyle(
  style: StyleSpecification,
  theme: MapTheme,
  mode: 'light' | 'dark',
): StyleSpecification {
  if (mode === 'light') return style;
  try {
    const out = structuredClone(style);
    for (const layer of out.layers) {
      if (layer.type === 'symbol' && /shield/.test(layer.id)) {
        layer.layout = { ...(layer.layout ?? {}), visibility: 'none' };
        continue;
      }
      const paint = paintFor(layer, roleOf(layer), theme);
      if (paint) layer.paint = { ...(layer.paint ?? {}), ...paint } as never;
    }
    return out;
  } catch {
    return style;
  }
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Applies the difference between two styles to a live map with
 * `setPaintProperty` / `setLayoutProperty`, so a theme switch never rebuilds
 * the map. Layers the map does not have are skipped.
 */
export function applyStyleDiff(
  map: Pick<MapLibreMap, 'getLayer' | 'setPaintProperty' | 'setLayoutProperty'>,
  from: StyleSpecification,
  to: StyleSpecification,
): void {
  const before = new Map(from.layers.map((l) => [l.id, l]));
  for (const layer of to.layers) {
    const prev = before.get(layer.id);
    if (!prev || !map.getLayer(layer.id)) continue;
    const paintKeys = new Set([
      ...Object.keys((prev.paint as Paint | undefined) ?? {}),
      ...Object.keys((layer.paint as Paint | undefined) ?? {}),
    ]);
    for (const key of paintKeys) {
      const next = ((layer.paint as Paint | undefined) ?? {})[key];
      if (!same(((prev.paint as Paint | undefined) ?? {})[key], next)) {
        map.setPaintProperty(layer.id, key, next ?? null);
      }
    }
    const nextVisibility = (layer.layout as Paint | undefined)?.['visibility'];
    if (!same((prev.layout as Paint | undefined)?.['visibility'], nextVisibility)) {
      map.setLayoutProperty(layer.id, 'visibility', nextVisibility ?? 'visible');
    }
  }
}
